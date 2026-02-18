// Login page functionality with profile verification

class LoginManager {
    constructor() {
        this.form = document.getElementById('login-form');
        this.emailLoginBtn = document.getElementById('email-login-btn');
        this.googleLoginBtn = document.getElementById('google-login-btn');
        this.guestBtn = document.getElementById('guest-btn');
        this.init();
    }

    init() {
        if (this.form) {
            this.setupEventListeners();
            this.fixAutocompleteAttributes();
            console.log('🚀 LoginManager initialized successfully');
        } else {
            console.error('❌ Login form not found');
        }
    }

    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailPasswordLogin();
        });

        // Email/password login button
        if (this.emailLoginBtn) {
            this.emailLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleEmailPasswordLogin();
            });
        }

        // Google login button
        if (this.googleLoginBtn) {
            this.googleLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleGoogleLogin();
            });
        }

        // Guest button
        if (this.guestBtn) {
            this.guestBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleGuestAccess();
            });
        }

        // Real-time validation
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');

        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                this.validateField(emailInput);
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('blur', () => {
                this.validateField(passwordInput);
            });
        }
    }

    fixAutocompleteAttributes() {
        // Fix DOM warnings by adding autocomplete attributes
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        
        if (emailInput) {
            emailInput.setAttribute('autocomplete', 'email');
        }
        if (passwordInput) {
            passwordInput.setAttribute('autocomplete', 'current-password');
        }
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let message = '';

        switch (field.id) {
            case 'login-email':
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                isValid = emailPattern.test(value);
                message = 'Please enter a valid email address';
                break;
            case 'login-password':
                isValid = value.length >= 6;
                message = 'Password must be at least 6 characters long';
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
        errorElement.style.display = isValid ? 'none' : 'block';
    }

    validateForm() {
        let isValid = true;

        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');

        if (emailInput && !this.validateField(emailInput)) {
            isValid = false;
        }

        if (passwordInput && !this.validateField(passwordInput)) {
            isValid = false;
        }

        return isValid;
    }

    async checkUserProfile(user) {
        console.log('🔍 Checking user profile for:', user.uid);
        
        try {
            // Fetch user document from Firestore
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .get();
            
            if (!userDoc.exists) {
                console.log('📄 User document does not exist, profile incomplete');
                return {
                    hasProfile: false,
                    missingFields: ['gamerTag', 'phone', 'platform'],
                    needsOnboarding: true
                };
            }
            
            const userData = userDoc.data();
            console.log('📋 User data found:', userData);
            
            // Check for critical fields (gamerTag, phone, platform)
            const missingFields = [];
            const criticalFields = ['gamerTag', 'phone', 'platform'];
            
            criticalFields.forEach(field => {
                if (!userData[field] || userData[field].toString().trim() === '') {
                    missingFields.push(field);
                }
            });
            
            if (missingFields.length > 0) {
                console.log('⚠️ Missing critical fields:', missingFields);
                return {
                    hasProfile: true,
                    missingFields: missingFields,
                    needsOnboarding: true,
                    userData: userData
                };
            }
            
            console.log('✅ User profile is complete');
            return {
                hasProfile: true,
                missingFields: [],
                needsOnboarding: false,
                userData: userData
            };
            
        } catch (error) {
            console.error('❌ Error checking user profile:', error);
            // If there's an error, assume profile needs onboarding
            return {
                hasProfile: false,
                missingFields: ['gamerTag', 'phone', 'platform'],
                needsOnboarding: true,
                error: error.message
            };
        }
    }

    async handleEmailPasswordLogin() {
        console.log('🔄 Email/password login started...');

        // Validate form before submission
        if (!this.validateForm()) {
            this.showNotification('Please fix the errors in the form before signing in.', 'error');
            return;
        }

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = this.emailLoginBtn;

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Signing In...';
        submitBtn.disabled = true;

        try {
            console.log('📧 Attempting email/password login for:', email);

            // Check if Firebase is available
            if (!firebase.auth) {
                throw new Error('Authentication service is not available. Please try again later.');
            }

            // Sign in with email and password
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            console.log('✅ Login successful:', user.email);
            
            // Check user profile before redirecting
            const profileCheck = await this.checkUserProfile(user);
            
            if (profileCheck.needsOnboarding) {
                console.log('🔄 Profile needs onboarding, redirecting to profile page');
                this.showNotification('Welcome to PES ARENA! Please complete your profile to continue.', 'info');
                
                // Store user data temporarily for onboarding
                const tempUserData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || '',
                    photoURL: user.photoURL || '',
                    missingFields: profileCheck.missingFields,
                    isOnboarding: true
                };
                
                // Store temporarily for profile page to use
                sessionStorage.setItem('tempUserOnboarding', JSON.stringify(tempUserData));
                
                // Redirect to profile page with onboarding flag
                setTimeout(() => {
                    window.location.href = 'profile.html?onboarding=true';
                }, 1500);
            } else {
                // Updated success message
                this.showNotification('Welcome to PES ARENA! Redirecting to dashboard...', 'success');
                
                // Store user data
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || profileCheck.userData?.gamerTag,
                    photoURL: user.photoURL,
                    lastLogin: new Date().toISOString(),
                    loginMethod: 'email',
                    profileComplete: true,
                    userData: profileCheck.userData
                };
                
                localStorage.setItem('currentUser', JSON.stringify(userData));
                console.log('💾 User data stored:', userData);
                
                // Redirect to home page for immediate play
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }

        } catch (error) {
            console.error('❌ Email/password login error:', error);
            
            let errorMessage = 'Login failed. ';
            
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage += 'Invalid email address.';
                    break;
                case 'auth/user-disabled':
                    errorMessage += 'This account has been disabled.';
                    break;
                case 'auth/user-not-found':
                    errorMessage += 'No account found with this email.';
                    break;
                case 'auth/wrong-password':
                    errorMessage += 'Incorrect password.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage += 'Too many failed attempts. Please try again later.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage += 'Network error. Please check your connection.';
                    break;
                default:
                    errorMessage += error.message;
            }

            this.showNotification(errorMessage, 'error');
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleGoogleLogin() {
        console.log('🔄 Google login started...');

        const submitBtn = this.googleLoginBtn;

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Connecting to Google...';
        submitBtn.disabled = true;

        try {
            console.log('🔐 Attempting Google sign-in...');

            // Check if Firebase is available
            if (!firebase.auth) {
                throw new Error('Authentication service is not available. Please try again later.');
            }

            // Create Google auth provider
            const provider = new firebase.auth.GoogleAuthProvider();
            
            // Add scopes if needed
            provider.addScope('email');
            provider.addScope('profile');

            // Sign in with popup
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;

            console.log('✅ Google login successful:', user.email);
            
            // Check user profile before redirecting
            const profileCheck = await this.checkUserProfile(user);
            
            if (profileCheck.needsOnboarding) {
                console.log('🔄 Profile needs onboarding, redirecting to profile page');
                this.showNotification('Welcome to PES ARENA! Please complete your profile to continue.', 'info');
                
                // Store user data temporarily for onboarding
                const tempUserData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    missingFields: profileCheck.missingFields,
                    isOnboarding: true
                };
                
                // Store temporarily for profile page to use
                sessionStorage.setItem('tempUserOnboarding', JSON.stringify(tempUserData));
                
                // Redirect to profile page with onboarding flag
                setTimeout(() => {
                    window.location.href = 'profile.html?onboarding=true';
                }, 1500);
            } else {
                // Updated success message
                this.showNotification(`Welcome to PES ARENA! Redirecting to dashboard...`, 'success');
                
                // Store user data
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    lastLogin: new Date().toISOString(),
                    loginMethod: 'google',
                    profileComplete: true,
                    userData: profileCheck.userData
                };
                
                localStorage.setItem('currentUser', JSON.stringify(userData));
                console.log('💾 User data stored:', userData);
                
                // Redirect to home page for immediate play
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }

        } catch (error) {
            console.error('❌ Google login error:', error);
            
            let errorMessage = 'Google sign-in failed. ';
            
            switch (error.code) {
                case 'auth/popup-blocked':
                    errorMessage += 'Popup was blocked. Please allow popups for this site.';
                    break;
                case 'auth/popup-closed-by-user':
                    errorMessage += 'Sign-in was cancelled.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage += 'Network error. Please check your connection.';
                    break;
                case 'auth/unauthorized-domain':
                    errorMessage += 'This domain is not authorized for Google sign-in.';
                    break;
                default:
                    errorMessage += error.message;
            }

            this.showNotification(errorMessage, 'error');
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    handleGuestAccess() {
        console.log('👤 Guest access requested');
        
        // Create guest user object
        const guestUser = {
            uid: 'guest_' + Date.now(),
            email: null,
            displayName: 'Guest',
            photoURL: null,
            isGuest: true,
            profileComplete: false,
            permissions: {
                canJoinTournaments: false,
                canWriteToDB: false,
                canEditProfile: false,
                canViewOnly: true
            },
            guestSince: new Date().toISOString()
        };
        
        // Store guest data
        localStorage.setItem('currentUser', JSON.stringify(guestUser));
        localStorage.setItem('isGuest', 'true');
        
        console.log('👤 Guest user created:', guestUser);
        this.showNotification('Welcome to PES ARENA! Entering as Guest. Some features will be limited.', 'info');
        
        // Redirect to home page
        setTimeout(() => {
            window.location.href = 'index.html?guest=true';
        }, 1500);
    }

    showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingNotification = document.querySelector('.login-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `login-notification notification-${type}`;
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

    // Utility method to check authentication state
    checkAuthState() {
        if (firebase.auth) {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('🔐 User is signed in:', user.email);
                    
                    // Check if user needs onboarding
                    try {
                        const profileCheck = await this.checkUserProfile(user);
                        
                        if (profileCheck.needsOnboarding) {
                            console.log('🔄 Automatic redirect to profile onboarding');
                            
                            // Store temporary onboarding data
                            const tempUserData = {
                                uid: user.uid,
                                email: user.email,
                                displayName: user.displayName || '',
                                photoURL: user.photoURL || '',
                                missingFields: profileCheck.missingFields,
                                isOnboarding: true
                            };
                            
                            sessionStorage.setItem('tempUserOnboarding', JSON.stringify(tempUserData));
                            
                            // Redirect to profile onboarding if not already there
                            if (!window.location.pathname.includes('profile.html')) {
                                window.location.href = 'profile.html?onboarding=true';
                            }
                        } else {
                            console.log('✅ User is fully authenticated and has complete profile');
                            
                            // Store user data
                            const userData = {
                                uid: user.uid,
                                email: user.email,
                                displayName: user.displayName,
                                photoURL: user.photoURL,
                                lastLogin: new Date().toISOString(),
                                profileComplete: true,
                                userData: profileCheck.userData
                            };
                            
                            localStorage.setItem('currentUser', JSON.stringify(userData));
                            
                            // If on login page, redirect to home
                            if (window.location.pathname.includes('login.html')) {
                                setTimeout(() => {
                                    window.location.href = 'index.html';
                                }, 1000);
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error in auth state check:', error);
                    }
                } else {
                    console.log('🔐 No user signed in');
                    // Check if guest
                    const isGuest = localStorage.getItem('isGuest');
                    if (isGuest) {
                        console.log('👤 Guest session active');
                    }
                }
            });
        }
    }
}

