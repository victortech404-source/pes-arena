// PES ARENA Board Room - Real-time Communication Hub
class BoardRoomManager {
    constructor() {
        this.db = firebase.firestore();
        this.currentUser = window.boardroomUser || null;
        this.messagesRef = this.db.collection('boardroom_messages');
        this.unsubscribe = null;
        this.typingTimeout = null;
        
        this.init();
    }

    async init() {
        if (!this.currentUser) {
            // Try to get user data from auth
            await this.loadUserData();
        }
        
        this.setupRealTimeListener();
        this.setupEventListeners();
        this.updateUserInfo();
        this.markUserOnline();
    }

    async loadUserData() {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    const userDoc = await this.db.collection('users').doc(user.uid).get();
                    this.currentUser = {
                        uid: user.uid,
                        ...userDoc.data()
                    };
                    window.boardroomUser = this.currentUser;
                }
                resolve();
            });
        });
    }

    setupRealTimeListener() {
        const messagesContainer = document.getElementById('chat-messages');
        
        // Set up real-time listener with .onSnapshot()
        this.unsubscribe = this.messagesRef
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                // Check if this is the first load
                const isFirstLoad = messagesContainer.children.length === 1 && 
                                   messagesContainer.children[0].classList.contains('loading-spinner');
                
                if (snapshot.empty) {
                    this.showWelcomeMessage();
                    return;
                }

                // Process snapshot changes
                let messages = [];
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const message = {
                            id: change.doc.id,
                            ...change.doc.data()
                        };
                        messages.push(message);
                    }
                });

                if (messages.length > 0) {
                    this.renderMessages(messages, isFirstLoad);
                }
            }, (error) => {
                console.error('Real-time listener error:', error);
                messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <h3>⚠️ Connection Error</h3>
                        <p>Failed to load messages. Please check your connection.</p>
                        <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 20px; background: #00ff88; border: none; border-radius: 5px; cursor: pointer;">Retry</button>
                    </div>
                `;
            });
    }

    renderMessages(messages, shouldScrollToBottom = true) {
        const container = document.getElementById('chat-messages');
        
        // Remove loading spinner if present
        if (container.children.length === 1 && container.children[0].classList.contains('loading-spinner')) {
            container.innerHTML = '';
        }

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            container.appendChild(messageElement);
        });

        // Auto-scroll to bottom
        if (shouldScrollToBottom) {
            this.scrollToBottom();
        }
    }

    createMessageElement(message) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        
        // Check if this is the current user's message
        const isOwnMessage = message.senderUid === this.currentUser?.uid;
        if (isOwnMessage) {
            wrapper.classList.add('own-message');
        }

        // Determine role class for styling
        let roleClass = '';
        const role = message.role?.toLowerCase() || '';
        if (role === 'superadmin') roleClass = 'super-admin';
        else if (role === 'organizer') roleClass = 'organizer';
        else if (role === 'moderator') roleClass = 'moderator';
        else if (role === 'admin') roleClass = 'admin';

        // Format timestamp
        const timestamp = message.timestamp?.toDate?.() || new Date();
        const timeString = this.formatTime(timestamp);

        // Create message bubble
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${roleClass}`;
        
        bubble.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${this.escapeHtml(message.senderGamerTag || 'Unknown Player')}</span>
                <span class="message-role-badge">${message.role || 'MEMBER'}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-text">${this.escapeHtml(message.text)}</div>
        `;

        wrapper.appendChild(bubble);
        return wrapper;
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        // Less than 24 hours, show time
        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Show date for older messages
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showWelcomeMessage() {
        const container = document.getElementById('chat-messages');
        container.innerHTML = `
            <div class="welcome-message">
                <h3>🛡️ Welcome to the Board Room</h3>
                <p>This is the beginning of the high-level command channel.</p>
                <p>Messages here are visible to all organizers and administrators.</p>
                <p style="color: #00ff88; margin-top: 20px;">Be the first to start the conversation!</p>
            </div>
        `;
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        const sendBtn = document.getElementById('send-message-btn');

        if (!message || !this.currentUser) return;

        // Disable send button temporarily
        sendBtn.disabled = true;

        try {
            // Save message to Firestore
            await this.messagesRef.add({
                text: message,
                senderUid: this.currentUser.uid,
                senderGamerTag: this.currentUser.gamerTag || this.currentUser.displayName || 'Anonymous',
                role: this.currentUser.role || (this.currentUser.isOrganizer ? 'Organizer' : 'Member'),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Clear input and reset height
            input.value = '';
            input.style.height = 'auto';
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            // Re-enable send button
            sendBtn.disabled = false;
            input.focus();
        }
    }

    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        container.scrollTop = container.scrollHeight;
    }

    updateUserInfo() {
        if (!this.currentUser) return;

        // Update user info in sidebar
        const userName = document.getElementById('user-name');
        const userRole = document.getElementById('user-role');
        const userAvatar = document.getElementById('user-avatar');

        if (userName) {
            userName.textContent = this.currentUser.gamerTag || this.currentUser.displayName || 'Player';
        }

        if (userRole) {
            const role = this.currentUser.role || (this.currentUser.isOrganizer ? 'Organizer' : 'Member');
            userRole.textContent = role.toUpperCase();
            
            // Set role color
            if (role === 'superAdmin') userRole.style.color = '#00ff88';
            else if (role === 'organizer') userRole.style.color = '#00ffff';
            else if (role === 'moderator') userRole.style.color = '#ffc107';
        }

        if (userAvatar) {
            const initials = (this.currentUser.gamerTag || this.currentUser.displayName || 'AD')
                .split(' ')
                .map(word => word[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
            userAvatar.textContent = initials;
        }
    }

    markUserOnline() {
        // Could implement online presence system here
        // For now, just log
        console.log('User online:', this.currentUser?.gamerTag);
    }

    handleTyping() {
        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Show typing indicator (can be expanded with real-time typing)
        const indicator = document.getElementById('typing-indicator');
        indicator.textContent = 'Typing...';

        // Hide after 1 second of no typing
        this.typingTimeout = setTimeout(() => {
            indicator.textContent = '';
        }, 1000);
    }

    adjustTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }

    setupEventListeners() {
        const input = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-message-btn');
        const emojiBtn = document.getElementById('emoji-btn');
        const attachBtn = document.getElementById('attach-btn');

        // Send message on button click
        sendBtn.addEventListener('click', () => this.sendMessage());

        // Send message on Ctrl+Enter
        input.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Enable/disable send button based on input
        input.addEventListener('input', () => {
            sendBtn.disabled = !input.value.trim();
            this.handleTyping();
            this.adjustTextareaHeight(input);
        });

        // Emoji picker (simplified version)
        emojiBtn.addEventListener('click', () => {
            const commonEmojis = ['😊', '👍', '🎮', '🏆', '⚡', '📢', '✅', '🔥'];
            const emoji = prompt(`Choose an emoji:\n${commonEmojis.join(' ')}`);
            if (emoji) {
                input.value += emoji;
                input.dispatchEvent(new Event('input'));
            }
        });

        // Attach file (placeholder)
        attachBtn.addEventListener('click', () => {
            alert('File attachment coming soon!');
        });

        // Auto-focus input
        input.focus();

        // Clean up listener on page unload
        window.addEventListener('beforeunload', () => {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.error('Firebase not initialized');
        return;
    }

    // Wait for access control script to set boardroomUser
    const checkUser = setInterval(() => {
        if (window.boardroomUser || firebase.auth().currentUser) {
            clearInterval(checkUser);
            window.boardroomManager = new BoardRoomManager();
        }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(checkUser);
        if (!window.boardroomManager) {
            console.error('Failed to initialize Board Room');
        }
    }, 5000);
});