// UON HUB/js/tournaments.js
class TournamentsManager {
    constructor() {
        this.tournaments = [];
        this.currentUser = null;
        this.userRegistrations = {}; // Map of tournamentId -> status
        this.init();
    }

    init() {
        // Wait for Auth to be ready before loading data
        firebase.auth().onAuthStateChanged(user => {
            this.currentUser = user;
            this.loadTournaments();
        });
    }

    async loadTournaments() {
        const container = document.getElementById('tournaments-container');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-spinner large"></div><p style="text-align:center">Loading tournaments...</p>';

        try {
            const db = firebase.firestore();
            
            // 1. Fetch User Registrations (if logged in)
            if (this.currentUser) {
                const regSnapshot = await db.collection('tournamentRegistrations')
                    .where('userId', '==', this.currentUser.uid)
                    .get();
                
                regSnapshot.forEach(doc => {
                    const data = doc.data();
                    // Store status (pending, approved, rejected)
                    this.userRegistrations[data.tournamentId] = data.status;
                });
            }

            // 2. Fetch Tournaments
            const snapshot = await db.collection('tournaments')
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) {
                container.innerHTML = '<div style="text-align: center; padding: 3rem;"><h3>No Active Tournaments</h3></div>';
                return;
            }

            this.tournaments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderTournaments();
        } catch (error) {
            console.error("Error:", error);
            container.innerHTML = '<p style="text-align:center; color:red">Failed to load data.</p>';
        }
    }

    renderTournaments() {
        const container = document.getElementById('tournaments-container');
        container.innerHTML = this.tournaments.map(t => this.renderTournamentCard(t)).join('');
        
        // Update participant counts dynamically
        this.tournaments.forEach(t => this.updateParticipantCount(t.id, t.maxParticipants));
    }

    renderTournamentCard(t) {
        let statusClass = 'live'; 
        let statusText = t.status === 'active' ? 'Registration Open' : t.status;
        
        const dateStr = t.startDate ? new Date(t.startDate.seconds * 1000).toLocaleDateString() : 'TBA';
        const timeStr = t.matchTime || 'TBA';

        // --- BUTTON LOGIC ---
        let buttonHtml = `<button onclick="window.tournamentsManager.applyForTournament('${t.id}', '${t.name.replace(/'/g, "\\'")}')" class="btn btn-primary" style="flex: 1;">Request to Join</button>`;
        
        // 1. Check User Status
        const userStatus = this.userRegistrations[t.id];
        if (userStatus === 'approved') {
            buttonHtml = `<button class="btn btn-outline" disabled style="flex: 1; border-color: #00ff88; color: #00ff88;">✅ Registered</button>`;
        } else if (userStatus === 'pending') {
            buttonHtml = `<button class="btn btn-outline" disabled style="flex: 1; border-color: var(--gold); color: var(--gold);">⏳ Pending</button>`;
        }

        return `
            <div class="tournament-card featured" id="card-${t.id}">
                <div class="tournament-header">
                    <div class="tournament-badge">Official</div>
                    <div class="tournament-status ${statusClass}">${statusText}</div>
                </div>
                <div class="tournament-content">
                    <h3 class="tournament-name">${t.name}</h3>
                    <p class="tournament-description">${t.description ? t.description.substring(0, 80) + '...' : ''}</p>
                    
                    <div class="tournament-details">
                        <div class="detail"><span class="detail-label">Platform:</span><span class="detail-value">${t.platform}</span></div>
                        <div class="detail"><span class="detail-label">Start:</span><span class="detail-value">${dateStr} @ ${timeStr}</span></div>
                        <div class="detail"><span class="detail-label">Registered:</span><span class="detail-value" id="count-${t.id}">...</span></div>
                    </div>

                    <div class="tournament-actions" style="display: flex; gap: 10px; margin-top: 15px;">
                        ${buttonHtml}
                        <a href="tournament-details.html?id=${t.id}" class="btn btn-secondary" style="flex: 1; text-align: center;">View Details</a>
                    </div>
                </div>
            </div>
        `;
    }

    async updateParticipantCount(tournamentId, max) {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('tournamentRegistrations')
                .where('tournamentId', '==', tournamentId)
                .where('status', '==', 'approved')
                .get();

            const count = snapshot.size;
            const el = document.getElementById(`count-${tournamentId}`);
            if (el) el.textContent = `${count}/${max}`;

            // Check if Full
            if (count >= max) {
                // If full AND user is not registered, disable join button
                const userStatus = this.userRegistrations[tournamentId];
                if (userStatus !== 'approved' && userStatus !== 'pending') {
                    const card = document.getElementById(`card-${tournamentId}`);
                    if (card) {
                        const btn = card.querySelector('.btn-primary');
                        if (btn) {
                            btn.textContent = "⛔ Full";
                            btn.disabled = true;
                            btn.style.backgroundColor = "#333";
                            btn.style.borderColor = "#333";
                        }
                    }
                }
            }
        } catch (e) { 
            console.error("Error updating participant count:", e); 
        }
    }

    async applyForTournament(tournamentId, tournamentName) {
        const user = firebase.auth().currentUser;
        if (!user) {
            Swal.fire({ 
                title: 'Login Required', 
                text: 'Please login to join.', 
                icon: 'warning', 
                confirmButtonText: 'Login' 
            }).then((r) => { 
                if (r.isConfirmed) window.location.href = 'login.html'; 
            });
            return;
        }

        try {
            const db = firebase.firestore();
            
            // Check if user already applied
            const existing = await db.collection('tournamentRegistrations')
                .where('tournamentId', '==', tournamentId)
                .where('userId', '==', user.uid)
                .get();

            if (!existing.empty) {
                Swal.fire({
                    title: 'Application Exists',
                    text: 'You have already sent a request for this tournament. Please wait for admin approval.',
                    icon: 'info',
                    confirmButtonColor: '#00ff88'
                });
                return;
            }

            // Get user profile
            const profileDoc = await db.collection('users').doc(user.uid).get();
            const profile = profileDoc.exists ? profileDoc.data() : {};

            // Check if institution AND platform are properly set
            const hasValidInstitution = profile.institution && 
                                       profile.institution !== 'Not Specified' && 
                                       profile.institution.trim() !== '';
            
            const hasValidPlatform = profile.platform && 
                                    profile.platform !== 'Not Specified' && 
                                    profile.platform.trim() !== '';

            // User must have both institution AND platform
            if (!hasValidInstitution || !hasValidPlatform) {
                Swal.fire({
                    title: 'Profile Incomplete',
                    text: 'Arena Citizen! You must complete your profile (Institution & Platform) before joining a tournament.',
                    icon: 'error',
                    confirmButtonText: 'Complete Profile',
                    confirmButtonColor: '#00ff88'
                }).then((result) => {
                    if (result.isConfirmed) window.location.href = 'profile.html';
                });
                return;
            }

            // Submit application with institution and platform included
            await db.collection('tournamentRegistrations').add({
                tournamentId,
                tournamentName,
                userId: user.uid,
                userDisplayName: profile.fullName || user.email,
                gamerTag: profile.gamerTag || 'No Tag',
                institution: profile.institution,
                platform: profile.platform,
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update UI immediately
            this.userRegistrations[tournamentId] = 'pending';
            
            // Re-render just this card instead of all tournaments for better performance
            const card = document.getElementById(`card-${tournamentId}`);
            if (card) {
                const btn = card.querySelector('.btn-primary');
                if (btn) {
                    btn.outerHTML = `<button class="btn btn-outline" disabled style="flex: 1; border-color: var(--gold); color: var(--gold);">⏳ Pending</button>`;
                }
            }

            Swal.fire({ 
                title: 'Request Sent!', 
                text: 'Waiting for admin approval.', 
                icon: 'success', 
                confirmButtonColor: '#00ff88' 
            });

        } catch (e) {
            console.error('Application error:', e);
            Swal.fire('Error', 'Could not send application: ' + e.message, 'error');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.tournamentsManager = new TournamentsManager();
});