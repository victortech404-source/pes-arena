class ProfileManager {
    constructor() {
        this.currentUser = null;
        this.usersCache = []; // Store users for the dropdown
        this.isOnboardingMode = false; // Track if in onboarding mode
        this.init();
    }

    init() {
        this.setupAuthStateListener();
        this.setupEventListeners();
    }

    setupAuthStateListener() {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                this.currentUser = user;
                // Check if user needs onboarding BEFORE loading profile
                this.checkOnboardingStatus().then(needsOnboarding => {
                    this.loadUserProfile();
                    this.loadUserTournaments();
                    this.loadMatchHistory();
                    this.loadOpponentsList(); // Pre-load opponents
                    
                    if (needsOnboarding) {
                        this.forceOnboardingModal();
                    }
                });
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async checkOnboardingStatus() {
        try {
            const doc = await firebase.firestore().collection('users').doc(this.currentUser.uid).get();
            
            if (!doc.exists) {
                console.log('📄 User document does not exist, needs onboarding');
                return true;
            }

            const data = doc.data();
            
            // Check for required fields
            const requiredFields = ['gamerTag', 'phone', 'platform', 'institution'];
            const missingFields = requiredFields.filter(field => !data[field] || data[field].toString().trim() === '');
            
            // Also check fullName (but it's not strictly required for initial profile)
            if (!data.fullName || data.fullName.trim() === '') {
                console.log('⚠️ Full name missing');
            }

            if (missingFields.length > 0) {
                console.log('⚠️ Missing required fields:', missingFields);
                return true;
            }

            console.log('✅ User profile is complete');
            return false;

        } catch (error) {
            console.error('Error checking onboarding status:', error);
            return true; // Assume needs onboarding if error occurs
        }
    }

    forceOnboardingModal() {
        console.log('🚀 Forcing onboarding modal');
        this.isOnboardingMode = true;
        
        // Show the onboarding overlay
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            
            // Prevent scrolling
            document.body.style.overflow = 'hidden';
            
            // Disable all navigation links
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.add('disabled');
            });
        }
    }

    async completeOnboarding(profileData) {
        try {
            // Add user ID to profile data
            profileData.fullName = profileData.fullName || this.currentUser.displayName || 'Player';
            profileData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            
            // Save to Firestore
            await firebase.firestore().collection('users').doc(this.currentUser.uid).set(profileData, { merge: true });
            
            // Hide onboarding overlay
            const overlay = document.getElementById('onboarding-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
            
            // Reset onboarding mode
            this.isOnboardingMode = false;
            
            // Enable scrolling
            document.body.style.overflow = 'auto';
            
            // Enable navigation
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('disabled');
            });
            
            // Reload profile data
            await this.loadUserProfile();
            
            // Show success message
            Swal.fire({
                title: 'Welcome to PES ARENA!',
                html: `
                    <div style="text-align: center;">
                        <div style="color: var(--primary-green); font-size: 48px; margin: 20px 0;">🏆</div>
                        <p style="color: var(--text-primary);">
                            Your profile is now complete!<br>
                            <small style="color: var(--text-secondary);">
                                You can now join tournaments and submit matches.
                            </small>
                        </p>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Start Playing',
                confirmButtonColor: '#00ff88'
            });
            
        } catch (error) {
            console.error('Error completing onboarding:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to save profile. Please try again.',
                icon: 'error',
                confirmButtonColor: '#ff6b6b'
            });
        }
    }

    async getPlayerRank(currentUserId, currentUserStats) {
        try {
            // Fetch all users from Firestore
            const snapshot = await firebase.firestore().collection('users').get();
            
            // Map users to array with relevant stats
            const players = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                players.push({
                    uid: doc.id,
                    winRate: userData.winRate || 0,
                    wins: userData.wins || 0,
                    draws: userData.draws || 0
                });
            });

            // Sort players by ranking criteria (descending order)
            players.sort((a, b) => {
                // First: Compare winRate (higher is better)
                if (b.winRate !== a.winRate) {
                    return b.winRate - a.winRate;
                }
                // Second: If winRate ties, compare wins (higher is better)
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }
                // Third: If wins also tie, compare draws (higher is better)
                return b.draws - a.draws;
            });

            // Find the index of current user in sorted array
            const rankIndex = players.findIndex(player => player.uid === currentUserId);
            
            // Return rank (1-based index, or '-' if not found)
            return rankIndex !== -1 ? rankIndex + 1 : '-';
            
        } catch (error) {
            console.error('Error calculating rank:', error);
            return '-';
        }
    }

    async loadUserProfile() {
        try {
            const doc = await firebase.firestore().collection('users').doc(this.currentUser.uid).get();
            if (doc.exists) {
                const data = doc.data();
                
                // Update display with institution (replaces faculty)
                document.getElementById('p-name').textContent = data.fullName || 'Player';
                document.getElementById('p-tag').textContent = '@' + (data.gamerTag || 'NoTag');
                document.getElementById('p-institution').textContent = data.institution || 'PES Arena Player';
                document.getElementById('platform-display').textContent = data.platform || 'Not set';
                
                if (data.avatarURL) document.getElementById('p-avatar').src = data.avatarURL;

                // Pre-fill Edit Form with all required fields
                if (document.getElementById('edit-name')) {
                    document.getElementById('edit-name').value = data.fullName || '';
                    document.getElementById('edit-tag').value = data.gamerTag || '';
                    document.getElementById('edit-phone').value = data.phone || '';
                    
                    // Platform radio buttons
                    const platformRadios = document.querySelectorAll('input[name="edit-platform"]');
                    platformRadios.forEach(radio => {
                        if (radio.value === data.platform) {
                            radio.checked = true;
                        }
                    });
                    
                    // Institution select
                    const institutionSelect = document.getElementById('edit-institution');
                    if (institutionSelect) {
                        // Check if the value exists in the select options
                        const optionExists = Array.from(institutionSelect.options).some(opt => opt.value === data.institution);
                        if (optionExists) {
                            institutionSelect.value = data.institution;
                        } else {
                            institutionSelect.value = 'other';
                            const otherInput = document.getElementById('edit-other-institution');
                            if (otherInput) {
                                otherInput.style.display = 'block';
                                otherInput.value = data.institution;
                            }
                        }
                    }
                }
                
                // Stats
                const wins = data.wins || 0;
                const losses = data.losses || 0;
                const draws = data.draws || 0;
                const goalsScored = data.goalsScored || 0;
                const cleanSheets = data.cleanSheets || 0;

                document.getElementById('s-wins').textContent = wins;
                document.getElementById('s-draws').textContent = draws;
                document.getElementById('s-losses').textContent = losses;
                document.getElementById('s-goals').textContent = goalsScored;
                document.getElementById('s-clean-sheets').textContent = cleanSheets;

                // Calculate Win Rate (Wins / Total Games)
                const total = wins + losses + draws;
                const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
                
                // Calculate and display dynamic rank
                const currentUserStats = {
                    winRate: rate,
                    wins: wins,
                    draws: draws
                };
                
                const rank = await this.getPlayerRank(this.currentUser.uid, currentUserStats);
                document.getElementById('s-rank').textContent = rank !== '-' ? `#${rank}` : '-';
            }
        } catch (e) { 
            console.error('Error loading user profile:', e); 
        }
    }

    async loadOpponentsList() {
        // This is kept for future use but currently not needed
        try {
            const snapshot = await firebase.firestore().collection('users').get();
            const datalist = document.getElementById('opponents-list');
            if (!datalist) return;
            
            datalist.innerHTML = '';
            this.usersCache = [];

            snapshot.forEach(doc => {
                const user = doc.data();
                // Don't include yourself in the opponent list
                if (doc.id !== this.currentUser.uid) {
                    this.usersCache.push({ id: doc.id, tag: user.gamerTag });
                    const option = document.createElement('option');
                    option.value = user.gamerTag; 
                    datalist.appendChild(option);
                }
            });
        } catch (e) { 
            console.error("Error loading opponents", e); 
        }
    }

    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 200;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.7);

                try {
                    await firebase.firestore().collection('users').doc(this.currentUser.uid).update({ avatarURL: base64 });
                    document.getElementById('p-avatar').src = base64;
                    Swal.fire('Updated', 'Profile photo updated!', 'success');
                } catch(err) { 
                    console.error(err); 
                    Swal.fire('Error', 'Failed to upload photo', 'error');
                }
            };
        };
    }

    async handleEditProfile(e) {
        e.preventDefault();
        
        // Get form values
        const fullName = document.getElementById('edit-name').value.trim();
        const gamerTag = document.getElementById('edit-tag').value.trim();
        const phone = document.getElementById('edit-phone').value.trim();
        
        // Get platform from radio buttons
        const platformRadio = document.querySelector('input[name="edit-platform"]:checked');
        const platform = platformRadio ? platformRadio.value : '';
        
        // Get institution
        let institution = document.getElementById('edit-institution').value;
        if (institution === 'other') {
            institution = document.getElementById('edit-other-institution').value.trim();
        }

        // Validate all required fields
        if (!fullName || !gamerTag || !phone || !platform || !institution) {
            Swal.fire({
                title: 'Missing Information',
                text: 'All fields are required to update your profile.',
                icon: 'warning',
                confirmButtonColor: '#00ff88'
            });
            return;
        }

        // Show loading
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        try {
            // Prepare data with all required fields
            const profileData = {
                fullName: fullName,
                gamerTag: gamerTag,
                phone: phone,
                platform: platform,
                institution: institution,
                // Keep faculty field for backward compatibility
                faculty: institution,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Add optional fields if they exist
            if (this.currentUser.email) {
                profileData.email = this.currentUser.email;
            }

            // Save to Firestore
            await firebase.firestore().collection('users').doc(this.currentUser.uid).set(profileData, { merge: true });

            // Close modal
            closeEditModal();

            // Reload profile data
            await this.loadUserProfile();
            this.loadOpponentsList(); // Refresh list in case tag changed

            Swal.fire({
                title: 'Success!',
                text: 'Profile updated successfully.',
                icon: 'success',
                confirmButtonColor: '#00ff88',
                timer: 2000,
                timerProgressBar: true
            });

        } catch (err) { 
            console.error('Error saving profile:', err);
            Swal.fire('Error', err.message, 'error'); 
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async reportMatchError(matchId) {
        try {
            const { value: reason } = await Swal.fire({
                title: 'Report Match Error',
                input: 'textarea',
                inputLabel: 'Please describe the issue with this match result:',
                inputPlaceholder: 'e.g., Wrong score, Wrong opponent, Tournament mismatch, etc.',
                inputAttributes: {
                    'aria-label': 'Type your reason here'
                },
                showCancelButton: true,
                confirmButtonText: 'Submit Report',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#ff6b6b',
                inputValidator: (value) => {
                    if (!value || value.trim().length < 5) {
                        return 'Please provide a reason (at least 5 characters)';
                    }
                }
            });

            if (reason) {
                Swal.fire({
                    title: 'Submitting Report...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const db = firebase.firestore();
                await db.collection('matches').doc(matchId).update({
                    status: 'disputed',
                    disputeReason: reason.trim(),
                    disputedBy: this.currentUser.uid,
                    disputedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                Swal.fire({
                    title: 'Report Submitted!',
                    text: 'The Admin has been notified. We will review the issue shortly.',
                    icon: 'success',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#00ff88'
                });

                this.loadMatchHistory();
            }
        } catch (error) {
            console.error('Error reporting match:', error);
            Swal.fire('Error', 'Failed to submit report. Please try again.', 'error');
        }
    }

    async loadMatchHistory() {
        const container = document.getElementById('match-history-list');
        if (!container) return;
        
        try {
            const snapshot = await firebase.firestore().collection('matches')
                .where('userId', '==', this.currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            if (snapshot.empty) {
                container.innerHTML = '<p style="color:#666; text-align:center;">No matches played yet.</p>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const m = doc.data();
                const resultColor = m.myScore > m.oppScore ? '#00ff88' : (m.myScore < m.oppScore ? '#ff6b6b' : '#ffd700');
                const resultClass = m.myScore > m.oppScore ? 'win-border' : (m.myScore < m.oppScore ? 'loss-border' : 'draw-border');
                
                let statusBadge = '';
                if (m.status === 'pending') {
                    statusBadge = ' <span class="status-badge pending">PENDING</span>';
                } else if (m.status === 'approved') {
                    statusBadge = ' <span class="status-badge approved">APPROVED</span>';
                } else if (m.status === 'rejected') {
                    statusBadge = ' <span class="status-badge rejected">REJECTED</span>';
                } else if (m.status === 'disputed') {
                    statusBadge = ' <span class="status-badge rejected">DISPUTED</span>';
                }

                const date = m.timestamp ? m.timestamp.toDate().toLocaleDateString() : 'Unknown date';

                html += `
                    <div class="match-card ${resultClass}" style="border-left: 4px solid ${resultColor};">
                        <div class="match-header">
                            <div>
                                <span class="match-opponent">vs ${m.opponentTag}</span>
                                <div class="match-tournament">${m.tournamentName || 'Friendly'}</div>
                            </div>
                            <div class="match-score">${m.myScore} - ${m.oppScore}</div>
                        </div>
                        <div class="match-details">
                            <span>${date}</span>
                            <span>${statusBadge}</span>
                        </div>`;

                if (m.status === 'approved') {
                    html += `
                        <div style="margin-top: 10px; text-align: right;">
                            <a href="javascript:void(0)" class="report-error-link" data-match-id="${doc.id}" 
                               style="color:#ff6b6b; font-size:0.75rem; text-decoration:none; cursor:pointer;">
                               ⚠️ Report Error
                            </a>
                        </div>`;
                }
                
                html += `</div>`;
            });
            container.innerHTML = html;

            // Add event listeners to the report links
            container.querySelectorAll('.report-error-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const matchId = e.target.getAttribute('data-match-id');
                    this.reportMatchError(matchId);
                });
            });

        } catch (e) { 
            console.error("Match load error:", e); 
            container.innerHTML = '<p style="color:#ff6b6b; text-align:center;">Error loading match history.</p>';
        }
    }

    async loadUserTournaments() {
        const container = document.getElementById('my-tournaments-list');
        if (!container) return;
        try {
            const snapshot = await firebase.firestore().collection('tournamentRegistrations')
                .where('userId', '==', this.currentUser.uid).get();

            if (snapshot.empty) {
                container.innerHTML = '<p style="color:#666; text-align:center;">No tournaments joined.</p>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                let color = data.status === 'approved' ? '#00ff88' : '#ffd700';
                html += `
                    <div style="background:var(--bg-primary); padding:15px; border-radius:12px; border-left:4px solid ${color}; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 style="margin:0; color:#fff;">${data.tournamentName}</h4>
                            <span style="color:#aaa; font-size:0.8rem;">${data.status.toUpperCase()}</span>
                        </div>
                        <a href="tournament-details.html?id=${data.tournamentId}" class="btn btn-outline btn-sm">View</a>
                    </div>`;
            });
            container.innerHTML = html;
        } catch (e) { 
            console.error(e); 
            container.innerHTML = '<p style="color:#ff6b6b; text-align:center;">Error loading tournaments.</p>';
        }
    }

    setupEventListeners() {
        const fileInput = document.getElementById('avatar-input');
        if (fileInput) fileInput.addEventListener('change', (e) => this.handleAvatarUpload(e));

        const editForm = document.getElementById('edit-profile-form');
        if (editForm) editForm.addEventListener('submit', (e) => this.handleEditProfile(e));
    }
}

// Modal close functions
function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Initialize ProfileManager
document.addEventListener('DOMContentLoaded', () => { 
    window.profileManager = new ProfileManager(); 
});