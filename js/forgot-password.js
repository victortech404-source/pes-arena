// Forgot Password functionality

class ForgotPasswordManager {
    constructor() {
        this.form = document.getElementById('forgot-password-form');
        this.resetBtn = document.getElementById('reset-password-btn');
        this.init();
    }

    init() {
        if (this.form) {
            this.setupEventListeners();
            console.log('🚀 ForgotPasswordManager initialized successfully');
        } else {
            console.error('❌ Forgot password form not found');
        }
    }

    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordReset();
        });

        // Reset button click
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handlePasswordReset();
            });
        }

        // Real-time email validation
        const emailInput = document.getElementById('reset-email');
        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                this.validateEmail(emailInput);
            });
        }
    }

    validateEmail(field) {
        const value = field.value.trim();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValid = emailPattern.test(value);
        
        this.setFieldValidity(field.id, isValid, 'Please enter a valid email address');
        return isValid;
    }

    setFieldValidity(fieldId, isValid, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        const formGroup = field.closest('.form-group');
        if (!formGroup) return;

        // Remove existing validation classes
        formGroup.classList.remove('valid', 'invalid');
        
        if (isValid) {
            formGroup.classList.add('valid');
        } else {
            formGroup.classList.add('invalid');
        }
        
        // Update or create error message
        let errorElement = formGroup.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.style.cssText = 'color: #ff6b6b; font-size: var(--text-sm); margin-top: var(--space-1);';
            formGroup.appendChild(errorElement);
        }
        
        errorElement.textContent = isValid ? '' : message;
        errorElement.style.display = isValid ? 'none' : 'block';
    }

    validateForm() {
        const emailInput = document.getElementById('reset-email');
        return emailInput ? this.validateEmail(emailInput) : false;
    }

    async handlePasswordReset() {
        console.log('🔄 Password reset process started...');

        // Validate form before submission
        if (!this.validateForm()) {
            this.showNotification('Please enter a valid email address.', 'error');
            return;
        }

        const email = document.getElementById('reset-email').value.trim();
        const submitBtn = this.resetBtn;

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Sending Reset Link...';
        submitBtn.disabled = true;

        try {
            console.log('📧 Attempting to send password reset email to:', email);

            // Check if Firebase is available
            if (!firebase.auth) {
                throw new Error('Authentication service is not available. Please try again later.');
            }

            // Send password reset email
            await firebase.auth().sendPasswordResetEmail(email);

            console.log('✅ Password reset email sent successfully to:', email);
            
            // Show success message using SweetAlert2 with enhanced spam folder warning
            await Swal.fire({
                title: 'Check Your Inbox!',
                html: `
                    <p>We've sent a password reset link to: <br><strong>${email}</strong></p>
                    <div style="background: rgba(255, 215, 0, 0.1); padding: 10px; border-radius: 8px; margin-top: 15px; border: 1px solid var(--gold);">
                        <span style="font-size: 1.2rem;">⚠️</span> 
                        <strong>Don't see it?</strong>
                        <br>Check your <u>Spam</u> or <u>Junk</u> folder.
                    </div>
                `,
                icon: 'success',
                confirmButtonColor: '#00ff88',
                confirmButtonText: 'OK, I checked'
            });

            // Redirect to login page after successful reset email
            window.location.href = 'login.html';

        } catch (error) {
            console.error('❌ Password reset error:', error);
            
            let errorMessage = 'Failed to send reset email. ';
            
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage += 'Invalid email address format.';
                    break;
                case 'auth/user-not-found':
                    errorMessage += 'No account found with this email address.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage += 'Too many attempts. Please try again later.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage += 'Network error. Please check your connection.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage += 'Password reset is not enabled. Please contact support.';
                    break;
                default:
                    errorMessage += error.message;
            }

            // Show error using SweetAlert2
            await Swal.fire({
                icon: 'error',
                title: 'Reset Failed',
                text: errorMessage,
                confirmButtonText: 'Try Again',
                confirmButtonColor: '#ff6b6b'
            });
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingNotification = document.querySelector('.password-reset-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `password-reset-notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: var(--bg-tertiary);
            border: 1px solid ${type === 'error' ? '#ff6b6b' : type === 'success' ? 'var(--primary-green)' : 'var(--border-primary)'};
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            box-shadow: var(--glow-md);
            transform: translateX(400px);
            transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            z-index: 1000;
            max-width: 300px;
            color: var(--text-primary);
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);">
                <span>${message}</span>
                <button style="background: none; border: none; color: var(--text-secondary); font-size: var(--text-lg); cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);

        // Auto-remove after delay
        const autoRemove = setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);

        // Manual close button
        notification.querySelector('button').addEventListener('click', function() {
            clearTimeout(autoRemove);
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }
}

// Initialize forgot password manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Firebase to initialize
    setTimeout(() => {
        console.log('🚀 Initializing ForgotPasswordManager...');
        console.log('🔥 Firebase auth available:', !!firebase.auth);
        
        window.forgotPasswordManager = new ForgotPasswordManager();
    }, 1000);
});

// Add loading spinner styles if not already present
if (!document.querySelector('#forgot-password-styles')) {
    const style = document.createElement('style');
    style.id = 'forgot-password-styles';
    style.textContent = `
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .form-group.valid input {
            border-color: var(--primary-green) !important;
        }
        
        .form-group.invalid input {
            border-color: #ff6b6b !important;
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .swal2-popup {
            font-family: 'Poppins', sans-serif;
        }
    `;
    document.head.appendChild(style);
}