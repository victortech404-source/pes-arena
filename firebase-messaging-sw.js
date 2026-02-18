importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCvyN-rejUXKflXTZZzvmJp8w22RPil1og",
    authDomain: "uon-efootball.firebaseapp.com",
    projectId: "uon-efootball",
    storageBucket: "uon-efootball.firebasestorage.app",
    messagingSenderId: "641016442344",
    appId: "1:641016442344:web:58d7e48a0b14709b02085d",
    measurementId: "G-ZD27X0ZL0G"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png', // Ensure this icon exists
    badge: '/icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});