// Initialize login manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Firebase to initialize
    setTimeout(() => {
        console.log('🚀 Initializing LoginManager...');
        console.log('🔥 Firebase auth available:', !!firebase.auth);
        console.log('🔥 Firestore available:', !!firebase.firestore);
        
        window.loginManager = new LoginManager();
        
        // Check current auth state
        window.loginManager.checkAuthState();
    }, 1000);
});

// Add loading spinner styles if not already present
const style = document.createElement('style');
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
`;
document.head.appendChild(style);

// Guest access restrictions utility
window.guestRestrictions = {
    canJoinTournament: function() {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user.isGuest) {
            this.showGuestRestrictionMessage('Joining tournaments is only available for registered users. Please sign up or log in.');
            return false;
        }
        return true;
    },
    
    canWriteToDatabase: function() {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user.isGuest) {
            console.log('❌ Guest cannot write to database');
            return false;
        }
        return true;
    },
    
    canEditProfile: function() {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user.isGuest) {
            this.showGuestRestrictionMessage('Profile editing is only available for registered users. Please sign up or log in.');
            return false;
        }
        return true;
    },
    
    showGuestRestrictionMessage: function(message) {
        alert(`⚠️ Guest Access Restricted\n\n${message}\n\nPlease sign up or log in to access this feature.`);
    }
};