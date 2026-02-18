// UON HUB/js/community.js
// Community page functionality with robust authentication handling

class CommunityManager {
    constructor() {
        this.isFirebaseReady = false;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.initializeFirebaseListener();
        this.initCommunityLinks();
        this.initPollWidget();
        this.initFeedbackForm();
        console.log('Community Manager initializing...');
    }

    initializeFirebaseListener() {
        // Wait for Firebase to be ready
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            console.warn('Firebase not available yet, will retry...');
            setTimeout(() => this.initializeFirebaseListener(), 500);
            return;
        }

        // Set up auth state listener
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            this.isFirebaseReady = true;
            
            if (user) {
                // User is logged in
                console.log('User logged in:', user.email);
                this.handleLoggedInState(user);
            } else {
                // User is logged out
                console.log('User logged out');
                this.handleLoggedOutState();
            }
        }, (error) => {
            console.error('Auth state change error:', error);
            this.handleAuthError();
        });
    }

    handleLoggedInState(user) {
        // 1. Hide Join Hub Button
        this.hideJoinHubButton();
        
        // 2. Auto-fill Email Field
        this.updateEmailField(user.email);
        
        // 3. Enable feedback form
        this.enableFeedbackForm();
    }

    handleLoggedOutState() {
        // 1. Show Join Hub Button
        this.showJoinHubButton();
        
        // 2. Clear/Disable email field
        this.clearEmailField();
        
        // 3. Disable feedback form submission
        this.disableFeedbackForm();
    }

    handleAuthError() {
        // Handle Firebase auth errors gracefully
        const emailField = document.getElementById('feedback-email');
        if (emailField) {
            emailField.value = 'Authentication error';
            emailField.disabled = true;
        }
    }

    hideJoinHubButton() {
        const joinHubElement = document.getElementById('nav-join-hub');
        if (joinHubElement) {
            joinHubElement.style.display = 'none';
            console.log('Join Hub button hidden');
        }
    }

    showJoinHubButton() {
        const joinHubElement = document.getElementById('nav-join-hub');
        if (joinHubElement) {
            joinHubElement.style.display = '';
            console.log('Join Hub button shown');
        }
    }

    updateEmailField(email) {
        const emailField = document.getElementById('feedback-email');
        if (emailField) {
            emailField.value = email;
            emailField.readOnly = true;
            emailField.style.backgroundColor = 'var(--bg-secondary)';
            emailField.style.color = 'var(--text-secondary)';
            console.log('Email field updated with:', email);
        }
    }

    clearEmailField() {
        const emailField = document.getElementById('feedback-email');
        if (emailField) {
            emailField.value = 'Please log in to send feedback';
            emailField.readOnly = true;
            emailField.disabled = true;
            emailField.style.backgroundColor = 'var(--bg-tertiary)';
            emailField.style.color = 'var(--text-tertiary)';
        }
    }

    enableFeedbackForm() {
        const emailField = document.getElementById('feedback-email');
        const topicSelect = document.getElementById('feedback-topic');
        const messageTextarea = document.getElementById('feedback-message');
        const submitButton = document.querySelector('#feedback-form button[type="submit"]');
        
        if (emailField) emailField.disabled = false;
        if (topicSelect) topicSelect.disabled = false;
        if (messageTextarea) messageTextarea.disabled = false;
        if (submitButton) submitButton.disabled = false;
    }

    disableFeedbackForm() {
        const emailField = document.getElementById('feedback-email');
        const topicSelect = document.getElementById('feedback-topic');
        const messageTextarea = document.getElementById('feedback-message');
        const submitButton = document.querySelector('#feedback-form button[type="submit"]');
        
        if (emailField) emailField.disabled = true;
        if (topicSelect) topicSelect.disabled = true;
        if (messageTextarea) messageTextarea.disabled = true;
        if (submitButton) submitButton.disabled = true;
    }

    initCommunityLinks() {
        // WhatsApp links are handled directly in HTML
        console.log('Community links initialized');
    }

    initPollWidget() {
        // Placeholder for future poll functionality
        const pollButtons = document.querySelectorAll('.poll-btn');
        pollButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.showNotification('Community Polls are currently disabled. Feature coming soon!', 'info');
            });
        });
    }

    initFeedbackForm() {
        const feedbackForm = document.getElementById('feedback-form');
        if (!feedbackForm) {
            console.log('Feedback form not found on this page');
            return;
        }

        // Initially disable form until auth is ready
        this.disableFeedbackForm();
        
        feedbackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFeedbackSubmit();
        });
    }

    async handleFeedbackSubmit() {
        // Check if user is logged in
        if (!this.currentUser) {
            Swal.fire({
                title: 'Login Required',
                text: 'You must be logged in to send a message. Please log in and try again.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: 'var(--primary-green, #4CAF50)',
                background: 'var(--bg-primary, #0a0a0a)',
                color: 'var(--text-primary, #ffffff)'
            });
            return;
        }

        // Get form values
        const topicSelect = document.getElementById('feedback-topic');
        const messageTextarea = document.getElementById('feedback-message');
        const submitButton = document.querySelector('#feedback-form button[type="submit"]');
        
        if (!topicSelect || !messageTextarea || !submitButton) {
            this.showNotification('Form elements not found', 'error');
            return;
        }

        const topic = topicSelect.value;
        const message = messageTextarea.value.trim();

        // Validate form
        if (!topic || topic === '') {
            this.showNotification('Please select a topic', 'error');
            return;
        }

        if (!message) {
            this.showNotification('Please enter a message', 'error');
            return;
        }

        // Show loading state
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<span class="loading-spinner">⏳ Sending...</span>';
        submitButton.disabled = true;

        try {
            // Prepare feedback data for Firestore
            const feedbackData = {
                fromEmail: this.currentUser.email,
                topic: topic,
                message: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'unread',
                userId: this.currentUser.uid,
                userName: this.currentUser.displayName || 'Anonymous',
                read: false,
                replied: false
            };

            // Save to Firestore
            const docRef = await firebase.firestore().collection('feedback').add(feedbackData);
            console.log('Feedback saved with ID:', docRef.id);

            // Show success message
            await Swal.fire({
                title: 'Email Sent! 📨',
                html: `Your message has been sent directly to the UON GRiD Support Team.<br><br>We will reply to <strong>${this.currentUser.email}</strong> shortly.`,
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: 'var(--primary-green, #4CAF50)',
                background: 'var(--bg-primary, #0a0a0a)',
                color: 'var(--text-primary, #ffffff)',
                timer: 5000,
                timerProgressBar: true
            });

            // Reset form (but keep email populated)
            this.resetFeedbackForm();

        } catch (error) {
            console.error('Error sending feedback:', error);
            
            Swal.fire({
                title: 'Sending Failed',
                text: 'There was an error sending your message. Please try again.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: 'var(--primary-green, #4CAF50)',
                background: 'var(--bg-primary, #0a0a0a)',
                color: 'var(--text-primary, #ffffff)'
            });
        } finally {
            // Reset button state
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    }

    resetFeedbackForm() {
        const topicSelect = document.getElementById('feedback-topic');
        const messageTextarea = document.getElementById('feedback-message');
        
        if (topicSelect) topicSelect.value = '';
        if (messageTextarea) messageTextarea.value = '';
        
        // Email field stays populated with user's email
        console.log('Feedback form reset');
    }

    // Utility to show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'custom-notification';
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: var(--bg-tertiary);
            border: 1px solid ${type === 'error' ? '#ff6b6b' : type === 'success' ? 'var(--primary-green)' : 'var(--gold)'};
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            color: var(--text-primary);
            z-index: 1000;
            max-width: 300px;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        // Add icon based on type
        let icon = '';
        if (type === 'success') icon = '✅ ';
        if (type === 'error') icon = '❌ ';
        if (type === 'info') icon = 'ℹ️ ';
        
        notification.textContent = icon + message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        
        // Animate out and remove
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.communityManager = new CommunityManager();
    
    // Set initial state for email field
    const emailField = document.getElementById('feedback-email');
    if (emailField && !emailField.value) {
        emailField.value = 'Loading...';
        emailField.readOnly = true;
        emailField.style.backgroundColor = 'var(--bg-secondary)';
        emailField.style.color = 'var(--text-secondary)';
    }
});