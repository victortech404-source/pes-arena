// Join page registration functionality

class RegistrationManager {
    constructor() {
        this.form = document.getElementById('registration-form');
        this.init();
    }

    init() {
        if (this.form) {
            this.initFormValidation();
            this.initPasswordStrength();
            this.initRealTimeValidation();
            this.initLoginLink();
            this.fixAutocompleteAttributes();
        }
    }

    fixAutocompleteAttributes() {
        // Fix DOM warnings by adding autocomplete attributes
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        
        if (passwordInput) {
            passwordInput.setAttribute('autocomplete', 'new-password');
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.setAttribute('autocomplete', 'new-password');
        }
    }

    initFormValidation() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // UON ID validation
        const uonIdInput = document.getElementById('uon-id');
        if (uonIdInput) {
            uonIdInput.addEventListener('blur', () => {
                this.validateUONId(uonIdInput.value);
            });
        }

        // Email validation
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                this.validateEmail(emailInput.value);
            });
        }

        // Password confirmation
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => {
                this.validatePasswordMatch(passwordInput.value, confirmPasswordInput.value);
            });
        }
    }

    initPasswordStrength() {
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('input', () => {
                this.updatePasswordStrength(passwordInput.value);
            });
        }
    }

    initRealTimeValidation() {
        // Real-time validation for all required fields
        const requiredInputs = this.form.querySelectorAll('input[required], select[required]');
        
        requiredInputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });
        });
    }

    initLoginLink() {
        const loginLink = document.getElementById('login-link') || this.form.querySelector('a[href="login.html"]');
        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔗 Redirecting to login page...');
                window.location.href = 'login.html';
            });
            
            // Also ensure the href attribute is correct
            loginLink.setAttribute('href', 'login.html');
        } else {
            console.warn('⚠️ Login link not found');
        }
    }

    validateUONId(uonId) {
        // TEMPORARY FIX: Allow any Student ID format
        // Just checking if it's not empty
        const isValid = uonId && uonId.trim().length > 0;
        
        this.setFieldValidity('uon-id', isValid, 'Student ID is required');
        return isValid;
    }

    validateEmail(email) {
        // Allows any valid email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValid = emailPattern.test(email);

        this.setFieldValidity('email', isValid, 'Please enter a valid email address');
        return isValid;
    }

    validatePasswordMatch(password, confirmPassword) {
        const isValid = password === confirmPassword && password.length >= 8;
        
        this.setFieldValidity('confirm-password', isValid, 'Passwords must match and be at least 8 characters long');
        return isValid;
    }

    updatePasswordStrength(password) {
        let strength = 0;
        let feedback = '';

        // Length check
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;

        // Complexity checks
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        // Determine strength level and feedback
        let strengthLevel = '';
        if (strength <= 2) {
            strengthLevel = 'weak';
            feedback = 'Add more characters and variety';
        } else if (strength <= 4) {
            strengthLevel = 'medium';
            feedback = 'Good, but could be stronger';
        } else {
            strengthLevel = 'strong';
            feedback = 'Strong password!';
        }

        // Update or create strength indicator
        let existingMeter = document.querySelector('.password-strength');
        if (existingMeter) {
            existingMeter.remove();
        }

        const strengthMeter = document.createElement('div');
        strengthMeter.className = 'password-strength';
        strengthMeter.innerHTML = `
            <div style="background: var(--bg-secondary); height: 8px; border-radius: var(--radius-md); overflow: hidden; margin: var(--space-2) 0;">
                <div class="strength-fill" style="height: 100%; background: ${this.getStrengthColor(strengthLevel)}; width: ${(strength / 6) * 100}%; transition: width 0.3s ease;"></div>
            </div>
            <div style="font-size: var(--text-sm); color: ${this.getStrengthColor(strengthLevel)};">${feedback}</div>
        `;

        document.getElementById('password').parentNode.appendChild(strengthMeter);
    }

    getStrengthColor(level) {
        switch(level) {
            case 'weak': return '#ff6b6b';
            case 'medium': return '#ffd700';
            case 'strong': return '#00ff88';
            default: return '#888888';
        }
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let message = '';

        switch (field.id) {
            case 'full-name':
                isValid = value.length >= 2;
                message = 'Please enter your full name';
                break;
            case 'gamer-tag':
                isValid = value.length >= 3;
                message = 'Gamer tag must be at least 3 characters';
                break;
            case 'platform':
                isValid = value !== '';
                message = 'Please select your primary platform';
                break;
            case 'faculty':
                isValid = value !== '';
                message = 'Please select your faculty';
                break;
            case 'email':
                isValid = this.validateEmail(value);
                message = 'Please enter a valid email address';
                break;
        }

        this.setFieldValidity(field.id, isValid, message);
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
    }

    async handleFormSubmit() {
        console.log('🔄 Form submission started...');
        
        const submitBtn = document.getElementById('submit-btn');
        const formData = new FormData(this.form);
        
        // Validate all fields before submission
        if (!this.validateAllFields()) {
            this.showNotification('Please fix the errors in the form before submitting.', 'error');
            return;
        }

        // Show loading state
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating Account...';
        submitBtn.disabled = true;

        try {
            // Prepare user data with all required fields including faculty and email
            const userData = {
                fullName: document.getElementById('full-name').value,
                uonId: document.getElementById('uon-id').value,
                faculty: document.getElementById('faculty').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                gamerTag: document.getElementById('gamer-tag').value,
                platform: document.getElementById('platform').value,
                teamStrength: document.getElementById('team-strength').value,
                skillLevel: document.getElementById('skill-level').value,
                password: document.getElementById('password').value,
                newsletter: document.getElementById('newsletter').checked
            };

            console.log('📝 User data prepared:', userData);

            // Check if FirebaseManager is available and connected
            if (!window.firebaseManager) {
                console.error('❌ FirebaseManager not found');
                throw new Error('System not ready. Please refresh the page and try again.');
            }

            if (!window.firebaseManager.isFirebaseConnected) {
                console.error('❌ Firebase not connected');
                throw new Error('Registration is currently in demo mode. Please try again later when Firebase is available.');
            }

            console.log('🚀 Calling firebaseManager.registerUser...');
            
            // Use Firebase for registration
            const result = await window.firebaseManager.registerUser(userData);
            
            console.log('📨 Registration result:', result);

            if (result.success) {
                this.showSuccessMessage();
            } else {
                throw new Error(result.error || 'Registration failed');
            }
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.showNotification('Registration failed: ' + error.message, 'error');
            
            // Reset button
            submitBtn.textContent = 'Create Account';
            submitBtn.disabled = false;
        }
    }

    validateAllFields() {
        let isValid = true;

        // Validate required fields
        const requiredFields = this.form.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        // Special validations
        if (!this.validateUONId(document.getElementById('uon-id').value)) {
            isValid = false;
        }
        
        if (!this.validateEmail(document.getElementById('email').value)) {
            isValid = false;
        }
        
        if (!this.validatePasswordMatch(
            document.getElementById('password').value,
            document.getElementById('confirm-password').value
        )) {
            isValid = false;
        }

        return isValid;
    }

    showSuccessMessage() {
        // Create success modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: var(--bg-tertiary); padding: var(--space-8); border-radius: var(--radius-2xl); text-align: center; max-width: 500px; margin: var(--space-6);">
                <div style="font-size: 4rem; margin-bottom: var(--space-4);">🎉</div>
                <h3 style="color: var(--primary-green); margin-bottom: var(--space-4);">Welcome to UON Efootball Hub!</h3>
                <div style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    <p style="margin-bottom: var(--space-4);">Your account has been created successfully!</p>
                    <div style="text-align: left; background: var(--bg-secondary); padding: var(--space-4); border-radius: var(--radius-lg);">
                        <h4 style="color: var(--text-primary); margin-bottom: var(--space-2);">What's Next?</h4>
                        <ul style="color: var(--text-secondary); padding-left: var(--space-4);">
                            <li>Check your email for verification</li>
                            <li>Join our community platforms</li>
                            <li>Explore upcoming tournaments</li>
                            <li>Update your gaming profile</li>
                        </ul>
                    </div>
                </div>
                <div style="display: flex; gap: var(--space-3); justify-content: center;">
                    <a href="index.html" class="btn btn-primary">Go to Dashboard</a>
                    <a href="tournaments.html" class="btn btn-outline">Browse Tournaments</a>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                document.body.style.overflow = 'auto';
            }
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: var(--bg-tertiary);
            border: 1px solid ${type === 'error' ? '#ff6b6b' : 'var(--primary-green)'};
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            box-shadow: var(--glow-md);
            transform: translateX(400px);
            transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            z-index: 1000;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);">
                <span style="color: var(--text-primary);">${message}</span>
                <button style="background: none; border: none; color: var(--text-secondary); font-size: var(--text-lg); cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.style.transform = 'translateX(0)', 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);

        notification.querySelector('button').addEventListener('click', function() {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }
}

// Initialize registration when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Firebase to initialize
    setTimeout(() => {
        console.log('🚀 Initializing RegistrationManager...');
        console.log('🔥 FirebaseManager available:', !!window.firebaseManager);
        console.log('🔥 Firebase connected:', window.firebaseManager?.isFirebaseConnected);
        
        window.registrationManager = new RegistrationManager();
    }, 1000);
});