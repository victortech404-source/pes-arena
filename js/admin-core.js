// UON HUB/js/admin-core.js - Main Admin Controller with Role-Based Governance, Dispute Handling & Enhanced Tournament Creation
class AdminManager {
    constructor() {
        // Step 11: Infrastructure for Role-Based Governance
        this.SUPER_ADMIN_EMAIL = "victortech404@gmail.com";
        this.currentUser = null;
        this.db = null;
        this.init();
    }

    init() { 
        this.checkAdminAuth(); 
    }

    checkAdminAuth() {
        firebase.auth().onAuthStateChanged(user => {
            const loadingMsg = document.getElementById('admin-login-message');
            const adminPanel = document.getElementById('admin-panel');
            
            if (user) {
                this.currentUser = user;
                this.db = firebase.firestore();
                window.adminManager = this; // Make available globally
                
                // Show/hide super admin buttons based on role
                this.setupRoleBasedUI();
                
                // Initialize other modules
                if (window.adminMatches) {
                    window.adminMatches.init(this.db);
                }
                if (window.adminUsers) {
                    window.adminUsers.init(this.db);
                }
                
                loadingMsg.style.display = 'none';
                adminPanel.style.display = 'block';
                this.setupFormListeners();
                this.setupDisputeListeners();
                this.loadPendingRequests();
                this.loadDashboardStats();
                
                // Load initial tab
                this.switchTab('matches');
            } else {
                loadingMsg.innerHTML = `<h3 style="color: #ff6b6b">⛔ Access Denied</h3><p>Authorized personnel only.</p><a href="index.html" class="btn btn-primary">Go Home</a>`;
            }
        });
    }

    // Step 11: Show/hide super admin features
    setupRoleBasedUI() {
        const isSuperAdmin = this.currentUser.email.toLowerCase() === this.SUPER_ADMIN_EMAIL.toLowerCase();
        
        // Hide "Download User Database" for non-super admins
        const exportButtons = document.querySelectorAll('.admin-actions .btn-outline');
        exportButtons.forEach(btn => {
            if (btn.textContent.includes('Download User Database') || 
                btn.textContent.includes('Export User Database')) {
                btn.style.display = isSuperAdmin ? 'inline-block' : 'none';
            }
        });

        // Hide "Sync Old Stats" for non-super admins
        const syncButtons = document.querySelectorAll('.btn-sync-stats, .btn[onclick*="syncOldStats"]');
        syncButtons.forEach(btn => {
            btn.style.display = isSuperAdmin ? 'inline-block' : 'none';
        });

        // Hide payout buttons for non-super admins
        const payoutButtons = document.querySelectorAll('.btn-process-payout, [onclick*="processTournamentPayouts"]');
        payoutButtons.forEach(btn => {
            btn.style.display = isSuperAdmin ? 'inline-block' : 'none';
        });
    }

    async loadDashboardStats() {
        try {
            // Load pending matches count
            const matchesSnap = await this.db.collection('matches')
                .where('status', '==', 'pending')
                .get();
            document.getElementById('stat-pending-matches').textContent = matchesSnap.size;

            // Load active tournaments count - with organizer filter for non-super admins
            let toursQuery = this.db.collection('tournaments').where('status', '==', 'active');
            
            // Step 11: Filter tournaments for non-super admins
            if (this.currentUser && this.currentUser.email.toLowerCase() !== this.SUPER_ADMIN_EMAIL.toLowerCase()) {
                toursQuery = toursQuery.where('organizerId', '==', this.currentUser.uid);
            }
            
            const toursSnap = await toursQuery.get();
            document.getElementById('stat-active-tourneys').textContent = toursSnap.size;

            // Load total users count
            const usersSnap = await this.db.collection('users').get();
            document.getElementById('stat-total-users').textContent = usersSnap.size;
            
            // Load pending disputes count
            const disputesSnap = await this.db.collection('disputes')
                .where('status', '==', 'pending')
                .get();
            document.getElementById('stat-pending-disputes').textContent = disputesSnap.size;
            
            // Load flagged users count (low reliability)
            const flaggedUsersSnap = await this.db.collection('users')
                .where('flaggedForReview', '==', true)
                .get();
            document.getElementById('stat-flagged-users').textContent = flaggedUsersSnap.size;
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    switchTab(tabName) {
        // 1. Hide all sections
        document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
        
        // 2. Show target section
        const targetSection = document.getElementById(`tab-${tabName}`);
        if (targetSection) {
            targetSection.classList.add('active');
        } else {
            console.error(`Section tab-${tabName} not found!`);
        }

        // 3. Update Tab Buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            const onclickAttr = btn.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes(`'${tabName}'`)) {
                btn.classList.add('active');
            }
        });

