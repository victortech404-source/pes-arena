// UON HUB/js/tournament-details.js

class TournamentDetailsManager {
    constructor() {
        this.tournamentId = this.getTournamentIdFromUrl();
        this.tournament = null;
        this.currentUser = null;
        this.participants = [];
        this.userMatches = [];
        this.isApprovedParticipant = false;
        this.init();
    }

    getTournamentIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    async init() {
        if (!this.tournamentId) {
            this.showError('No tournament ID provided');
            return;
        }

        // Wait for auth state
        firebase.auth().onAuthStateChanged(async (user) => {
            this.currentUser = user;
            await this.loadTournamentData();
            this.setupEventListeners();
        });
    }

    async loadTournamentData() {
        try {
            const db = firebase.firestore();
            
            // Load tournament details
            const tournamentDoc = await db.collection('tournaments').doc(this.tournamentId).get();
            
            if (!tournamentDoc.exists) {
                this.showError('Tournament not found');
                return;
            }

            this.tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };
            
            // Load approved participants
            await this.loadParticipants();
            
            // Check if current user is an approved participant
            await this.checkUserParticipantStatus();
            
            // Load matches for this tournament
            await this.loadMatches();
            
            // Render the tournament details
            this.renderTournamentDetails();
            
        } catch (error) {
            console.error('Error loading tournament:', error);
            this.showError('Failed to load tournament details');
        }
    }

    async loadParticipants() {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('tournamentRegistrations')
                .where('tournamentId', '==', this.tournamentId)
                .where('status', '==', 'approved')
                .get();

            this.participants = snapshot.docs.map(doc => ({
                id: doc.id,
                userId: doc.data().userId,
                displayName: doc.data().userDisplayName || 'Unknown Player',
                gamerTag: doc.data().gamerTag || 'No Tag',
                institution: doc.data().institution || 'Not Specified',
                platform: doc.data().platform || 'Not Specified'
            }));

            // Update participant count in UI
            const countElement = document.getElementById('participant-count');
            if (countElement) {
                countElement.textContent = `${this.participants.length}/${this.tournament.maxParticipants || '?'}`;
            }

        } catch (error) {
            console.error('Error loading participants:', error);
        }
    }

    async checkUserParticipantStatus() {
        if (!this.currentUser) {
            this.isApprovedParticipant = false;
            return;
        }

        this.isApprovedParticipant = this.participants.some(p => p.userId === this.currentUser.uid);
        
        // Show/hide report score button based on status
        const reportBtn = document.getElementById('report-score-btn');
        if (reportBtn) {
            reportBtn.style.display = this.isApprovedParticipant ? 'block' : 'none';
        }
    }

    async loadMatches() {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('matches')
                .where('tournamentId', '==', this.tournamentId)
                .orderBy('createdAt', 'desc')
                .get();

            this.userMatches = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.renderMatches();

        } catch (error) {
            console.error('Error loading matches:', error);
        }
    }

    renderTournamentDetails() {
        // Update page title
        document.title = `${this.tournament.name} - Tournament Details`;
        
        // Update tournament name
        const nameElement = document.getElementById('tournament-name');
        if (nameElement) nameElement.textContent = this.tournament.name;
        
        // Update tournament description
        const descElement = document.getElementById('tournament-description');
        if (descElement) descElement.textContent = this.tournament.description || 'No description available';
        
        // Update tournament details
        const dateStr = this.tournament.startDate ? 
            new Date(this.tournament.startDate.seconds * 1000).toLocaleDateString() : 'TBA';
        
        const detailsElement = document.getElementById('tournament-details');
        if (detailsElement) {
            detailsElement.innerHTML = `
                <div class="detail-item"><strong>Platform:</strong> ${this.tournament.platform || 'TBA'}</div>
                <div class="detail-item"><strong>Start Date:</strong> ${dateStr}</div>
                <div class="detail-item"><strong>Match Time:</strong> ${this.tournament.matchTime || 'TBA'}</div>
                <div class="detail-item"><strong>Format:</strong> ${this.tournament.format || 'Single Elimination'}</div>
                <div class="detail-item"><strong>Prize Pool:</strong> ${this.tournament.prize || 'TBA'}</div>
            `;
        }

        // Render participants list
        this.renderParticipantsList();
    }

    renderParticipantsList() {
        const container = document.getElementById('participants-list');
        if (!container) return;

        if (this.participants.length === 0) {
            container.innerHTML = '<p class="no-participants">No approved participants yet</p>';
            return;
        }

        container.innerHTML = this.participants.map(p => `
            <div class="participant-card">
                <div class="participant-info">
                    <span class="participant-name">${p.displayName}</span>
                    <span class="participant-gamertag">${p.gamerTag}</span>
                </div>
                <div class="participant-details">
                    <span class="participant-institution">${p.institution}</span>
                    <span class="participant-platform">${p.platform}</span>
                </div>
            </div>
        `).join('');
    }

    renderMatches() {
        const container = document.getElementById('matches-list');
        if (!container) return;

        if (this.userMatches.length === 0) {
            container.innerHTML = '<p class="no-matches">No matches reported yet</p>';
            return;
        }

        container.innerHTML = this.userMatches.map(match => this.renderMatchCard(match)).join('');
    }

    renderMatchCard(match) {
        const player1 = this.getParticipantName(match.player1Id);
        const player2 = this.getParticipantName(match.player2Id);
        
        let statusBadge = '';
        let disputeButton = '';
        
        if (match.status === 'pending') {
            statusBadge = '<span class="badge pending">Pending</span>';
        } else if (match.status === 'approved') {
            statusBadge = '<span class="badge approved">Approved</span>';
        } else if (match.status === 'disputed') {
            statusBadge = '<span class="badge disputed">Disputed</span>';
        }

        // Show dispute button if user is involved and match is not already disputed/approved
        if (this.currentUser && 
            (match.player1Id === this.currentUser.uid || match.player2Id === this.currentUser.uid) &&
            match.status === 'pending') {
            disputeButton = `<button onclick="window.tournamentDetails.disputeMatch('${match.id}')" class="btn-dispute">Dispute</button>`;
        }

        return `
            <div class="match-card" id="match-${match.id}">
                <div class="match-header">
                    <span class="match-date">${match.date ? new Date(match.date.seconds * 1000).toLocaleDateString() : 'Date TBA'}</span>
                    ${statusBadge}
                </div>
                <div class="match-content">
                    <div class="player player1 ${match.winner === match.player1Id ? 'winner' : ''}">
                        <span class="player-name">${player1}</span>
                        <span class="player-score">${match.player1Score || 0}</span>
                    </div>
                    <div class="vs">VS</div>
                    <div class="player player2 ${match.winner === match.player2Id ? 'winner' : ''}">
                        <span class="player-score">${match.player2Score || 0}</span>
                        <span class="player-name">${player2}</span>
                    </div>
                </div>
                <div class="match-footer">
                    ${disputeButton}
                </div>
            </div>
        `;
    }

    getParticipantName(userId) {
        const participant = this.participants.find(p => p.userId === userId);
        return participant ? participant.displayName : 'Unknown Player';
    }

    setupEventListeners() {
        const reportBtn = document.getElementById('report-score-btn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => this.showReportScoreModal());
        }

        const modal = document.getElementById('report-score-modal');
        if (modal) {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hideModal());
            }

            const form = document.getElementById('report-score-form');
            if (form) {
                form.addEventListener('submit', (e) => this.handleReportScoreSubmit(e));
            }
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal();
            }
        });
    }

    showReportScoreModal() {
        this.populateOpponentDropdown();
        const modal = document.getElementById('report-score-modal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    populateOpponentDropdown() {
        const select = document.getElementById('opponent-select');
        if (!select || !this.currentUser) return;

        // Filter out current user from opponents list
        const opponents = this.participants.filter(p => p.userId !== this.currentUser.uid);

        if (opponents.length === 0) {
            select.innerHTML = '<option value="">No opponents available</option>';
            return;
        }

        select.innerHTML = '<option value="">Select Opponent</option>' + 
            opponents.map(p => `<option value="${p.userId}">${p.displayName} (${p.gamerTag})</option>`).join('');
    }

    async handleReportScoreSubmit(e) {
        e.preventDefault();

        if (!this.currentUser) {
            Swal.fire('Error', 'You must be logged in', 'error');
            return;
        }

        const opponentId = document.getElementById('opponent-select').value;
        const player1Score = parseInt(document.getElementById('player1-score').value);
        const player2Score = parseInt(document.getElementById('player2-score').value);
        const matchDate = document.getElementById('match-date').value;

        if (!opponentId || isNaN(player1Score) || isNaN(player2Score) || !matchDate) {
            Swal.fire('Error', 'Please fill all fields', 'error');
            return;
        }

        // Determine winner
        let winner = null;
        if (player1Score > player2Score) winner = this.currentUser.uid;
        else if (player2Score > player1Score) winner = opponentId;

        try {
            const db = firebase.firestore();
            
            // Check if match already exists between these players in this tournament
            const existingMatch = await db.collection('matches')
                .where('tournamentId', '==', this.tournamentId)
                .where('player1Id', 'in', [this.currentUser.uid, opponentId])
                .where('player2Id', 'in', [this.currentUser.uid, opponentId])
                .get();

            if (!existingMatch.empty) {
                Swal.fire('Error', 'A match between these players already exists in this tournament', 'error');
                return;
            }

            // Submit match with tournamentId
            await db.collection('matches').add({
                tournamentId: this.tournamentId,
                tournamentName: this.tournament.name,
                player1Id: this.currentUser.uid,
                player2Id: opponentId,
                player1Name: this.getParticipantName(this.currentUser.uid),
                player2Name: this.getParticipantName(opponentId),
                player1Score: player1Score,
                player2Score: player2Score,
                winner: winner,
                status: 'pending',
                date: firebase.firestore.Timestamp.fromDate(new Date(matchDate)),
                reportedBy: this.currentUser.uid,
                reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
                disputes: []
            });

            this.hideModal();
            document.getElementById('report-score-form').reset();
            
            // Reload matches
            await this.loadMatches();
            
            Swal.fire({
                title: 'Success!',
                text: 'Match reported successfully. Waiting for approval.',
                icon: 'success',
                confirmButtonColor: '#00ff88'
            });

        } catch (error) {
            console.error('Error reporting match:', error);
            Swal.fire('Error', 'Failed to report match: ' + error.message, 'error');
        }
    }

    async disputeMatch(matchId) {
        if (!this.currentUser) {
            Swal.fire('Error', 'You must be logged in', 'error');
            return;
        }

        const result = await Swal.fire({
            title: 'Dispute Match',
            text: 'Are you sure you want to dispute this match? The tournament organizer will be notified.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff4444',
            cancelButtonColor: '#666',
            confirmButtonText: 'Yes, dispute it'
        });

        if (result.isConfirmed) {
            try {
                const db = firebase.firestore();
                const matchRef = db.collection('matches').doc(matchId);
                
                await matchRef.update({
                    status: 'disputed',
                    disputedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    disputedBy: this.currentUser.uid
                });

                // Create notification for tournament organizer
                await this.notifyOrganizer(matchId);

                // Update the match in UI
                const matchCard = document.getElementById(`match-${matchId}`);
                if (matchCard) {
                    const badge = matchCard.querySelector('.badge');
                    if (badge) {
                        badge.className = 'badge disputed';
                        badge.textContent = 'Disputed';
                    }
                    
                    const disputeBtn = matchCard.querySelector('.btn-dispute');
                    if (disputeBtn) {
                        disputeBtn.remove();
                    }
                }

                Swal.fire({
                    title: 'Disputed!',
                    text: 'The match has been disputed. The organizer will review it.',
                    icon: 'success',
                    confirmButtonColor: '#00ff88'
                });

            } catch (error) {
                console.error('Error disputing match:', error);
                Swal.fire('Error', 'Failed to dispute match', 'error');
            }
        }
    }

    async notifyOrganizer(matchId) {
        try {
            const db = firebase.firestore();
            
            // Find tournament organizer (in a real app, you'd have a designated organizer)
            // For now, we'll notify admins or users with organizer role
            const usersSnapshot = await db.collection('users')
                .where('isOrganizer', '==', true)
                .get();

            const notifications = usersSnapshot.docs.map(doc => ({
                userId: doc.id,
                matchId: matchId,
                tournamentId: this.tournamentId,
                tournamentName: this.tournament.name,
                type: 'match_disputed',
                message: `A match in ${this.tournament.name} has been disputed`,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }));

            // Batch write notifications
            const batch = db.batch();
            notifications.forEach(notification => {
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, notification);
            });
            
            await batch.commit();

        } catch (error) {
            console.error('Error notifying organizer:', error);
        }
    }

    hideModal() {
        const modal = document.getElementById('report-score-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showError(message) {
        const container = document.querySelector('.tournament-details-container');
        if (container) {
            container.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.tournamentDetails = new TournamentDetailsManager();
});