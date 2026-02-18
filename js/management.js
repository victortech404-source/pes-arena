// PES ARENA Management Page JavaScript
class TournamentManager {
    constructor() {
        this.db = firebase.firestore();
        this.currentUser = null;
        this.selectedTournament = null;
        this.tournaments = [];
        this.players = [];
        
        this.init();
    }

    async init() {
        // Wait for auth state
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadTournaments();
                this.setupEventListeners();
            }
        });
    }

    async loadTournaments() {
        const container = document.getElementById('my-tournaments-list');
        
        try {
            // Query tournaments where user is creator
            const snapshot = await this.db.collection('tournaments')
                .where('creatorUid', '==', this.currentUser.uid)
                .orderBy('createdAt', 'desc')
                .get();

            this.tournaments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.renderTournaments();
        } catch (error) {
            console.error('Error loading tournaments:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <h3>Error Loading Tournaments</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" class="create-tournament-btn">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    renderTournaments() {
        const container = document.getElementById('my-tournaments-list');
        
        if (this.tournaments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏆</div>
                    <h3>No Tournaments Yet</h3>
                    <p>You haven't created any tournaments. Start by creating your first arena!</p>
                    <a href="create-tournament.html" class="create-tournament-btn">
                        + Create Your First Tournament
                    </a>
                </div>
            `;
            return;
        }

        let html = '<div class="tournament-grid">';
        
        this.tournaments.forEach(tournament => {
            const status = tournament.status || 'pending';
            const statusClass = `status-${status.toLowerCase()}`;
            
            // Format dates
            const startDate = tournament.startDate?.toDate?.() || new Date();
            const endDate = tournament.endDate?.toDate?.() || new Date();
            
            // Calculate participants
            const participantsCount = tournament.participants?.length || 0;
            const maxPlayers = tournament.maxPlayers || 16;
            
            // Check if winners have been nominated
            const hasNominatedWinners = tournament.winnersNominated && 
                                       tournament.winnersNominated.first && 
                                       tournament.winnersNominated.second && 
                                       tournament.winnersNominated.third;
            
            // Check payout status
            const payoutAuthorized = tournament.payoutAuthorized === true;
            const payoutProcessed = tournament.payoutProcessed === true;
            
            html += `
                <div class="tournament-card" data-id="${tournament.id}">
                    <div class="tournament-header">
                        <span class="tournament-name">${tournament.name || 'Unnamed Tournament'}</span>
                        <span class="tournament-status ${statusClass}">${status.toUpperCase()}</span>
                    </div>
                    <div class="tournament-details">
                        <p><i>📅</i> ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
                        <p><i>🎮</i> ${tournament.format || 'Single Elimination'}</p>
                        <p><i>💰</i> Prize Pool: $${tournament.prizePool || '0'}</p>
                        ${hasNominatedWinners ? '<p><i>✅</i> Winners Nominated</p>' : ''}
                        ${payoutAuthorized ? '<p><i>💚</i> Payout Authorized</p>' : ''}
                        ${payoutProcessed ? '<p><i>💚</i> Payout Processed</p>' : ''}
                    </div>
                    <div class="tournament-stats">
                        <span><i>👥</i> ${participantsCount}/${maxPlayers}</span>
                        <span><i>⚡</i> ${tournament.matches?.length || 0} Matches</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add click listeners to tournament cards
        document.querySelectorAll('.tournament-card').forEach(card => {
            card.addEventListener('click', () => this.selectTournament(card.dataset.id));
        });
    }

    async selectTournament(tournamentId) {
        // Remove selected class from all cards
        document.querySelectorAll('.tournament-card').forEach(c => {
            c.classList.remove('selected');
        });
        
        // Add selected class to clicked card
        const selectedCard = document.querySelector(`.tournament-card[data-id="${tournamentId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        // Find the tournament
        this.selectedTournament = this.tournaments.find(t => t.id === tournamentId);
        
        if (this.selectedTournament) {
            // Update header
            document.getElementById('selected-tournament-title').textContent = 
                this.selectedTournament.name || 'Tournament Management';
            
            const statusBadge = document.getElementById('selected-tournament-status');
            statusBadge.textContent = `Status: ${this.selectedTournament.status || 'PENDING'}`;
            statusBadge.style.color = this.getStatusColor(this.selectedTournament.status);
            
            // Show management tools
            document.getElementById('management-tools').classList.add('visible');
            
            // Load players for this tournament
            await this.loadTournamentPlayers(tournamentId);
            
            // Update WhatsApp link
            this.updateWhatsAppDisplay();
            
            // Update winner nomination section visibility
            this.updateWinnerSectionVisibility();
        }
    }

    getStatusColor(status) {
        switch(status?.toLowerCase()) {
            case 'active': return '#00ff88';
            case 'pending': return '#ffc107';
            case 'finished': return '#6c757d';
            default: return '#00ff88';
        }
    }

    async loadTournamentPlayers(tournamentId) {
        const tableBody = document.getElementById('players-table-body');
        
        try {
            // Get tournament participants with user details
            const tournament = this.selectedTournament;
            const participants = tournament.participants || [];
            
            if (participants.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-secondary);">
                            No players registered yet
                        </td>
                    </tr>
                `;
                return;
            }

            // Fetch user details for each participant
            const playerPromises = participants.map(async (uid) => {
                const userDoc = await this.db.collection('users').doc(uid).get();
                return { uid, ...userDoc.data() };
            });
            
            this.players = await Promise.all(playerPromises);
            
            let html = '';
            this.players.forEach((player, index) => {
                const registeredDate = player.registeredAt?.toDate?.() || new Date();
                
                // Check if this player is nominated as a winner
                const isFirst = this.selectedTournament.winnersNominated?.first === player.uid;
                const isSecond = this.selectedTournament.winnersNominated?.second === player.uid;
                const isThird = this.selectedTournament.winnersNominated?.third === player.uid;
                
                let winnerBadge = '';
                if (isFirst) winnerBadge = '<span style="color: gold; margin-left: 8px;">👑 1st</span>';
                else if (isSecond) winnerBadge = '<span style="color: silver; margin-left: 8px;">🥈 2nd</span>';
                else if (isThird) winnerBadge = '<span style="color: #cd7f32; margin-left: 8px;">🥉 3rd</span>';
                
                html += `
                    <tr>
                        <td>${player.displayName || 'Unknown'} ${winnerBadge}</td>
                        <td>${player.gamerTag || 'Not set'}</td>
                        <td>
                            <span class="player-status status-confirmed">Confirmed</span>
                        </td>
                        <td>${registeredDate.toLocaleDateString()}</td>
                        <td>
                            ${this.selectedTournament.status === 'finished' && !this.selectedTournament.winnersNominated ? 
                                `<button class="nominate-winner-btn" data-uid="${player.uid}" data-name="${player.gamerTag || player.displayName}" style="padding: 4px 8px; background: #00ff88; color: #1a1a2e; border: none; border-radius: 4px; cursor: pointer;">Nominate</button>` 
                                : ''}
                        </td>
                    </tr>
                `;
            });
            
            tableBody.innerHTML = html;
            
            // Add event listeners to nominate buttons
            if (this.selectedTournament.status === 'finished' && !this.selectedTournament.winnersNominated) {
                document.querySelectorAll('.nominate-winner-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.openWinnerNomination(btn.dataset.uid, btn.dataset.name);
                    });
                });
            }
            
        } catch (error) {
            console.error('Error loading players:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: #ff6b6b;">
                        Error loading players: ${error.message}
                    </td>
                </tr>
            `;
        }
    }

    updateWhatsAppDisplay() {
        const linkDisplay = document.getElementById('current-whatsapp-link');
        const linkInput = document.getElementById('whatsapp-link-input');
        
        if (this.selectedTournament.whatsappLink) {
            linkDisplay.innerHTML = `
                Current link: <a href="${this.selectedTournament.whatsappLink}" target="_blank">${this.selectedTournament.whatsappLink}</a>
            `;
            linkInput.value = this.selectedTournament.whatsappLink;
        } else {
            linkDisplay.innerHTML = 'Current link: Not set';
            linkInput.value = '';
        }
    }

    updateWinnerSectionVisibility() {
        // Check if we need to show/hide winner nomination UI
        const nominationSection = document.getElementById('winner-nomination-section');
        if (!nominationSection) return;
        
        if (this.selectedTournament.status === 'finished' && !this.selectedTournament.winnersNominated) {
            nominationSection.style.display = 'block';
        } else if (this.selectedTournament.winnersNominated) {
            nominationSection.style.display = 'block';
            // Show the nominated winners
            this.displayNominatedWinners();
        } else {
            nominationSection.style.display = 'none';
        }
    }

    displayNominatedWinners() {
        const winners = this.selectedTournament.winnersNominated;
        if (!winners) return;
        
        const container = document.getElementById('nominated-winners-display');
        if (!container) return;
        
        // Fetch winner details
        Promise.all([
            this.db.collection('users').doc(winners.first).get(),
            this.db.collection('users').doc(winners.second).get(),
            this.db.collection('users').doc(winners.third).get()
        ]).then(([firstDoc, secondDoc, thirdDoc]) => {
            const first = firstDoc.data();
            const second = secondDoc.data();
            const third = thirdDoc.data();
            
            container.innerHTML = `
                <div style="background: rgba(0,255,136,0.1); padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="color: #00ff88; margin-bottom: 10px;">🏆 Nominated Winners</h4>
                    <div style="display: grid; grid-template-columns: repeat(3,1fr); gap: 10px;">
                        <div style="text-align: center;">
                            <div style="color: gold; font-size: 1.5rem;">👑</div>
                            <div><strong>${first.gamerTag || first.displayName}</strong></div>
                            <div style="color: gold;">1st Place</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: silver; font-size: 1.5rem;">🥈</div>
                            <div><strong>${second.gamerTag || second.displayName}</strong></div>
                            <div style="color: silver;">2nd Place</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #cd7f32; font-size: 1.5rem;">🥉</div>
                            <div><strong>${third.gamerTag || third.displayName}</strong></div>
                            <div style="color: #cd7f32;">3rd Place</div>
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
                        <p style="color: ${this.selectedTournament.payoutAuthorized ? '#00ff88' : '#ffc107'};">
                            ${this.selectedTournament.payoutAuthorized ? 
                                '✅ Payout Authorized by Admin' : 
                                '⏳ Awaiting Admin Authorization'}
                        </p>
                        ${this.selectedTournament.payoutProcessed ? 
                            '<p style="color: #00ff88;">💰 Payout Processed</p>' : ''}
                    </div>
                </div>
            `;
        });
    }

    openWinnerNomination(playerUid, playerName) {
        // Create modal or prompt for winner position
        const position = prompt(`Select position for ${playerName}:\n1 - First Place (Champion)\n2 - Second Place\n3 - Third Place`, '1');
        
        if (!position) return;
        
        const positionNum = parseInt(position);
        if (isNaN(positionNum) || positionNum < 1 || positionNum > 3) {
            alert('Please enter a valid position (1, 2, or 3)');
            return;
        }
        
        // Initialize winnersNominated object if it doesn't exist
        if (!this.selectedTournament.winnersNominated) {
            this.selectedTournament.winnersNominated = {};
        }
        
        // Check if position is already taken
        const positionMap = {1: 'first', 2: 'second', 3: 'third'};
        const posKey = positionMap[positionNum];
        
        if (this.selectedTournament.winnersNominated[posKey]) {
            if (!confirm(`Position ${positionNum} is already taken. Replace existing nominee?`)) {
                return;
            }
        }
        
        // Set the nominee
        this.selectedTournament.winnersNominated[posKey] = playerUid;
        
        // Check if all positions are filled
        const allFilled = this.selectedTournament.winnersNominated.first && 
                         this.selectedTournament.winnersNominated.second && 
                         this.selectedTournament.winnersNominated.third;
        
        if (allFilled) {
            this.submitWinnerNominations();
        } else {
            // Update display to show progress
            this.showToast(`Position ${positionNum} nominated. ${3 - Object.keys(this.selectedTournament.winnersNominated).length} positions remaining.`);
            this.loadTournamentPlayers(this.selectedTournament.id); // Refresh to show updated buttons
        }
    }

    async submitWinnerNominations() {
        if (!this.selectedTournament.winnersNominated.first || 
            !this.selectedTournament.winnersNominated.second || 
            !this.selectedTournament.winnersNominated.third) {
            alert('Please nominate all three winners first');
            return;
        }
        
        try {
            // Update tournament with nominated winners
            await this.db.collection('tournaments').doc(this.selectedTournament.id).update({
                winnersNominated: this.selectedTournament.winnersNominated,
                nominationTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'completed' // Mark as completed but awaiting payout
            });
            
            // Send notification to super admins
            await this.notifySuperAdmins();
            
            // Show success message
            this.showToast('Winners nominated successfully! Notification sent to administrators.');
            
            // Refresh tournament data
            await this.loadTournaments();
            await this.selectTournament(this.selectedTournament.id);
            
        } catch (error) {
            console.error('Error submitting winners:', error);
            this.showToast('Failed to submit winners: ' + error.message, 'error');
        }
    }

    async notifySuperAdmins() {
        try {
            // Find all super admins
            const adminsSnapshot = await this.db.collection('users')
                .where('role', '==', 'superAdmin')
                .get();
            
            const admins = adminsSnapshot.docs.map(doc => doc.id);
            
            if (admins.length === 0) {
                console.log('No super admins found to notify');
                return;
            }
            
            // Create notification for each admin
            const notificationPromises = admins.map(adminUid => {
                return this.db.collection('notifications').add({
                    userId: adminUid,
                    type: 'payout_request',
                    title: '💰 Payout Request',
                    message: `Tournament "${this.selectedTournament.name}" has finished. Winners are ready for payout authorization.`,
                    tournamentId: this.selectedTournament.id,
                    tournamentName: this.selectedTournament.name,
                    winners: this.selectedTournament.winnersNominated,
                    read: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    actionUrl: `/boardroom.html?tournament=${this.selectedTournament.id}&action=payout`
                });
            });
            
            await Promise.all(notificationPromises);
            
            // Also create a system notification
            await this.db.collection('system_notifications').add({
                type: 'payout_request',
                tournamentId: this.selectedTournament.id,
                tournamentName: this.selectedTournament.name,
                organizers: [this.currentUser.uid],
                winners: this.selectedTournament.winnersNominated,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });
            
            console.log('Super admins notified successfully');
            
        } catch (error) {
            console.error('Error notifying super admins:', error);
            throw error;
        }
    }

    async updateWhatsAppLink() {
        if (!this.selectedTournament) {
            this.showToast('Please select a tournament first', 'error');
            return;
        }
        
        const linkInput = document.getElementById('whatsapp-link-input');
        const newLink = linkInput.value.trim();
        
        try {
            await this.db.collection('tournaments').doc(this.selectedTournament.id).update({
                whatsappLink: newLink,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update local data
            this.selectedTournament.whatsappLink = newLink;
            
            // Update display
            this.updateWhatsAppDisplay();
            this.showToast('WhatsApp link updated successfully!');
            
        } catch (error) {
            console.error('Error updating WhatsApp link:', error);
            this.showToast('Failed to update link: ' + error.message, 'error');
        }
    }

    async generateFixtures() {
        if (!this.selectedTournament) {
            this.showToast('Please select a tournament first', 'error');
            return;
        }
        
        try {
            this.showToast('Generating fixtures...', 'info');
            
            // Call Firebase Function to generate fixtures
            const generateFixtures = firebase.functions().httpsCallable('generateTournamentFixtures');
            const result = await generateFixtures({ tournamentId: this.selectedTournament.id });
            
            if (result.data.success) {
                this.showToast('Fixtures generated successfully!');
                
                // Refresh tournament data
                await this.loadTournaments();
                await this.selectTournament(this.selectedTournament.id);
            }
            
        } catch (error) {
            console.error('Error generating fixtures:', error);
            this.showToast('Failed to generate fixtures: ' + error.message, 'error');
        }
    }

    async markTournamentFinished() {
        if (!this.selectedTournament) {
            this.showToast('Please select a tournament first', 'error');
            return;
        }
        
        if (!confirm('Are you sure you want to mark this tournament as finished? This will trigger Chiromo Mode analytics and finalize rankings.')) {
            return;
        }
        
        try {
            this.showToast('Finalizing tournament...', 'info');
            
            // Call Firebase Function to finish tournament
            const finishTournament = firebase.functions().httpsCallable('finishTournament');
            const result = await finishTournament({ tournamentId: this.selectedTournament.id });
            
            if (result.data.success) {
                this.showToast('Tournament finished successfully! Chiromo Mode analytics calculated.');
                
                // Refresh tournament data
                await this.loadTournaments();
                await this.selectTournament(this.selectedTournament.id);
                
                // Show winner nomination section
                document.getElementById('winner-nomination-section').style.display = 'block';
            }
            
        } catch (error) {
            console.error('Error finishing tournament:', error);
            this.showToast('Failed to finish tournament: ' + error.message, 'error');
        }
    }

    async exportPlayers() {
        if (!this.selectedTournament) {
            this.showToast('Please select a tournament first', 'error');
            return;
        }
        
        try {
            const participants = this.selectedTournament.participants || [];
            
            // Fetch user details
            const playerPromises = participants.map(async (uid) => {
                const userDoc = await this.db.collection('users').doc(uid).get();
                return { uid, ...userDoc.data() };
            });
            
            const players = await Promise.all(playerPromises);
            
            // Create CSV
            const csvContent = [
                ['Player Name', 'Gamer Tag', 'Email', 'Registered Date', 'Winning Position'],
                ...players.map(p => {
                    let position = '';
                    if (this.selectedTournament.winnersNominated?.first === p.uid) position = '1st Place';
                    else if (this.selectedTournament.winnersNominated?.second === p.uid) position = '2nd Place';
                    else if (this.selectedTournament.winnersNominated?.third === p.uid) position = '3rd Place';
                    
                    return [
                        p.displayName || 'Unknown',
                        p.gamerTag || 'Not set',
                        p.email || '',
                        p.registeredAt?.toDate?.().toLocaleDateString() || 'N/A',
                        position
                    ];
                })
            ].map(row => row.join(',')).join('\n');
            
            // Download CSV
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.selectedTournament.name}_players.csv`;
            a.click();
            
            this.showToast('Players list exported successfully!');
            
        } catch (error) {
            console.error('Error exporting players:', error);
            this.showToast('Failed to export players: ' + error.message, 'error');
        }
    }

    async sendBroadcast() {
        if (!this.selectedTournament) {
            this.showToast('Please select a tournament first', 'error');
            return;
        }
        
        const messageInput = document.getElementById('broadcast-message');
        const message = messageInput.value.trim();
        
        if (!message) {
            this.showToast('Please enter a message', 'error');
            return;
        }
        
        try {
            this.showToast('Sending broadcast...', 'info');
            
            // Call Firebase Function to send broadcast
            const sendBroadcast = firebase.functions().httpsCallable('sendTournamentBroadcast');
            const result = await sendBroadcast({
                tournamentId: this.selectedTournament.id,
                message: message
            });
            
            if (result.data.success) {
                this.showToast(`Broadcast sent to ${result.data.recipients} players!`);
                messageInput.value = '';
            }
            
        } catch (error) {
            console.error('Error sending broadcast:', error);
            this.showToast('Failed to send broadcast: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        // WhatsApp link update
        document.getElementById('update-whatsapp-btn').addEventListener('click', () => {
            this.updateWhatsAppLink();
        });

        // Generate fixtures
        document.getElementById('generate-fixtures-btn').addEventListener('click', () => {
            this.generateFixtures();
        });

        // Mark as finished
        document.getElementById('mark-finished-btn').addEventListener('click', () => {
            this.markTournamentFinished();
        });

        // Export players
        document.getElementById('export-players-btn').addEventListener('click', () => {
            this.exportPlayers();
        });

        // Send broadcast
        document.getElementById('send-broadcast-btn').addEventListener('click', () => {
            this.sendBroadcast();
        });

        // Enter key in broadcast message (Ctrl+Enter to send)
        document.getElementById('broadcast-message').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendBroadcast();
            }
        });
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        const toastMessage = document.getElementById('toast-message');
        
        // Set icon based on type
        const icon = toast.querySelector('.toast-icon');
        if (type === 'success') {
            icon.textContent = '✓';
            icon.style.color = '#00ff88';
        } else if (type === 'error') {
            icon.textContent = '✗';
            icon.style.color = '#ff6b6b';
        } else {
            icon.textContent = 'ℹ';
            icon.style.color = '#ffc107';
        }
        
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.error('Firebase not initialized');
        return;
    }
    
    window.tournamentManager = new TournamentManager();
});