        // 4. Load Data based on tab
        switch(tabName) {
            case 'matches':
                if (window.adminMatches && window.adminMatches.loadMatchResults) {
                    window.adminMatches.loadMatchResults();
                }
                break;
            case 'applications':
                this.loadPendingRequests();
                break;
            case 'tournaments':
                this.loadTournaments();
                break;
            case 'users':
                if (window.adminUsers && window.adminUsers.loadUsersList) {
                    window.adminUsers.loadUsersList();
                }
                break;
            case 'direct-entry':
                if (window.adminMatches) {
                    window.adminMatches.db = this.db;
                    window.adminMatches.populateDirectEntryPlayers();
                }
                break;
            case 'news':
                this.loadNewsPosts();
                break;
            case 'disputes':
                this.loadDisputes();
                break;
            case 'flagged-users':
                this.loadFlaggedUsers();
                break;
            case 'create':
                // Tournament creation form is already loaded
                break;
            case 'payouts':
                this.loadCompletedTournamentsForPayout();
                break;
        }
    }

    // --- DISPUTE HANDLING SETUP ---
    setupDisputeListeners() {
        // Check if we're on the disputes tab and need to load data
        const disputesTab = document.getElementById('tab-disputes');
        if (disputesTab) {
            // Any specific dispute form listeners would go here
        }
    }

    // --- LOAD DISPUTES ---
    async loadDisputes() {
        const container = document.getElementById('disputes-container');
        if (!container) return;
        
        container.innerHTML = '<p style="text-align:center; color:#888;">Loading disputes...</p>';
        
        try {
            let query = this.db.collection('disputes')
                .orderBy('createdAt', 'desc');
            
            // Filter for non-super admins to only see disputes from their tournaments
            if (this.currentUser && this.currentUser.email.toLowerCase() !== this.SUPER_ADMIN_EMAIL.toLowerCase()) {
                // Get tournaments organized by this user
                const myTournaments = await this.db.collection('tournaments')
                    .where('organizerId', '==', this.currentUser.uid)
                    .get();
                
                if (myTournaments.empty) {
                    container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚖️</span><h3>No Disputes</h3><p>No disputes found for your tournaments.</p></div>'; 
                    return;
                }
                
                const myTournamentIds = myTournaments.docs.map(doc => doc.id);
                query = query.where('tournamentId', 'in', myTournamentIds.slice(0, 10));
            }
            
            const snapshot = await query.get();

            if (snapshot.empty) { 
                container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚖️</span><h3>No Disputes</h3><p>All matches are running smoothly! No pending disputes.</p></div>'; 
                return; 
            }
            
            let html = '';
            snapshot.forEach(doc => {
                const dispute = doc.data();
                const dateStr = dispute.createdAt?.toDate ? dispute.createdAt.toDate().toLocaleDateString() : 'Recent';
                
                // Determine status color
                let statusColor = '#ffaa00'; // pending = yellow
                if (dispute.status === 'resolved') statusColor = '#00ff88';
                if (dispute.status === 'rejected') statusColor = '#ff4444';
                
                html += `
                    <div class="match-card" id="dispute-${doc.id}" style="border-left: 4px solid ${statusColor};">
                        <div class="match-meta">
                            <span>⚖️ Dispute #${doc.id.substring(0, 6)}</span>
                            <span>${dateStr}</span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin: 15px 0;">
                            <div style="flex: 1; text-align: center;">
                                <div style="font-weight: bold; color: #fff;">${dispute.reporterName || 'Unknown'}</div>
                                <div style="color: #888; font-size: 0.8rem;">Reporter</div>
                                <div style="margin-top: 5px;">
                                    <span class="player-tag">@${dispute.reporterTag || 'N/A'}</span>
                                </div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-weight: bold; color: #ffaa00;">VS</div>
                                <div style="color: #888; font-size: 0.8rem;">vs</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-weight: bold; color: #fff;">${dispute.opponentName || 'Unknown'}</div>
                                <div style="color: #888; font-size: 0.8rem;">Opponent</div>
                                <div style="margin-top: 5px;">
                                    <span class="player-tag">@${dispute.opponentTag || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                            <div style="color: #ffaa00; font-weight: bold; margin-bottom: 5px;">Reason:</div>
                            <div style="color: #ddd; font-size: 0.9rem;">${dispute.reason || 'No reason provided'}</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; color: #888; font-size: 0.8rem; margin-bottom: 15px;">
                            <span>🏆 ${dispute.tournamentName || 'Unknown Tournament'}</span>
                            <span>📊 Status: <span style="color: ${statusColor};">${dispute.status}</span></span>
                        </div>`;
                
                // Only show action buttons for pending disputes
                if (dispute.status === 'pending') {
                    html += `
                        <div class="action-row">
                            <button onclick="window.adminManager.resolveDispute('${doc.id}', 'reporter', true)" class="btn-approve" style="background: #ffaa00;">
                                👑 Rule for Reporter
                            </button>
                            <button onclick="window.adminManager.resolveDispute('${doc.id}', 'opponent', true)" class="btn-approve" style="background: #00ff88;">
                                👑 Rule for Opponent
                            </button>
                            <button onclick="window.adminManager.resolveDispute('${doc.id}', null, false)" class="btn-reject">
                                ❌ Reject Dispute
                            </button>
                        </div>
                        
                        <div style="margin-top: 10px; text-align: center;">
                            <small style="color: #ff6b6b;">⚠️ If this was a "No-Show", the losing party's reliability score will be flagged for review</small>
                        </div>`;
                } else if (dispute.status === 'resolved') {
                    html += `
                        <div style="background: rgba(0,255,136,0.1); padding: 8px; border-radius: 8px; text-align: center;">
                            <span style="color: #00ff88;">✓ Resolved: Ruled in favor of ${dispute.resolvedInFavor === 'reporter' ? 'Reporter' : 'Opponent'}</span>
                            ${dispute.flaggedForReview ? '<br><span style="color: #ffaa00;">🚩 Losing party flagged for review (No-Show)</span>' : ''}
                        </div>`;
                } else if (dispute.status === 'rejected') {
                    html += `
                        <div style="background: rgba(255,68,68,0.1); padding: 8px; border-radius: 8px; text-align: center;">
                            <span style="color: #ff4444;">✗ Dispute Rejected - No action taken</span>
                        </div>`;
                }
                
                html += `</div>`;
            });
            container.innerHTML = html;

        } catch (error) { 
            console.error(error); 
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>Failed to load disputes.</p></div>'; 
        }
    }

    // --- RESOLVE DISPUTE FUNCTION WITH NO-SHOW FLAGGING ---
    async resolveDispute(disputeId, ruleInFavor, isNoShow = false) {
        let titleText = 'Resolve Dispute';
        let confirmText = 'Yes, Resolve';
        
        if (ruleInFavor === 'reporter') {
            titleText = 'Rule in favor of Reporter?';
            confirmText = 'Yes, Reporter Wins';
        } else if (ruleInFavor === 'opponent') {
            titleText = 'Rule in favor of Opponent?';
            confirmText = 'Yes, Opponent Wins';
        } else {
            titleText = 'Reject Dispute?';
            confirmText = 'Yes, Reject';
        }
        
        const result = await Swal.fire({ 
            title: titleText, 
            text: ruleInFavor ? 'This will mark the dispute as resolved and update the match result.' : 'This will mark the dispute as rejected with no changes to the match.',
            icon: 'question', 
            showCancelButton: true, 
            confirmButtonText: confirmText,
            confirmButtonColor: ruleInFavor ? '#00ff88' : '#ff4444'
        });
        
        if (!result.isConfirmed) return;
        
        try {
            // Get the dispute document
            const disputeDoc = await this.db.collection('disputes').doc(disputeId).get();
            if (!disputeDoc.exists) throw new Error("Dispute not found");
            
            const dispute = disputeDoc.data();
            
            // Determine which user loses (for No-Show flagging)
            let losingUserId = null;
            let losingUserEmail = null;
            
            if (ruleInFavor === 'reporter') {
                losingUserId = dispute.opponentId;
                losingUserEmail = dispute.opponentEmail;
            } else if (ruleInFavor === 'opponent') {
                losingUserId = dispute.reporterId;
                losingUserEmail = dispute.reporterEmail;
            }
            
            // If this was a No-Show (rule in favor of someone and it's a no-show), flag the loser
            let flaggedForReview = false;
            if (ruleInFavor && isNoShow && losingUserId) {
                flaggedForReview = true;
                
                // Flag the losing user for review (low reliability score)
                await this.flagUserForReview(losingUserId, losingUserEmail, disputeId, dispute.reason);
            }
            
            // Update the match document if this dispute is linked to a match
            if (dispute.matchId) {
                const matchRef = this.db.collection('matches').doc(dispute.matchId);
                
                if (ruleInFavor) {
                    // Update match based on ruling
                    await matchRef.update({
                        status: 'approved',
                        disputeResolved: true,
                        ruledInFavor: ruleInFavor,
                        approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        approvedBy: this.currentUser.email
                    });
                    
                    // Now update the player stats based on the ruling
                    if (dispute.matchData) {
                        await this.updateStatsFromRuling(dispute.matchData, ruleInFavor);
                    }
                } else {
                    // Dispute rejected - mark match as rejected
                    await matchRef.update({
                        status: 'rejected',
                        disputeResolved: true,
                        rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            
            // Update the dispute document
            await this.db.collection('disputes').doc(disputeId).update({
                status: ruleInFavor ? 'resolved' : 'rejected',
                resolvedInFavor: ruleInFavor,
                resolvedBy: this.currentUser.email,
                resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                flaggedForReview: flaggedForReview,
                notes: isNoShow ? 'No-Show detected - Losing party flagged' : ''
            });
            
            // Show appropriate success message
            let message = '';
            if (ruleInFavor) {
                message = `Dispute resolved in favor of ${ruleInFavor === 'reporter' ? 'Reporter' : 'Opponent'}.`;
                if (flaggedForReview) {
                    message += ' The losing party has been flagged for review due to No-Show.';
                }
            } else {
                message = 'Dispute rejected. No action taken.';
            }
            
            Swal.fire('Success!', message, 'success');
            
            // Refresh the disputes list
            this.loadDisputes();
            
        } catch (error) {
            console.error('Error resolving dispute:', error);
            Swal.fire('Error', 'Failed to resolve dispute: ' + error.message, 'error');
        }
    }

    // --- FLAG USER FOR REVIEW (LOW RELIABILITY) ---
    async flagUserForReview(userId, userEmail, disputeId, reason) {
        if (!userId) return;
        
        try {
            const userRef = this.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Calculate new reliability score (decrease by 15-20 points for No-Show)
                const currentReliability = userData.reliabilityScore || 100;
                const newReliability = Math.max(0, currentReliability - 20); // Reduce by 20, minimum 0
                
                // Track no-shows count
                const noShows = (userData.noShows || 0) + 1;
                
                // Update user with reliability flag
                await userRef.update({
                    reliabilityScore: newReliability,
                    noShows: noShows,
                    flaggedForReview: true,
                    flagReason: `No-Show in dispute #${disputeId.substring(0, 6)}: ${reason || 'Failed to show for match'}`,
                    flaggedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    flaggedBy: this.currentUser.email,
                    // Also update consistency rating based on no-shows
                    consistencyRating: this.calculateConsistencyRating(noShows, userData.matchesPlayed || 0)
                });
                
                // Create a flag record in a separate collection for auditing
                await this.db.collection('userFlags').add({
                    userId: userId,
                    userEmail: userEmail,
                    disputeId: disputeId,
                    reason: `No-Show: ${reason || 'Failed to show for match'}`,
                    reliabilityBefore: currentReliability,
                    reliabilityAfter: newReliability,
                    flaggedBy: this.currentUser.email,
                    flaggedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'active'
                });
                
                console.log(`User ${userId} flagged for review due to No-Show`);
            }
        } catch (error) {
            console.error('Error flagging user:', error);
        }
    }

    // --- CALCULATE CONSISTENCY RATING ---
    calculateConsistencyRating(noShows, totalMatches) {
        if (totalMatches === 0) return 'New Player';
        
        const noShowRatio = noShows / totalMatches;
        
        if (noShowRatio === 0) return 'Excellent';
        if (noShowRatio < 0.1) return 'Good';
        if (noShowRatio < 0.25) return 'Fair';
        if (noShowRatio < 0.4) return 'Inconsistent';
        return 'Unreliable';
    }

    // --- UPDATE STATS FROM RULING ---
    async updateStatsFromRuling(matchData, ruleInFavor) {
        try {
            // This would update player stats based on the ruling
            // Similar to approveMatch function but with the ruling outcome
            const userId = ruleInFavor === 'reporter' ? matchData.userId : matchData.opponentId;
            const winnerId = ruleInFavor === 'reporter' ? matchData.userId : matchData.opponentId;
            const loserId = ruleInFavor === 'reporter' ? matchData.opponentId : matchData.userId;
            
            // Get both user documents
            const winnerRef = this.db.collection('users').doc(winnerId);
            const loserRef = this.db.collection('users').doc(loserId);
            
            const winnerDoc = await winnerRef.get();
            const loserDoc = await loserRef.get();
            
            if (winnerDoc.exists && loserDoc.exists) {
                const winnerData = winnerDoc.data();
                const loserData = loserDoc.data();
                
                // For No-Show, we might award a default win (e.g., 3-0)
                const defaultScore = 3;
                
                // Update winner stats
                await winnerRef.update({
                    wins: (winnerData.wins || 0) + 1,
                    goalsScored: (winnerData.goalsScored || 0) + defaultScore,
                    goalsConceded: (winnerData.goalsConceded || 0) + 0,
                    matchesPlayed: (winnerData.matchesPlayed || 0) + 1,
                    winStreak: (winnerData.winStreak || 0) + 1,
                    winRate: this.calculateNewWinRate(winnerData, true)
                });
                
                // Update loser stats (but they already get flagged for No-Show)
                await loserRef.update({
                    losses: (loserData.losses || 0) + 1,
                    goalsScored: (loserData.goalsScored || 0) + 0,
                    goalsConceded: (loserData.goalsConceded || 0) + defaultScore,
                    matchesPlayed: (loserData.matchesPlayed || 0) + 1,
                    winStreak: 0,
                    winRate: this.calculateNewWinRate(loserData, false)
                });
            }
        } catch (error) {
            console.error('Error updating stats from ruling:', error);
        }
    }

    // --- CALCULATE NEW WIN RATE ---
    calculateNewWinRate(userData, isWin) {
        const wins = isWin ? (userData.wins || 0) + 1 : (userData.wins || 0);
        const losses = !isWin ? (userData.losses || 0) + 1 : (userData.losses || 0);
        const draws = userData.draws || 0;
        const total = wins + losses + draws;
        
        return total > 0 ? Math.round((wins / total) * 100) : 0;
    }

    // --- LOAD FLAGGED USERS (LOW RELIABILITY) ---
    async loadFlaggedUsers() {
        const container = document.getElementById('flagged-users-container');
        if (!container) return;
        
        container.innerHTML = '<p style="text-align:center; color:#888;">Loading flagged users...</p>';
        
        try {
            const snapshot = await this.db.collection('users')
                .where('flaggedForReview', '==', true)
                .orderBy('flaggedAt', 'desc')
                .get();

            if (snapshot.empty) { 
                container.innerHTML = '<div class="empty-state"><span class="empty-icon">🚩</span><h3>No Flagged Users</h3><p>All players have good reliability scores!</p></div>'; 
                return; 
            }
            
            let html = '';
            snapshot.forEach(doc => {
                const user = doc.data();
                
                // Determine reliability color
                let reliabilityColor = '#00ff88'; // Good
                if (user.reliabilityScore < 70) reliabilityColor = '#ffaa00';
                if (user.reliabilityScore < 50) reliabilityColor = '#ff4444';
                if (user.reliabilityScore < 30) reliabilityColor = '#ff0000';
                
                html += `
                    <div class="match-card" id="flagged-${doc.id}">
                        <div class="match-meta">
                            <span>🚩 Flagged User</span>
                            <span>${user.flaggedAt?.toDate ? new Date(user.flaggedAt.toDate()).toLocaleDateString() : 'Recently'}</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 15px; margin: 15px 0;">
                            <div style="width: 50px; height: 50px; background: rgba(255,68,68,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                                🚩
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 1.2rem; font-weight: bold; color: #fff;">${user.fullName || 'Unknown'}</div>
                                <div style="color: #888; font-size: 0.9rem;">@${user.gamerTag || 'N/A'} • ${user.email}</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                            <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 20px;">
                                <span style="color: #888;">Reliability:</span>
                                <span style="color: ${reliabilityColor}; font-weight: bold; margin-left: 5px;">${user.reliabilityScore || 0}%</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 20px;">
                                <span style="color: #888;">No-Shows:</span>
                                <span style="color: #ffaa00; font-weight: bold; margin-left: 5px;">${user.noShows || 0}</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 20px;">
                                <span style="color: #888;">Consistency:</span>
                                <span style="color: #00ff88; font-weight: bold; margin-left: 5px;">${user.consistencyRating || 'Unknown'}</span>
                            </div>
                        </div>
                        
                        <div style="background: rgba(255,68,68,0.1); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                            <div style="color: #ffaa00; font-weight: bold; margin-bottom: 5px;">Flag Reason:</div>
                            <div style="color: #ddd;">${user.flagReason || 'No reason provided'}</div>
                        </div>
                        
                        <div class="action-row">
                            <button onclick="window.adminManager.clearUserFlag('${doc.id}')" class="btn-approve" style="background: #00ff88;">
                                ✅ Clear Flag (Reviewed)
                            </button>
                            <button onclick="window.adminManager.viewUserHistory('${doc.id}')" class="btn-approve" style="background: #2196F3;">
                                📊 View History
                            </button>
                        </div>
                    </div>`;
            });
            container.innerHTML = html;

        } catch (error) { 
            console.error(error); 
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>Failed to load flagged users.</p></div>'; 
        }
    }

    // --- CLEAR USER FLAG ---
    async clearUserFlag(userId) {
        const result = await Swal.fire({
            title: 'Clear User Flag?',
            text: 'This will mark the user as reviewed and remove the flag. The reliability score will remain as is.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#00ff88',
            confirmButtonText: 'Yes, Clear Flag'
        });
        
        if (!result.isConfirmed) return;
        
        try {
            await this.db.collection('users').doc(userId).update({
                flaggedForReview: false,
                reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
                reviewedBy: this.currentUser.email
            });
            
            Swal.fire('Success!', 'User flag cleared. Reliability score preserved.', 'success');
            this.loadFlaggedUsers();
            
        } catch (error) {
            console.error('Error clearing flag:', error);
            Swal.fire('Error', 'Failed to clear flag: ' + error.message, 'error');
        }
    }

    // --- VIEW USER HISTORY (Placeholder) ---
    async viewUserHistory(userId) {
        Swal.fire({
            title: 'User History',
            text: 'This feature will show detailed match history for the user.',
            icon: 'info',
            confirmButtonText: 'OK'
        });
    }

    // --- EXCEL EXPORT FUNCTIONALITY WITH ENHANCED ANALYTICS ---
    async exportUsersToCSV() {
        const exportButton = document.querySelector('.admin-actions .btn-outline');
        const originalText = exportButton.textContent;
        
        // Show loading state
        exportButton.textContent = "📊 Exporting...";
        exportButton.disabled = true;
        
        try {
            // Show loading notification
            Swal.fire({
                title: 'Exporting User Data for Analysis',
                text: 'Fetching user information from database...',
                icon: 'info',
                showConfirmButton: false,
                allowOutsideClick: false
            });

            // Fetch all users from Firestore
            const snapshot = await this.db.collection('users').get();
            
            if (snapshot.empty) {
                Swal.fire('No Data', 'No users found in the database.', 'info');
                return;
            }

            // Define CSV headers with enhanced analytics fields
            const headers = [
                'Full Name',
                'Student ID', 
                'Institution/Region',
                'Phone',
                'Email',
                'Gamer Tag',
                'Fav Team',
                'Team Strength',
                'Skill Level',
                'Platform',
                'Registration Date',
                
                // Performance Stats
                'Wins',
                'Losses',
                'Draws',
                'Win Rate (%)',
                'Win Streak',
                'Matches Played',
                
                // Goal Stats
                'Goals Scored',
                'Goals Conceded',
                'Goal Difference',
                'Goals per Match',
                'Conceded per Match',
                'Clean Sheets',
                'Clean Sheet %',
                
                // Reliability & Fair Play Metrics
                'Reliability Score (%)',
                'No-Shows Count',
                'Consistency Rating',
                'Flagged for Review',
                'Flag Reason',
                'Flag Date',
                
                // Additional Analytics
                'Tournaments Joined',
                'Last Active',
                'Account Age (Days)'
            ];

            // Process user data
            const csvRows = [];
            csvRows.push(headers.join(','));

            snapshot.forEach(doc => {
                const user = doc.data();
                
                // Helper function to handle missing/null values
                const getValue = (field, defaultValue = 'N/A') => {
                    const value = user[field];
                    if (value === null || value === undefined || value === '') {
                        return defaultValue;
                    }
                    // Escape commas and quotes for CSV
                    let stringValue = String(value);
                    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                        stringValue = `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                };

                // Calculate goal metrics
                const goalsScored = user.goalsScored || 0;
                const goalsConceded = user.goalsConceded || 0;
                const goalDifference = goalsScored - goalsConceded;
                const matchesPlayed = user.matchesPlayed || 0;
                
                // Calculate advanced metrics
                const goalsPerMatch = matchesPlayed > 0 ? (goalsScored / matchesPlayed).toFixed(2) : 0;
                const concededPerMatch = matchesPlayed > 0 ? (goalsConceded / matchesPlayed).toFixed(2) : 0;
                const cleanSheetPercentage = matchesPlayed > 0 ? Math.round(((user.cleanSheets || 0) / matchesPlayed) * 100) : 0;
                
                // Reliability metrics
                const reliabilityScore = user.reliabilityScore || 100;
                const noShows = user.noShows || 0;
                const consistencyRating = user.consistencyRating || this.calculateConsistencyRating(noShows, matchesPlayed);
                const flaggedForReview = user.flaggedForReview ? 'Yes' : 'No';
                const flagReason = user.flagReason || 'N/A';
                const flagDate = user.flaggedAt?.toDate ? new Date(user.flaggedAt.toDate()).toLocaleDateString() : 'N/A';
                
                // Account age calculation
                const createdAt = user.createdAt?.toDate ? new Date(user.createdAt.toDate()) : null;
                const accountAge = createdAt ? Math.floor((new Date() - createdAt) / (1000 * 60 * 60 * 24)) : 'N/A';
                
                // Last active (if available)
                const lastActive = user.lastActive?.toDate ? new Date(user.lastActive.toDate()).toLocaleDateString() : 'N/A';

                // Map user data to CSV columns with enhanced fields
                const row = [
                    getValue('fullName'),
                    getValue('uonId'),
                    getValue('institution') || getValue('faculty'),
                    getValue('phone'),
                    getValue('email'),
                    getValue('gamerTag'),
                    getValue('favoriteTeam'),
                    getValue('teamStrength'),
                    getValue('skillLevel'),
                    getValue('platform'),
                    user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A',
                    
                    // Performance Stats
                    user.wins || 0,
                    user.losses || 0,
                    user.draws || 0,
                    user.winRate || 0,
                    user.winStreak || 0,
                    matchesPlayed,
                    
                    // Goal Stats
                    goalsScored,
                    goalsConceded,
                    goalDifference,
                    goalsPerMatch,
                    concededPerMatch,
                    user.cleanSheets || 0,
                    cleanSheetPercentage,
                    
                    // Reliability & Fair Play Metrics
                    reliabilityScore,
                    noShows,
                    consistencyRating,
                    flaggedForReview,
                    flagReason,
                    flagDate,
                    
                    // Additional Analytics
                    user.tournamentsJoined || 0,
                    lastActive,
                    accountAge
                ];
                
                csvRows.push(row.join(','));
            });

            // Create CSV string
            const csvString = csvRows.join('\n');
            
            // Generate filename with timestamp for analysis
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const filename = `PES_ARENA_Master_Database_${timestamp}.csv`;
            
            // Create download link with updated filename
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (navigator.msSaveBlob) {
                navigator.msSaveBlob(blob, filename);
            } else {
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            // Show success message with analytics info
            Swal.fire({
                title: 'Export Complete!',
                html: `
                    <div style="text-align:left;">
                        <p><strong>✓ ${snapshot.size} users exported successfully</strong></p>
                        <p>📊 Enhanced analytics fields included:</p>
                        <ul style="margin-top:5px; color:#888;">
                            <li>Reliability Score (%)</li>
                            <li>No-Shows Count</li>
                            <li>Consistency Rating</li>
                            <li>Flag Status & Reasons</li>
                            <li>Goals per Match Metrics</li>
                            <li>Clean Sheet Percentages</li>
                            <li>Account Age Analysis</li>
                        </ul>
                        <p style="margin-top:10px; color:#00ff88;">Ready for Excel/R analysis!</p>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Great!'
            });

        } catch (error) {
            console.error('Error exporting users:', error);
            Swal.fire('Export Failed', 'Could not export user data. Please try again.', 'error');
        } finally {
            // Reset button state
            exportButton.textContent = originalText;
            exportButton.disabled = false;
        }
    }

    // --- APPLICATIONS TAB ---
    async loadPendingRequests() {
        const container = document.getElementById('pending-requests-container');
        container.innerHTML = '<p>Loading...</p>';
        try {
            let query = this.db.collection('tournamentRegistrations')
                .where('status', '==', 'pending')
                .orderBy('timestamp', 'desc');
            
            // Filter for non-super admins
            if (this.currentUser && this.currentUser.email.toLowerCase() !== this.SUPER_ADMIN_EMAIL.toLowerCase()) {
                const myTournaments = await this.db.collection('tournaments')
                    .where('organizerId', '==', this.currentUser.uid)
                    .get();
                
                if (myTournaments.empty) {
                    container.innerHTML = '<div class="empty-state"><span class="empty-icon">📋</span><h3>No Applications</h3><p>No pending join requests for your tournaments.</p></div>'; 
                    return;
                }
                
                const myTournamentIds = myTournaments.docs.map(doc => doc.id);
                query = query.where('tournamentId', 'in', myTournamentIds.slice(0, 10));
            }
            
            const snapshot = await query.get();

            if (snapshot.empty) { 
                container.innerHTML = '<div class="empty-state"><span class="empty-icon">📋</span><h3>No Applications</h3><p>No pending join requests.</p></div>'; 
                return; 
            }
            
            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                html += `
                    <div class="match-card" id="card-${doc.id}">
                        <div class="match-meta">
                            <span>Join Request</span>
                            <span>${new Date(data.timestamp?.toDate()).toLocaleDateString()}</span>
                        </div>
                        <div class="match-scoreboard">
                            <div class="score-box">
                                <div style="font-size: 1.2rem; font-weight: bold; color: #fff;">${data.userDisplayName}</div>
                                <span class="player-tag">@${data.gamerTag}</span>
                            </div>
                        </div>
                        <div style="text-align: center; color: #888; font-size: 0.9rem; margin: 10px 0;">
                            Wants to join: <strong>${data.tournamentName}</strong>
                        </div>
                        <div class="action-row">
                            <button onclick="window.adminManager.handleRequest('${doc.id}', 'approved')" class="btn-approve">✅ Approve</button>
                            <button onclick="window.adminManager.handleRequest('${doc.id}', 'rejected')" class="btn-reject">❌ Reject</button>
                        </div>
                    </div>`;
            });
            container.innerHTML = html;
        } catch (error) { 
            console.error(error); 
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>Failed to load requests.</p></div>'; 
        }
    }

    async handleRequest(docId, status) {
        const result = await Swal.fire({ 
            title: `Mark as ${status}?`, 
            icon: 'question', 
            showCancelButton: true, 
            confirmButtonText: 'Yes',
            confirmButtonColor: status === 'approved' ? '#00ff88' : '#d33'
        });
        
        if (result.isConfirmed) {
            try {
                await this.db.collection('tournamentRegistrations').doc(docId).update({ status: status });
                document.getElementById(`card-${docId}`).remove();
                Swal.fire('Success!', `User ${status}.`, 'success');
                this.loadDashboardStats();
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }
    }

    // --- TOURNAMENTS TAB ---
    async loadTournaments() {
        const container = document.getElementById('active-tournaments-list');
        container.innerHTML = '<p>Loading tournaments...</p>';
        
        try {
            let query = this.db.collection('tournaments').orderBy('createdAt', 'desc');
            
            // Filter tournaments for non-super admins
            if (this.currentUser && this.currentUser.email.toLowerCase() !== this.SUPER_ADMIN_EMAIL.toLowerCase()) {
                query = query.where('organizerId', '==', this.currentUser.uid);
            }
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                container.innerHTML = '<div class="empty-state"><span class="empty-icon">🏆</span><h3>No Tournaments</h3><p>Create your first tournament!</p></div>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const t = doc.data();
                const date = t.startDate?.toDate ? t.startDate.toDate().toLocaleDateString() : 'TBD';
                
                // Check for existing images
                const hasStandings = !!t.standingsImg;
                const hasFixtures = !!t.fixturesImg;
                
                // Display entry fee and prize info
                const entryFeeDisplay = t.entryFee ? `💰 Ksh ${t.entryFee}` : '🎟️ Free';
                const prizeDisplay = t.prizePool ? `🏆 ${t.prizePool}` : 'No prize';
                
                // Check if tournament is completed and has prize pool
                const isCompleted = t.status === 'completed';
                const hasPrize = !!t.prizePool;
                
                html += `
                    <div class="match-card" style="position: relative;">
                        <div class="tournament-media-indicator">
                            <div class="media-badge ${hasStandings ? 'has-image' : 'no-image'}" title="${hasStandings ? 'Has standings image' : 'No standings image'}">
                                ${hasStandings ? '✓' : '✗'}
                            </div>
                            <div class="media-badge ${hasFixtures ? 'has-image' : 'no-image'}" title="${hasFixtures ? 'Has fixtures image' : 'No fixtures image'}">
                                ${hasFixtures ? '✓' : '✗'}
                            </div>
                            <button onclick="window.adminManager.openMediaModal('${doc.id}', '${t.name}')" class="btn-media" style="margin-left: 10px;">
                                🖼️ Media
                            </button>
                        </div>
                        <div class="match-meta">
                            <span>${t.platform || 'Platform'}</span>
                            <span>${date}</span>
                        </div>
                        <div style="font-size: 1.4rem; font-weight: bold; color: #fff; margin: 10px 0;">
                            ${t.name}
                        </div>
                        <div style="color: #888; font-size: 0.9rem; margin-bottom: 15px;">
                            ${t.description ? t.description.substring(0, 80) + '...' : 'No description'}
                        </div>
                        <div style="display: flex; justify-content: space-between; color: #666; font-size: 0.8rem; margin-bottom: 20px;">
                            <span>👥 <span id="admin-count-${doc.id}">Loading...</span>/${t.maxParticipants}</span>
                            <span>🏁 ${t.format || 'Format'}</span>
                            <span title="${prizeDisplay}">${entryFeeDisplay}</span>
                        </div>
                        ${t.whatsappLink ? `
                        <div style="margin-bottom: 10px;">
                            <a href="${t.whatsappLink}" target="_blank" class="btn-whatsapp" style="display: inline-block; background: #25D366; color: white; padding: 5px 10px; border-radius: 20px; text-decoration: none; font-size: 0.8rem;">
                                📱 WhatsApp Group
                            </a>
                        </div>` : ''}
                        <div class="action-row">
                            <button onclick="window.adminManager.viewTournamentPlayers('${doc.id}', '${t.name}')" class="btn-approve">👥 Manage</button>
                            ${isCompleted && hasPrize && this.currentUser.email.toLowerCase() === this.SUPER_ADMIN_EMAIL.toLowerCase() ? 
                                `<button onclick="window.adminManager.preparePayout('${doc.id}')" class="btn-approve" style="background: #ffaa00;">💰 Process Payout</button>` : ''}
                            <button onclick="window.adminManager.deleteTournament('${doc.id}')" class="btn-reject">🗑️ Delete</button>
                        </div>
                    </div>`;
            });
            container.innerHTML = html;

            // Update participant counts
            snapshot.forEach(async (doc) => {
                const count = await this.getParticipantCount(doc.id);
                const el = document.getElementById(`admin-count-${doc.id}`);
                if (el) el.textContent = count;
            });

        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>Failed to load tournaments.</p></div>'; 
        }
    }

    async getParticipantCount(tournamentId) {
        try {
            const snap = await this.db.collection('tournamentRegistrations')
                .where('tournamentId', '==', tournamentId)
                .where('status', '==', 'approved')
                .get();
            return snap.size;
        } catch (e) {
            return 0;
        }
    }

    async deleteTournament(id) {
        const r = await Swal.fire({ 
            title: 'Delete Tournament?', 
            text: "This action cannot be undone.", 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonColor: '#d33', 
            confirmButtonText: 'Delete' 
        });
        
        if (r.isConfirmed) {
            try {
                await this.db.collection('tournaments').doc(id).delete();
                this.loadTournaments();
                this.loadDashboardStats();
                Swal.fire('Deleted!', 'Tournament removed.', 'success');
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }
    }

    // --- MODAL PLAYER MANAGEMENT ---
    async viewTournamentPlayers(tournamentId, tournamentName) {
        const overlay = document.getElementById('player-modal-overlay');
        const title = document.getElementById('pm-title');
        const tbody = document.getElementById('pm-table-body');
        const exportBtn = document.getElementById('btn-export-tournament');
        
        overlay.dataset.tournamentId = tournamentId;
        overlay.dataset.tournamentName = tournamentName;
        
        overlay.classList.add('open');
        overlay.style.display = 'flex';
        
        title.textContent = `Players: ${tournamentName}`;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading players...</td></tr>';
        
        if (exportBtn) {
            exportBtn.style.display = 'inline-block';
        }

        try {
            const snapshot = await this.db.collection('tournamentRegistrations')
                .where('tournamentId', '==', tournamentId)
                .where('status', '==', 'approved')
                .get();

            if (snapshot.empty) { 
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#888;">No players found.</td></tr>'; 
                return; 
            }

            let html = '';
            snapshot.forEach(doc => {
                const p = doc.data();
                html += `
                    <tr id="row-${doc.id}">
                        <td>${p.userDisplayName}</td>
                        <td style="color:var(--neon-green)">@${p.gamerTag}</td>
                        <td><span style="background:rgba(0,255,136,0.1); color:#00ff88; padding:2px 6px; border-radius:4px; font-size:0.8rem;">Active</span></td>
                        <td>
                            <button onclick="window.adminManager.removePlayer('${doc.id}')" 
                                class="btn btn-outline btn-sm" 
                                style="border-color:#ff4444; color:#ff4444; padding:4px 10px; font-size:0.8rem;">
                                Remove
                            </button>
                        </td>
                    </tr>`;
            });
            tbody.innerHTML = html;

        } catch (error) { 
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading data.</td></tr>'; 
        }
    }

    closePlayerModal() {
        const overlay = document.getElementById('player-modal-overlay');
        const exportBtn = document.getElementById('btn-export-tournament');
        
        overlay.classList.remove('open');
        setTimeout(() => {
            overlay.style.display = 'none';
            if (exportBtn) {
                exportBtn.style.display = 'none';
            }
        }, 300);
    }

    async removePlayer(id) {
        const r = await Swal.fire({ 
            title: 'Remove Player?', 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonColor: '#d33' 
        });
        
        if (r.isConfirmed) {
            try {
                await this.db.collection('tournamentRegistrations').doc(id).update({ status: 'removed' });
                document.getElementById(`row-${id}`).remove();
                Swal.fire('Removed!', 'Player removed from tournament.', 'success');
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }
    }

    // --- MEDIA MANAGEMENT MODAL ---
    async openMediaModal(tournamentId, name) {
        document.getElementById('mm-tournament-id').value = tournamentId;
        document.getElementById('mm-title').textContent = `Editing: ${name}`;
        
        document.getElementById('mm-standings').value = '';
        document.getElementById('mm-fixtures').value = '';
        
        try {
            const doc = await this.db.collection('tournaments').doc(tournamentId).get();
            if (doc.exists) {
                const t = doc.data();
                
                const setupPreview = (type, base64) => {
                    const box = document.getElementById(`preview-box-${type}`);
                    const img = document.getElementById(`img-${type}-preview`);
                    const status = document.getElementById(`status-${type}`);
                    
                    if (base64) {
                        box.style.display = 'block';
                        img.src = base64;
                        status.textContent = "✅ Image Active";
                        status.style.color = "#00ff88";
                    } else {
                        box.style.display = 'none';
                        status.textContent = "❌ No Image";
                        status.style.color = "#666";
                    }
                };

                setupPreview('standings', t.standingsImg);
                setupPreview('fixtures', t.fixturesImg);
            }
        } catch (e) { console.error("Error loading previews", e); }

        const overlay = document.getElementById('media-modal-overlay');
        overlay.classList.add('open');
        overlay.style.display = 'flex';
    }

    closeMediaModal() {
        const overlay = document.getElementById('media-modal-overlay');
        overlay.classList.remove('open');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }

    async saveTournamentMedia() {
        const btn = document.querySelector('#media-modal-overlay .btn-primary');
        const originalText = btn.textContent;
        btn.textContent = "Uploading...";
        btn.disabled = true;

        const tournamentId = document.getElementById('mm-tournament-id').value;
        const standingsFile = document.getElementById('mm-standings').files[0];
        const fixturesFile = document.getElementById('mm-fixtures').files[0];

        const readFile = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        };

        try {
            const updateData = {};
            
            if (standingsFile) {
                updateData.standingsImg = await readFile(standingsFile);
            }
            if (fixturesFile) {
                updateData.fixturesImg = await readFile(fixturesFile);
            }

            if (Object.keys(updateData).length === 0) {
                throw new Error("No new files selected. Nothing to update.");
            }

            updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

            await this.db.collection('tournaments').doc(tournamentId).update(updateData);
            
            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Leaderboard images have been refreshed.',
                timer: 1500,
                showConfirmButton: false
            });
            
            this.closeMediaModal();
            this.loadTournaments();

        } catch (error) {
            Swal.fire('Info', error.message, 'info');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // --- NEWS MANAGEMENT ---
    setupFormListeners() {
        const form = document.getElementById('create-tournament-form');
        if (form) {
            form.addEventListener('submit', (e) => { 
                e.preventDefault(); 
                this.handleCreateTournament(); 
            });
        }
        
        const newsForm = document.getElementById('create-news-form');
        if (newsForm) {
            newsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePostNews();
            });
        }
    }

    // --- ENHANCED TOURNAMENT CREATION WITH WHATSAPP LINK & PRIZE POOL LOGIC ---
    async handleCreateTournament() {
        const btn = document.querySelector('#create-tournament-form button');
        const originalBtnText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Publishing...";

        try {
            // Helper to read files as Base64
            const readFileAsBase64 = (file) => {
                return new Promise((resolve, reject) => {
                    if (!file) {
                        resolve(null);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });
            };

            // Get Files
            const standingsFile = document.getElementById('t-img-standings')?.files[0];
            const fixturesFile = document.getElementById('t-img-fixtures')?.files[0];

            let standingsBase64 = null;
            let fixturesBase64 = null;

            if (standingsFile) standingsBase64 = await readFileAsBase64(standingsFile);
            if (fixturesFile) fixturesBase64 = await readFileAsBase64(fixturesFile);

            // Get entry fee value
            const entryFeeInput = document.getElementById('t-entry-fee');
            const entryFeeValue = entryFeeInput ? entryFeeInput.value : '0';
            const entryFee = entryFeeValue && !isNaN(parseFloat(entryFeeValue)) ? parseFloat(entryFeeValue) : 0;

            // Get prize pool fields
            const prizePool = document.getElementById('t-prize')?.value || '';
            const prizePoolDescription = document.getElementById('t-prize-description')?.value || '';
            
            // Get WhatsApp Group Link
            const whatsappLink = document.getElementById('t-whatsapp-link')?.value || '';

            // VALIDATION: If prize pool exists, WhatsApp link is required
            if (prizePool && prizePool.trim() !== '' && !whatsappLink) {
                throw new Error("⚠️ Prize pool detected! A WhatsApp Group Link is required to contact winners. Please provide a WhatsApp link.");
            }

            // Optional: Validate WhatsApp link format
            if (whatsappLink) {
                const isValidWhatsAppLink = whatsappLink.includes('chat.whatsapp.com') || 
                                            whatsappLink.includes('wa.me') || 
                                            whatsappLink.includes('whatsapp.com');
                
                if (!isValidWhatsAppLink) {
                    const confirmInvalidLink = await Swal.fire({
                        title: 'Invalid WhatsApp Link?',
                        html: '<p>The WhatsApp link doesn\'t look valid.</p><p>Continue anyway?</p>',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Yes, Continue',
                        cancelButtonText: 'Cancel',
                        confirmButtonColor: '#ffaa00'
                    });
                    
                    if (!confirmInvalidLink.isConfirmed) {
                        btn.disabled = false;
                        btn.textContent = originalBtnText;
                        return;
                    }
                }
            }

            // AUTO-ATTRIBUTION: Get creator's gamer tag
            let creatorGamerTag = this.currentUser.email.split('@')[0];
            
            try {
                const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    creatorGamerTag = userData.gamerTag || userData.email?.split('@')[0] || this.currentUser.email.split('@')[0];
                }
            } catch (error) {
                console.warn('Could not fetch user gamer tag, using email username');
            }

            // Prepare tournament data
            const data = {
                // Basic Info
                name: document.getElementById('t-name').value,
                link: document.getElementById('t-link')?.value || '',
                startDate: new Date(document.getElementById('t-date').value),
                matchTime: document.getElementById('t-time')?.value || 'TBD',
                
                // Format & Platform
                format: document.getElementById('t-format').value,
                platform: document.getElementById('t-platform').value,
                maxParticipants: parseInt(document.getElementById('t-max')?.value) || 32,
                
                // Prize & Communication (NEW FIELDS)
                prizePool: prizePool,
                prizePoolDescription: prizePoolDescription,
                whatsappLink: whatsappLink,
                
                // Description & Rules
                description: document.getElementById('t-desc')?.value || '',
                formatDetails: document.getElementById('t-format-details')?.value || '',
                matchRules: document.getElementById('t-rules')?.value || '',
                
                // IMAGE FIELDS
                standingsImg: standingsBase64, 
                fixturesImg: fixturesBase64,

                // Entry Fee
                entryFee: entryFee,
                
                // AUTO-ATTRIBUTION: Creator information
                creatorUid: this.currentUser.uid,
                creatorEmail: this.currentUser.email,
                creatorGamerTag: creatorGamerTag,
                creatorName: this.currentUser.displayName || creatorGamerTag,
                
                // Legacy fields for backward compatibility
                organizerId: this.currentUser.uid,
                organizerEmail: this.currentUser.email,
                organizerName: this.currentUser.displayName || creatorGamerTag,
                
                // Status & Tracking
                status: 'active',
                participants: 0,
                featured: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Validations
            if (entryFee < 0) {
                throw new Error("Entry fee cannot be negative.");
            }
            if (!data.name) throw new Error("Tournament name is required");
            if (!data.startDate || isNaN(data.startDate.getTime())) throw new Error("Valid start date is required");
            if (!data.format) throw new Error("Tournament format is required");
            if (!data.platform) throw new Error("Platform is required");

            // Save to Firestore
            const docRef = await this.db.collection('tournaments').add(data);
            
            // Success message
            let additionalInfo = [];
            if (prizePool) {
                additionalInfo.push(`🏆 Prize: ${prizePool}`);
                if (whatsappLink) {
                    additionalInfo.push(`📱 WhatsApp Group: Link saved`);
                }
            }
            if (entryFee > 0) {
                additionalInfo.push(`💰 Entry fee: Ksh ${entryFee}`);
            }
            
            const additionalHtml = additionalInfo.length > 0 
                ? `<div style="margin-top:15px; padding:10px; background:rgba(0,255,136,0.1); border-radius:8px;">
                    ${additionalInfo.map(info => `<p style="margin:5px 0; color:#00ff88;">${info}</p>`).join('')}
                   </div>`
                : '';
            
            Swal.fire({
                icon: 'success',
                title: 'Tournament Created!',
                html: `
                    <div style="text-align:left;">
                        <p><strong style="font-size:1.2rem;">${data.name}</strong></p>
                        <p>✅ Tournament created successfully!</p>
                        ${additionalHtml}
                        <div style="margin-top:15px; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px;">
                            <p style="margin:5px 0; color:#888;">
                                <span style="color:#fff;">Created by:</span> @${creatorGamerTag}
                            </p>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Great!',
                confirmButtonColor: '#00ff88'
            });
            
            // Reset form
            document.getElementById('create-tournament-form').reset();
            
            // Refresh stats and switch tab
            await this.loadDashboardStats();
            this.switchTab('tournaments');
            
        } catch (error) {
            console.error('Tournament creation error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Creation Failed',
                text: error.message,
                confirmButtonColor: '#ff4444'
            });
        } finally {
            btn.disabled = false;
            btn.textContent = originalBtnText;
        }
    }

    async handlePostNews() {
        const btn = document.querySelector('#create-news-form button');
        btn.disabled = true;
        btn.textContent = "Publishing...";

        try {
            const readFileAsBase64 = (file) => {
                return new Promise((resolve, reject) => {
                    if (!file) {
                        resolve(null);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });
            };

            const title = document.getElementById('news-title').value;
            const category = document.getElementById('news-category').value;
            const content = document.getElementById('news-content').value;
            const dateInput = document.getElementById('news-date').value;
            const authorInput = document.getElementById('news-author').value;
            const imageFile = document.getElementById('news-image').files[0];

            if (!title || !category || !content) {
                throw new Error("Please fill in all required fields: Title, Category, and Content.");
            }

            let imageBase64 = null;
            if (imageFile) {
                imageBase64 = await readFileAsBase64(imageFile);
            }

            let publishDate;
            let dateString = '';
            
            if (dateInput) {
                publishDate = new Date(dateInput);
                dateString = dateInput;
            } else {
                publishDate = new Date();
                dateString = publishDate.toISOString().split('T')[0];
            }

            const author = authorInput.trim() || this.currentUser.email;

            const newsData = {
                title: title,
                category: category,
                content: content,
                image: imageBase64,
                author: author,
                dateString: dateString,
                status: 'published',
                views: 0,
                createdAt: dateInput ? firebase.firestore.Timestamp.fromDate(publishDate) : firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('news').add(newsData);
            
            document.getElementById('create-news-form').reset();
            
            Swal.fire({
                icon: 'success',
                title: 'Published!',
                text: 'News post has been published successfully.',
                timer: 1500,
                showConfirmButton: false
            });
            
            this.loadNewsPosts();

        } catch (error) {
            console.error('Error publishing news:', error);
            Swal.fire('Error', error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = "📰 Publish News Post";
        }
    }

    async loadNewsPosts() {
        const container = document.getElementById('news-posts-list');
        container.innerHTML = '<p style="text-align:center; color:#888;">Loading news posts...</p>';
        
        try {
            const snapshot = await this.db.collection('news')
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            if (snapshot.empty) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📰</span>
                        <h3>No News Posts Yet</h3>
                        <p>Create your first news post to keep the community updated!</p>
                    </div>`;
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const post = doc.data();
                
                let dateStr;
                if (post.dateString) {
                    const date = new Date(post.dateString);
                    dateStr = date.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric'
                    });
                } else {
                    const date = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();
                    dateStr = date.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric'
                    });
                }
                
                const displayDate = dateStr;
                
                const previewContent = post.content.length > 150 
                    ? post.content.substring(0, 150) + '...' 
                    : post.content;
                
                html += `
                    <div class="news-post" id="news-${doc.id}">
                        <div class="news-post-header">
                            <div>
                                <div class="news-post-title">${post.title}</div>
                                <span class="news-post-category">${post.category}</span>
                            </div>
                            <div class="news-post-date">
                                ${displayDate}${post.author ? ` • By ${post.author}` : ''}
                            </div>
                        </div>
                        
                        ${post.image ? `<img src="${post.image}" class="news-post-image has-image" alt="News cover">` : ''}
                        
                        <div class="news-post-content preview">${previewContent}</div>
                        
                        <div class="news-post-actions">
                            <button onclick="window.adminManager.deleteNewsPost('${doc.id}')" class="btn-reject">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>`;
            });
            
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading news posts:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⚠️</span>
                    <h3>Error Loading News</h3>
                    <p>Failed to load news posts. Please try again.</p>
                </div>`;
        }
    }

    async deleteNewsPost(postId) {
        const result = await Swal.fire({
            title: 'Delete News Post?',
            text: "This action cannot be undone. The post will be permanently removed.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await this.db.collection('news').doc(postId).delete();
                
                document.getElementById(`news-${postId}`).remove();
                
                Swal.fire(
                    'Deleted!',
                    'The news post has been deleted.',
                    'success'
                );
                
                const container = document.getElementById('news-posts-list');
                if (container.children.length === 0) {
                    this.loadNewsPosts();
                }
                
            } catch (error) {
                Swal.fire('Error', 'Failed to delete post: ' + error.message, 'error');
            }
        }
    }

    // --- SYNC OLD STATS FUNCTION ---
    async syncOldStats() {
        const result = await Swal.fire({
            title: 'Recalculate Global Rankings?',
            text: 'Recalculating all PES ARENA global rankings and ELO scores...',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Recalculate Everything'
        });

        if (!result.isConfirmed) return;

        try {
            Swal.fire({ 
                title: 'Recalculating...', 
                text: 'Recalculating all PES ARENA global rankings and ELO scores...',
                allowOutsideClick: false, 
                didOpen: () => { 
                    Swal.showLoading(); 
                } 
            });

            const matches = await this.db.collection('matches').where('status', '==', 'approved').get();
            
            if (matches.empty) {
                Swal.fire('No Data', 'No approved matches found to sync.', 'info');
                return;
            }

            const userStatsMap = new Map();
            
            for (const matchDoc of matches.docs) {
                const m = matchDoc.data();
                
                const p1Score = Number(m.myScore || 0);
                const p2Score = Number(m.oppScore || 0);
                
                if (m.userId) {
                    const existing = userStatsMap.get(m.userId) || {
                        goalsScored: 0,
                        goalsConceded: 0,
                        matchesPlayed: 0,
                        cleanSheets: 0,
                        wins: 0,
                        losses: 0,
                        draws: 0
                    };
                    
                    existing.goalsScored += p1Score;
                    existing.goalsConceded += p2Score;
                    existing.matchesPlayed++;
                    if (p2Score === 0) existing.cleanSheets++;
                    
                    if (p1Score > p2Score) {
                        existing.wins++;
                    } else if (p1Score < p2Score) {
                        existing.losses++;
                    } else {
                        existing.draws++;
                    }
                    
                    userStatsMap.set(m.userId, existing);
                }
                
                if (m.opponentId) {
                    const existing = userStatsMap.get(m.opponentId) || {
                        goalsScored: 0,
                        goalsConceded: 0,
                        matchesPlayed: 0,
                        cleanSheets: 0,
                        wins: 0,
                        losses: 0,
                        draws: 0
                    };
                    
                    existing.goalsScored += p2Score;
                    existing.goalsConceded += p1Score;
                    existing.matchesPlayed++;
                    if (p1Score === 0) existing.cleanSheets++;
                    
                    if (p2Score > p1Score) {
                        existing.wins++;
                    } else if (p2Score < p1Score) {
                        existing.losses++;
                    } else {
                        existing.draws++;
                    }
                    
                    userStatsMap.set(m.opponentId, existing);
                }
            }

            const allUsers = await this.db.collection('users').get();
            
            const batch = this.db.batch();
            let batchCount = 0;
            
            allUsers.docs.forEach(doc => {
                batch.update(doc.ref, { 
                    goalsScored: 0, 
                    goalsConceded: 0, 
                    matchesPlayed: 0, 
                    cleanSheets: 0, 
                    wins: 0, 
                    losses: 0, 
                    draws: 0, 
                    goalDifference: 0, 
                    winRate: 0,
                    winStreak: 0,
                    rank: "Unranked"
                });
                batchCount++;
                
                if (batchCount >= 500) {
                    batch.commit();
                    batchCount = 0;
                }
            });
            
            if (batchCount > 0) {
                await batch.commit();
            }

            const updateBatch = this.db.batch();
            let updateCount = 0;
            
            for (const [userId, stats] of userStatsMap.entries()) {
                const userRef = this.db.collection('users').doc(userId);
                
                const totalMatches = stats.wins + stats.losses + stats.draws;
                const winRate = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;
                const goalDifference = stats.goalsScored - stats.goalsConceded;
                
                const userDoc = await userRef.get();
                const userData = userDoc.exists ? userDoc.data() : {};
                
                updateBatch.update(userRef, {
                    goalsScored: stats.goalsScored,
                    goalsConceded: stats.goalsConceded,
                    goalDifference: goalDifference,
                    matchesPlayed: stats.matchesPlayed,
                    cleanSheets: stats.cleanSheets,
                    wins: stats.wins,
                    losses: stats.losses,
                    draws: stats.draws,
                    winRate: winRate,
                    winStreak: 0,
                    reliabilityScore: userData.reliabilityScore || 100,
                    noShows: userData.noShows || 0,
                    consistencyRating: userData.consistencyRating || this.calculateConsistencyRating(userData.noShows || 0, stats.matchesPlayed)
                });
                
                updateCount++;
                
                if (updateCount >= 500) {
                    await updateBatch.commit();
                    updateCount = 0;
                }
            }
            
            if (updateCount > 0) {
                await updateBatch.commit();
            }

            const finalUsers = await this.db.collection('users')
                .where('matchesPlayed', '>', 0)
                .get();
            
            let players = finalUsers.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            players.sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.goalDifference - a.goalDifference;
            });

            const rankBatch = this.db.batch();
            let rankCount = 0;
            
            for (let i = 0; i < players.length; i++) {
                const userRef = this.db.collection('users').doc(players[i].id);
                rankBatch.update(userRef, { 
                    rank: i + 1 
                });
                rankCount++;
                
                if (rankCount >= 500) {
                    await rankBatch.commit();
                    rankCount = 0;
                }
            }
            
            if (rankCount > 0) {
                await rankBatch.commit();
            }

            Swal.fire({
                icon: 'success',
                title: 'Recalculation Complete!',
                html: `
                    <div style="text-align:left; padding:10px;">
                        <p><strong>✓ Successfully recalculated PES ARENA rankings!</strong></p>
                        <p>• Processed ${matches.size} approved matches</p>
                        <p>• Updated ${players.length} players with match history</p>
                        <p>• Recalculated all global rankings and ELO scores</p>
                        <p>• Reliability scores preserved for fair play tracking</p>
                    </div>
                `,
                confirmButtonText: 'Awesome!'
            });
            
        } catch (e) { 
            console.error('Recalculation failed:', e);
            Swal.fire('Error', 'Recalculation failed: ' + e.message, 'error'); 
        }
    }

    // ========== PAYOUT AUTOMATION FUNCTIONS ==========
    // These functions are strictly restricted to SUPER_ADMIN only

    /**
     * Calculate the final prize pool for a tournament
     * Sums all completed payments for the tournament and applies the split algorithm:
     * 60% for 1st, 25% for 2nd, 10% for 3rd, and 5% as Arena Commission
     */
    async calculateFinalPrize(tournamentId) {
        try {
            // Verify super admin
            if (this.currentUser.email.toLowerCase() !== this.SUPER_ADMIN_EMAIL.toLowerCase()) {
                throw new Error("Unauthorized: Only Super Admin can calculate prize pools");
            }

            // Get tournament details
            const tournamentDoc = await this.db.collection('tournaments').doc(tournamentId).get();
            if (!tournamentDoc.exists) {
                throw new Error("Tournament not found");
            }
            
            const tournament = tournamentDoc.data();
            
            // Check if tournament has prize pool
            if (!tournament.prizePool) {
                throw new Error("This tournament has no prize pool configured");
            }

            // Get all completed payments for this tournament
            const paymentsSnap = await this.db.collection('payments')
                .where('tournamentId', '==', tournamentId)
                .where('status', '==', 'completed')
                .get();

            if (paymentsSnap.empty) {
                throw new Error("No completed payments found for this tournament");
            }

            // Calculate total pool (sum of all entry fees)
            let totalPool = 0;
            const paymentDetails = [];
            
            paymentsSnap.forEach(doc => {
                const payment = doc.data();
                totalPool += payment.amount || 0;
                paymentDetails.push({
                    userId: payment.userId,
                    userName: payment.userName,
                    userPhone: payment.phoneNumber,
                    amount: payment.amount,
                    transactionId: payment.transactionId
                });
            });

            // Apply the split algorithm
            const firstPrize = totalPool * 0.60; // 60%
            const secondPrize = totalPool * 0.25; // 25%
            const thirdPrize = totalPool * 0.10; // 10%
            const arenaCommission = totalPool * 0.05; // 5%

            // Calculate individual amounts (rounded to 2 decimal places)
            const prizeBreakdown = {
                totalPool: Math.round(totalPool * 100) / 100,
                firstPlace: Math.round(firstPrize * 100) / 100,
                secondPlace: Math.round(secondPrize * 100) / 100,
                thirdPlace: Math.round(thirdPrize * 100) / 100,
                arenaCommission: Math.round(arenaCommission * 100) / 100,
                numberOfPayments: paymentsSnap.size,
                paymentDetails: paymentDetails
            };

            // Save prize calculation to tournament
            await tournamentDoc.ref.update({
                prizeCalculation: {
                    ...prizeBreakdown,
                    calculatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    calculatedBy: this.currentUser.email
                }
            });

            return prizeBreakdown;

        } catch (error) {
            console.error('Error calculating prize:', error);
            throw error;
        }
    }

    /**
     * Process tournament payouts to winners
     * Calls the Netlify function /.netlify/functions/mpesa-payout
     * Strictly restricted to SUPER_ADMIN only
     */
    async processTournamentPayouts(tournamentId, winners) {
        try {
            // Verify super admin
            if (this.currentUser.email.toLowerCase() !== this.SUPER_ADMIN_EMAIL.toLowerCase()) {
                throw new Error("❌ Unauthorized: Only Super Admin can process payouts");
            }

            // Validate winners array
            if (!winners || !Array.isArray(winners) || winners.length === 0) {
                throw new Error("Please provide winners data");
            }

            // Validate winners have required fields
            for (const winner of winners) {
                if (!winner.phone || !winner.amount || !winner.position) {
                    throw new Error(`Winner at position ${winner.position} is missing required fields (phone, amount, position)`);
                }
                
                // Validate phone number format (basic Kenyan phone format)
                const phoneRegex = /^(?:(?:\+?254|0)?[17]\d{8})$/;
                if (!phoneRegex.test(winner.phone.replace(/\s+/g, ''))) {
                    throw new Error(`Invalid phone number for position ${winner.position}: ${winner.phone}`);
                }
            }

            // Calculate total payout amount
            const totalPayout = winners.reduce((sum, w) => sum + w.amount, 0);

            // Get tournament details for record keeping
            const tournamentDoc = await this.db.collection('tournaments').doc(tournamentId).get();
            if (!tournamentDoc.exists) {
                throw new Error("Tournament not found");
            }
            const tournament = tournamentDoc.data();

            // Show confirmation dialog with payout details
            const confirmHtml = `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <h4 style="color: #00ff88; margin-bottom: 15px;">💰 Payout Summary</h4>
                    <p><strong>Tournament:</strong> ${tournament.name}</p>
                    <p><strong>Total Payout:</strong> Ksh ${totalPayout.toLocaleString()}</p>
                    <hr style="border-color: #333; margin: 15px 0;">
                    <h5 style="color: #fff;">🏆 Winners:</h5>
                    ${winners.map(w => `
                        <div style="margin: 10px 0; padding: 8px; background: rgba(0,255,136,0.1); border-radius: 5px;">
                            <strong>${w.position} Place:</strong> Ksh ${w.amount.toLocaleString()}<br>
                            <span style="color: #888;">${w.name} - ${w.phone}</span>
                        </div>
                    `).join('')}
                    <hr style="border-color: #333; margin: 15px 0;">
                    <p style="color: #ffaa00;">⚠️ This will initiate actual M-PESA payments. Please verify all details.</p>
                </div>
            `;

            const result = await Swal.fire({
                title: 'Process Tournament Payouts?',
                html: confirmHtml,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#00ff88',
                confirmButtonText: 'Yes, Process Payments',
                cancelButtonText: 'Cancel',
                width: '600px'
            });

            if (!result.isConfirmed) return;

            // Show processing indicator
            Swal.fire({
                title: 'Processing Payouts...',
                html: 'Initiating M-PESA payments. This may take a moment.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Prepare data for the Netlify function
            const payoutData = {
                tournamentId: tournamentId,
                tournamentName: tournament.name,
                payouts: winners.map(w => ({
                    phoneNumber: w.phone,
                    amount: w.amount,
                    position: w.position,
                    name: w.name,
                    userId: w.userId
                })),
                initiatedBy: this.currentUser.email,
                initiatedAt: new Date().toISOString()
            };

            // Call the Netlify function
            const response = await fetch('/.netlify/functions/mpesa-payout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payoutData)
            });

            const resultData = await response.json();

            if (!response.ok) {
                throw new Error(resultData.error || 'Failed to process payouts');
            }

            // Record the payout in Firestore
            const payoutRecord = {
                tournamentId: tournamentId,
                tournamentName: tournament.name,
                winners: winners,
                totalAmount: totalPayout,
                initiatedBy: this.currentUser.email,
                initiatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'processing',
                mpesaResponse: resultData,
                transactionIds: resultData.transactions || []
            };

            await this.db.collection('payouts').add(payoutRecord);

            // Update tournament status
            await tournamentDoc.ref.update({
                payoutProcessed: true,
                payoutProcessedAt: firebase.firestore.FieldValue.serverTimestamp(),
                payoutProcessedBy: this.currentUser.email,
                payoutDetails: {
                    winners: winners,
                    totalAmount: totalPayout,
                    transactionIds: resultData.transactions || []
                }
            });

            // Show success message
            let successHtml = `
                <div style="text-align: left;">
                    <p style="color: #00ff88;">✅ Payouts initiated successfully!</p>
                    <p>💰 Total: Ksh ${totalPayout.toLocaleString()}</p>
            `;

            if (resultData.transactions && resultData.transactions.length > 0) {
                successHtml += '<p>📱 Transaction IDs:</p><ul style="color: #888;">';
                resultData.transactions.forEach(tx => {
                    successHtml += `<li>${tx.TransactionID || 'Pending'}</li>`;
                });
                successHtml += '</ul>';
            }

            successHtml += `
                    <p style="margin-top: 15px;">Check the <strong>payouts</strong> collection for full details.</p>
                </div>
            `;

            Swal.fire({
                icon: 'success',
                title: 'Payouts Initiated!',
                html: successHtml,
                confirmButtonText: 'Done',
                confirmButtonColor: '#00ff88'
            });

            // Refresh tournaments list
            this.loadTournaments();

        } catch (error) {
            console.error('Payout processing error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Payout Failed',
                text: error.message,
                confirmButtonColor: '#ff4444'
            });
        }
    }

    /**
     * Prepare payout for a tournament (UI helper)
     * Opens a modal to input winner details
     */
    async preparePayout(tournamentId) {
        try {
            // Verify super admin
            if (this.currentUser.email.toLowerCase() !== this.SUPER_ADMIN_EMAIL.toLowerCase()) {
                throw new Error("❌ Only Super Admin can process payouts");
            }

            // First calculate the prize pool
            const prizeBreakdown = await this.calculateFinalPrize(tournamentId);

            // Get tournament details
            const tournamentDoc = await this.db.collection('tournaments').doc(tournamentId).get();
            const tournament = tournamentDoc.data();

            // Create a modal to input winners
            const { value: winners } = await Swal.fire({
                title: `💰 Prize Payout: ${tournament.name}`,
                html: `
                    <div style="text-align: left;">
                        <div style="background: rgba(0,255,136,0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="color: #00ff88; margin-bottom: 10px;">Prize Breakdown</h4>
                            <p>Total Pool: <strong>Ksh ${prizeBreakdown.totalPool.toLocaleString()}</strong> (${prizeBreakdown.numberOfPayments} payments)</p>
                            <p>🥇 1st Place (60%): <strong>Ksh ${prizeBreakdown.firstPlace.toLocaleString()}</strong></p>
                            <p>🥈 2nd Place (25%): <strong>Ksh ${prizeBreakdown.secondPlace.toLocaleString()}</strong></p>
                            <p>🥉 3rd Place (10%): <strong>Ksh ${prizeBreakdown.thirdPlace.toLocaleString()}</strong></p>
                            <p style="color: #ffaa00;">💰 Arena Commission (5%): <strong>Ksh ${prizeBreakdown.arenaCommission.toLocaleString()}</strong></p>
                        </div>
                        
                        <h4 style="color: #fff; margin: 20px 0 10px;">Enter Winner Details</h4>
                        
                        <div id="winners-container">
                            <div class="winner-input" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
                                <h5 style="color: #ffaa00; margin-bottom: 10px;">🥇 First Place</h5>
                                <input id="winner1-name" class="swal2-input" placeholder="Winner Name" style="width: 90%; margin-bottom: 5px;" required>
                                <input id="winner1-phone" class="swal2-input" placeholder="Phone Number (e.g., 0712345678)" style="width: 90%;" required>
                                <input type="hidden" id="winner1-amount" value="${prizeBreakdown.firstPlace}">
                            </div>
                            
                            <div class="winner-input" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
                                <h5 style="color: #00ff88; margin-bottom: 10px;">🥈 Second Place</h5>
                                <input id="winner2-name" class="swal2-input" placeholder="Winner Name" style="width: 90%; margin-bottom: 5px;" required>
                                <input id="winner2-phone" class="swal2-input" placeholder="Phone Number (e.g., 0712345678)" style="width: 90%;" required>
                                <input type="hidden" id="winner2-amount" value="${prizeBreakdown.secondPlace}">
                            </div>
                            
                            <div class="winner-input" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
                                <h5 style="color: #ffaa00; margin-bottom: 10px;">🥉 Third Place</h5>
                                <input id="winner3-name" class="swal2-input" placeholder="Winner Name" style="width: 90%; margin-bottom: 5px;" required>
                                <input id="winner3-phone" class="swal2-input" placeholder="Phone Number (e.g., 0712345678)" style="width: 90%;" required>
                                <input type="hidden" id="winner3-amount" value="${prizeBreakdown.thirdPlace}">
                            </div>
                        </div>
                        
                        <p style="color: #888; font-size: 0.8rem; margin-top: 10px;">
                            ⚠️ Ensure phone numbers are correct. Payments are final once processed.
                        </p>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Process Payouts',
                confirmButtonColor: '#00ff88',
                cancelButtonText: 'Cancel',
                width: '600px',
                preConfirm: () => {
                    // Validate inputs
                    const winners = [
                        {
                            position: '1st',
                            name: document.getElementById('winner1-name').value,
                            phone: document.getElementById('winner1-phone').value,
                            amount: parseFloat(document.getElementById('winner1-amount').value)
                        },
                        {
                            position: '2nd',
                            name: document.getElementById('winner2-name').value,
                            phone: document.getElementById('winner2-phone').value,
                            amount: parseFloat(document.getElementById('winner2-amount').value)
                        },
                        {
                            position: '3rd',
                            name: document.getElementById('winner3-name').value,
                            phone: document.getElementById('winner3-phone').value,
                            amount: parseFloat(document.getElementById('winner3-amount').value)
                        }
                    ];

                    // Validate all fields are filled
                    for (const winner of winners) {
                        if (!winner.name || !winner.phone) {
                            Swal.showValidationMessage(`All winner fields are required for ${winner.position} place`);
                            return false;
                        }
                        
                        // Validate phone number (basic Kenyan format)
                        const phone = winner.phone.replace(/\s+/g, '');
                        const phoneRegex = /^(?:(?:\+?254|0)?[17]\d{8})$/;
                        if (!phoneRegex.test(phone)) {
                            Swal.showValidationMessage(`Invalid phone number for ${winner.position} place. Use format: 0712345678`);
                            return false;
                        }
                        
                        // Convert phone to international format if needed
                        if (phone.startsWith('0')) {
                            winner.phone = '254' + phone.substring(1);
                        } else if (phone.startsWith('7') || phone.startsWith('1')) {
                            winner.phone = '254' + phone;
                        } else if (!phone.startsWith('254')) {
                            winner.phone = '254' + phone;
                        }
                    }

                    return winners;
                }
            });

            if (winners) {
                // Process the payouts
                await this.processTournamentPayouts(tournamentId, winners);
            }

        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }

    /**
     * Load completed tournaments for payout tab
     */
    async loadCompletedTournamentsForPayout() {
        const container = document.getElementById('completed-tournaments-list');
        if (!container) return;
        
        container.innerHTML = '<p style="text-align:center; color:#888;">Loading completed tournaments...</p>';
        
        try {
            const snapshot = await this.db.collection('tournaments')
                .where('status', '==', 'completed')
                .where('prizePool', '!=', '')
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) {
                container.innerHTML = '<div class="empty-state"><span class="empty-icon">💰</span><h3>No Completed Tournaments</h3><p>Completed tournaments with prize pools will appear here for payout processing.</p></div>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const t = doc.data();
                const hasPayout = t.payoutProcessed;
                
                html += `
                    <div class="match-card" style="${hasPayout ? 'opacity: 0.7;' : ''}">
                        <div class="match-meta">
                            <span>🏁 Completed</span>
                            <span>${t.endDate?.toDate ? new Date(t.endDate.toDate()).toLocaleDateString() : 'Recently'}</span>
                        </div>
                        
                        <div style="font-size: 1.2rem; font-weight: bold; color: #fff; margin: 10px 0;">
                            ${t.name}
                        </div>
                        
                        <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin: 10px 0;">
                            <div style="color: #ffaa00;">🏆 Prize Pool: ${t.prizePool}</div>
                            ${t.prizeCalculation ? `
                                <div style="margin-top: 8px; color: #888; font-size: 0.9rem;">
                                    <div>Total Pool: Ksh ${t.prizeCalculation.totalPool}</div>
                                    <div>🥇 Ksh ${t.prizeCalculation.firstPlace} | 🥈 Ksh ${t.prizeCalculation.secondPlace} | 🥉 Ksh ${t.prizeCalculation.thirdPlace}</div>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${hasPayout ? `
                            <div style="background: rgba(0,255,136,0.1); padding: 8px; border-radius: 8px; text-align: center; margin: 10px 0;">
                                <span style="color: #00ff88;">✅ Payout Processed on ${t.payoutProcessedAt?.toDate ? new Date(t.payoutProcessedAt.toDate()).toLocaleDateString() : 'Unknown'}</span>
                            </div>
                        ` : `
                            <div class="action-row">
                                <button onclick="window.adminManager.preparePayout('${doc.id}')" class="btn-approve" style="background: #ffaa00; width: 100%;">
                                    💰 Process Prize Payout
                                </button>
                            </div>
                        `}
                    </div>`;
            });
            
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading completed tournaments:', error);
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>Failed to load tournaments.</p></div>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { 
    window.adminManager = new AdminManager(); 
});