// UON HUB/js/notifications.js
// Firebase Cloud Messaging (FCM) for push notifications

document.addEventListener('DOMContentLoaded', () => {
    // Only run if messaging is supported
    if (typeof firebase !== 'undefined' && firebase.messaging) {
        initializeNotifications();
    }
});

function initializeNotifications() {
    const messaging = firebase.messaging();
    
    // Check current notification permission state FIRST
    const permission = Notification.permission;
    
    console.log('Current notification permission:', permission);
    
    // Handle based on permission state
    if (permission === 'denied') {
        // Permission is blocked by user - stop here quietly
        console.log('Notifications blocked by user.');
        return; // Exit immediately, don't try anything else
    }
    
    // VAPID Key from Firebase Console -> Project Settings -> Cloud Messaging
    const vapidKey = "BLW4uoKuFoYU39B6Q_SnZJx6vL8_rF-G9O9VYkFXRT5Sshpom43SWeIKIQSYocRy5k4QgVD11E4TWOgslG8BJCI"; 
    
    if (permission === 'granted') {
        // Permission already granted - get the token
        getFirebaseToken(messaging, vapidKey);
    } 
    else if (permission === 'default') {
        // Permission not yet decided - request it
        console.log('Notification permission not yet set. Requesting permission...');
        requestNotificationPermission(messaging, vapidKey);
    }
    
    // Handle incoming messages when app is in foreground
    setupMessageListener(messaging);
}

function getFirebaseToken(messaging, vapidKey) {
    messaging.getToken({ vapidKey: vapidKey })
        .then((currentToken) => {
            if (currentToken) {
                console.log('Notification Token:', currentToken);
                // Save this token to the user's profile in Firestore
                saveTokenToDatabase(currentToken);
            } else {
                console.log('No registration token available.');
            }
        })
        .catch((err) => {
            // Gracefully handle permission-blocked error without polluting console
            if (err.code === 'messaging/permission-blocked') {
                console.warn('Notifications blocked by user. Token retrieval prevented.');
            } else {
                // Only log actual errors, not permission issues
                console.log('An error occurred while retrieving token: ', err.message || err);
            }
        });
}

function requestNotificationPermission(messaging, vapidKey) {
    Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            // Get token after permission is granted
            getFirebaseToken(messaging, vapidKey);
        } else if (permission === 'denied') {
            // User explicitly denied - log quietly and stop
            console.log('Notifications blocked by user (explicitly denied).');
        } else {
            console.log('Notification permission dismissed (default state).');
        }
    }).catch((err) => {
        // Handle errors in permission request
        console.log('Error requesting notification permission:', err.message || err);
    });
}

function setupMessageListener(messaging) {
    messaging.onMessage((payload) => {
        console.log('Message received. ', payload);
        const { title, body } = payload.notification;
        
        // Show custom in-app notification
        showInAppNotification(title, body);
    });
}

function saveTokenToDatabase(token) {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            firebase.firestore().collection('users').doc(user.uid).update({
                fcmToken: token
            }).catch(err => console.error("Error saving token:", err));
        }
    });
}

function showInAppNotification(title, body) {
    // Use your existing notification styling from blog.js/community.js
    // Or reuse the SweetAlert
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: title,
            text: body,
            icon: 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true
        });
    } else {
        // Fallback to browser notification if permission is granted
        if (Notification.permission === 'granted') {
            new Notification(title, { body: body });
        }
    }
}