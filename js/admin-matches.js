// UON HUB/js/admin-matches.js - Match Management Module
class AdminMatches {
    constructor() {
        this.db = null;
        this.allPlayers = []; // Cache for player dropdowns
        this.tournaments = []; // Cache for tournaments
        this.activeMatchFilter = 'pending'; // Default filter: 'pending', 'disputed', or 'all'
    }

    init(db) {
        this.db = db;
        console.log("AdminMatches module initialized");
        
        // Add filter buttons if they don't exist
        this.addMatchFilters();
        
        // Load all players with gamerTags when admin page loads
        this.loadAllPlayers();
    }

    // Load all users with gamerTags from Firestore
    async loadAllPlayers() {
        try {
            console.log("Loading all players with gamerTags...");
            const snapshot = await this.db.collection('users')
                .where('gamerTag', '!=', null)
                .get();
            
            this.allPlayers = [];
            snapshot.forEach(doc => {
                const user = doc.data();
                if (user.gamerTag && user.gamerTag.trim() !== '') {
                    this.allPlayers.push({
                        id: doc.id,
                        gamerTag: user.gamerTag,
                        fullName: user.fullName || 'Unknown',
                        displayName: user.displayName || user.fullName || 'Unknown'
                    });
                }
            });
            
            // Sort players by gamerTag
            this.allPlayers.sort((a, b) => a.gamerTag.localeCompare(b.gamerTag));
            
            console.log(`Loaded ${this.allPlayers.length} players with gamerTags`);
            
            // Populate the dropdowns
            this.populateDirectEntryPlayers();
            
        } catch (error) {
            console.error("Error loading players:", error);
        }
    }

    // Add filter buttons for match results
    addMatchFilters() {
        const matchesTab = document.getElementById('tab-matches');
        if (!matchesTab) return;
        
        // Check if filters already exist
        if (document.getElementById('match-filters')) return;
        
        const filterHtml = `
            <div id="match-filters" style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="window.adminMatches.setMatchFilter('pending')" 
                        id="filter-pending" 
                        class="tab-btn active"
                        style="font-size: 0.85rem; padding: 8px 15px;">
                    ⚡ Pending Matches
                </button>
                <button onclick="window.adminMatches.setMatchFilter('disputed')" 
                        id="filter-disputed" 
                        class="tab-btn"
                        style="font-size: 0.85rem; padding: 8px 15px;">
                    ⚠️ Disputed Matches
                </button>
                <button onclick="window.adminMatches.setMatchFilter('all')" 
                        id="filter-all" 
                        class="tab-btn"
                        style="font-size: 0.85rem; padding: 8px 15px;">
                    📋 All Matches
                </button>
            </div>
        `;
        
        // Insert filters before the matches container
        const container = document.getElementById('pending-matches-container');
        if (container && container.parentNode) {
            container.parentNode.insertAdjacentHTML('afterbegin', filterHtml);
        }
    }

    // Set active match filter
    setMatchFilter(filterType) {
        this.activeMatchFilter = filterType;
        
        // Update button states
        document.querySelectorAll('#match-filters .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.getElementById(`filter-${filterType}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Reload matches with new filter
        this.loadMatchResults();
    }

    // --- MATCH RESULTS TAB ---
    async loadMatchResults() {
        const container = document.getElementById('pending-matches-container');
        if (!container) return;
        
        container.innerHTML = '<p style="text-align:center; color:#888;">Loading match results...</p>';
        
        try {
            let query = this.db.collection('matches');
            
            // Apply filter based on active filter
            if (this.activeMatchFilter === 'pending') {
                query = query.where('status', '==', 'pending');
            } else if (this.activeMatchFilter === 'disputed') {
                query = query.where('status', '==', 'disputed');
            } else if (this.activeMatchFilter === 'all') {
                // No filter for "all" - we'll get all matches
            }
            
            query = query.orderBy('timestamp', 'desc');
            const snapshot = await query.get();

            if (snapshot.empty) {
                let emptyMessage = '';
                let emptyIcon = '';
                
                switch(this.activeMatchFilter) {
                    case 'pending':
                        emptyMessage = 'All Caught Up';
                        emptyIcon = '✓';
                        break;
                    case 'disputed':
                        emptyMessage = 'No Disputed Matches';
                        emptyIcon = '✅';
                        break;
                    case 'all':
                        emptyMessage = 'No Matches Found';
                        emptyIcon = '📋';
                        break;
                }
                
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">${emptyIcon}</span>
                        <h3>${emptyMessage}</h3>
                        <p>${this.activeMatchFilter === 'disputed' ? 'No matches need review.' : 'No pending match results to review.'}</p>
                    </div>`;
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const match = doc.data();
                const dateStr = match.timestamp ? match.timestamp.toDate().toLocaleDateString() : 'Recent';
                
                // Determine card style based on status
                let cardStyle = '';
                let statusBadge = '';
                
                if (match.status === 'disputed') {
                    cardStyle = 'border-left: 4px solid #ff9800; background: rgba(255, 152, 0, 0.05);';
                    statusBadge = '<span style="background: rgba(255, 152, 0, 0.2); color: #ff9800; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 10px;">⚠️ DISPUTED</span>';
                } else if (match.status === 'rejected') {
                    cardStyle = 'border-left: 4px solid #ff4444; background: rgba(255, 68, 68, 0.05);';
                    statusBadge = '<span style="background: rgba(255, 68, 68, 0.2); color: #ff4444; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 10px;">❌ REJECTED</span>';
                } else if (match.status === 'approved') {
                    cardStyle = 'border-left: 4px solid #00ff88; background: rgba(0, 255, 136, 0.05);';
                    statusBadge = '<span style="background: rgba(0, 255, 136, 0.2); color: #00ff88; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 10px;">✅ APPROVED</span>';
                }
                
                // Add dispute reason if available
                let disputeSection = '';
                if (match.disputeReason) {
                    disputeSection = `
                        <div style="background: rgba(255, 152, 0, 0.1); border-left: 3px solid #ff9800; padding: 10px; margin: 10px 0; border-radius: 4px;">
                            <div style="font-size: 0.8rem; color: #ff9800; font-weight: bold; margin-bottom: 5px;">
                                ⚠️ Dispute Reason:
                            </div>
                            <div style="font-size: 0.9rem; color: #ffcc80;">
                                "${match.disputeReason}"
                            </div>
                            ${match.screenshotUrl ? `
                                <div style="margin-top: 8px;">
                                    <a href="${match.screenshotUrl}" target="_blank" 
                                       style="color: #00ff88; text-decoration: none; font-size: 0.8rem;">
                                        📸 View Submitted Screenshot
                                    </a>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }
                
                // Determine action buttons based on status
                let actionButtons = '';
                if (match.status === 'pending' || match.status === 'disputed') {
                    actionButtons = `
                        <div class="action-row">
                            <button onclick="window.adminMatches.approveMatch('${doc.id}', '${match.userId}')" class="btn-approve">
                                ✅ Approve Result
                            </button>
                            <button onclick="window.adminMatches.rejectMatch('${doc.id}')" class="btn-reject">
                                🗑️ Reject
                            </button>
                            ${match.status === 'disputed' ? `
                                <button onclick="window.adminMatches.correctScore('${doc.id}')" class="btn-approve" style="background: #ff9800; margin-top: 10px;">
                                    ✏️ Correct Score
                                </button>
                            ` : ''}
                        </div>
                    `;
                } else if (match.status === 'approved') {
                    actionButtons = `
                        <div style="text-align: center; padding: 10px; color: #00ff88; font-size: 0.9rem;">
                            ✅ Approved on ${match.approvedAt ? match.approvedAt.toDate().toLocaleDateString() : 'N/A'}
                        </div>
                    `;
                } else if (match.status === 'rejected') {
                    actionButtons = `
                        <div style="text-align: center; padding: 10px; color: #ff4444; font-size: 0.9rem;">
                            ❌ Rejected on ${match.rejectedAt ? match.rejectedAt.toDate().toLocaleDateString() : 'N/A'}
                        </div>
                    `;
                }
                
                html += `
                    <div class="match-card" style="${cardStyle}">
                        <div class="match-meta">
                            <span>${match.tournamentName || 'Friendly Match'} ${statusBadge}</span>
                            <span>${dateStr}</span>
                        </div>
                        
                        ${disputeSection}
                        
                        <div class="match-scoreboard">
                            <div class="score-box">
                                <div class="score-val">${match.myScore}</div>
                                <span class="player-tag">@${match.userTag}</span>
                            </div>
                            <div class="vs-badge">VS</div>
                            <div class="score-box">
                                <div class="score-val">${match.oppScore}</div>
                                <span class="player-tag">@${match.opponentTag}</span>
                            </div>
                        </div>

                        ${actionButtons}
                    </div>`;
            });
            container.innerHTML = html;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>Failed to load match results.</p></div>';
        }
    }

    // --- MATCH APPROVAL FUNCTION WITH GOALS, CLEAN SHEETS, AND MATCHES PLAYED ---
    async approveMatch(matchId, userId) {
        const confirmation = await Swal.fire({
            title: 'Approve Match Result?',
            text: `This will update stats for BOTH players based on the score, including goals scored/conceded, clean sheets, and matches played.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Approve',
            cancelButtonText: 'Cancel'
        });

        if (!confirmation.isConfirmed) return;

        const matchRef = this.db.collection('matches').doc(matchId);

        try {
            await this.db.runTransaction(async (t) => {
                // 1. Get Match Data to find both players
                const matchDoc = await t.get(matchRef);
                if (!matchDoc.exists) throw "Match not found!";
                
                const matchData = matchDoc.data();
                const opponentId = matchData.opponentId;

                if (!opponentId) throw "Opponent ID missing in match record. Cannot update stats.";

                // 2. Get Both User Profiles
                const userRef = this.db.collection('users').doc(userId);
                const oppRef = this.db.collection('users').doc(opponentId);

                const userDoc = await t.get(userRef);
                const oppDoc = await t.get(oppRef);

                if (!userDoc.exists || !oppDoc.exists) throw "One of the players does not exist!";

                // 3. Convert scores to numbers to avoid string concatenation and query failures
                const myScore = Number(matchData.myScore || 0);
                const oppScore = Number(matchData.oppScore || 0);

                // 4. Updated helper function to include goals, clean sheets, and matches played
                const updateStats = (currentData, isWinner, isDraw, myGoals, oppGoals) => {
                    let wins = currentData.wins || 0;
                    let losses = currentData.losses || 0;
                    let draws = currentData.draws || 0;
                    let streak = currentData.winStreak || 0;
                    
                    // Goals tracking
                    let goalsScored = (currentData.goalsScored || 0) + myGoals;
                    let goalsConceded = (currentData.goalsConceded || 0) + oppGoals;
                    
                    // Matches played
                    let matchesPlayed = (currentData.matchesPlayed || 0) + 1;
                    
                    // Clean sheets
                    let cleanSheets = currentData.cleanSheets || 0;
                    if (oppGoals === 0) {
                        cleanSheets++;
                    }

                    if (isDraw) {
                        draws++;
                        streak = 0;
                    } else if (isWinner) {
                        wins++;
                        streak++;
                    } else {
                        losses++;
                        streak = 0;
                    }

                    const total = wins + losses + draws;
                    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
                    
                    // Calculate goal difference
                    const goalDifference = goalsScored - goalsConceded;

                    return { 
                        wins, 
                        losses, 
                        draws, 
                        winRate, 
                        winStreak: streak,
                        goalsScored,
                        goalsConceded,
                        goalDifference,
                        cleanSheets,
                        matchesPlayed
                    };
                };

                // 5. Determine Results from Score Comparison
                let isDraw = (myScore === oppScore);
                let userWon = (myScore > oppScore);
                
                // 6. Calculate New Stats for both players with goals
                const userNewStats = updateStats(
                    userDoc.data(), 
                    userWon, 
                    isDraw, 
                    myScore,    // User's goals scored (as number)
                    oppScore    // Goals conceded by user (as number)
                );
                
                const oppNewStats = updateStats(
                    oppDoc.data(), 
                    !userWon, 
                    isDraw, 
                    oppScore,   // Opponent's goals scored (as number)
                    myScore     // Goals conceded by opponent (as number)
                );

                // 7. Update DB with enhanced stats
                t.update(userRef, userNewStats);
                t.update(oppRef, oppNewStats);
                
                // 8. Update match record with approval timestamp and status
                t.update(matchRef, { 
                    status: 'approved',
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    approvalTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    approvedBy: window.adminManager.adminEmail,
                    disputeReason: null,
                    isDisputed: false
                });
            });

            Swal.fire('Success!', 'Match approved. Stats updated for both players (including goals, clean sheets, and matches played).', 'success');
            this.loadMatchResults();
            window.adminManager.loadDashboardStats();

        } catch (error) {
            console.error('Transaction error:', error);
            Swal.fire('Error', 'Failed to approve: ' + error.message, 'error');
        }
    }

    async rejectMatch(matchId) {
        const result = await Swal.fire({
            title: 'Reject Result?',
            text: "This will mark the match as rejected in player profiles.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, Reject'
        });

        if (result.isConfirmed) {
            try {
                await this.db.collection('matches').doc(matchId).update({
                    status: 'rejected',
                    rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    approvalTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    disputeReason: null,
                    isDisputed: false
                });
                this.loadMatchResults();
                window.adminManager.loadDashboardStats();
                Swal.fire('Rejected', 'Match result marked as rejected.', 'success');
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    }

    // --- CORRECT SCORE FUNCTION FOR DISPUTED MATCHES ---
    async correctScore(matchId) {
        try {
            // Get match data
            const matchDoc = await this.db.collection('matches').doc(matchId).get();
            if (!matchDoc.exists) {
                Swal.fire('Error', 'Match not found!', 'error');
                return;
            }
            
            const matchData = matchDoc.data();
            
            // Create form for score correction
            const { value: formValues } = await Swal.fire({
                title: '✏️ Correct Match Score',
                html: `
                    <div style="text-align: center; margin: 20px 0;">
                        <p style="color: #888; margin-bottom: 15px;">Correct the score for:</p>
                        <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                            <div style="text-align: center;">
                                <div style="font-weight: bold; color: #fff;">@${matchData.userTag}</div>
                                <input id="correct-p1-score" type="number" min="0" max="20" value="${matchData.myScore}" 
                                       style="width: 80px; padding: 10px; text-align: center; font-size: 1.2rem; background: #222; border: 1px solid #444; color: #fff; border-radius: 8px;">
                            </div>
                            <div style="font-size: 1.5rem; color: #666;">VS</div>
                            <div style="text-align: center;">
                                <div style="font-weight: bold; color: #fff;">@${matchData.opponentTag}</div>
                                <input id="correct-p2-score" type="number" min="0" max="20" value="${matchData.oppScore}" 
                                       style="width: 80px; padding: 10px; text-align: center; font-size: 1.2rem; background: #222; border: 1px solid #444; color: #fff; border-radius: 8px;">
                            </div>
                        </div>
                        <div style="margin-top: 20px; color: #ff9800; font-size: 0.9rem;">
                            ⚠️ This will override the current score and update player stats.
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Update Score',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#ff9800',
                preConfirm: () => {
                    const p1Score = parseInt(document.getElementById('correct-p1-score').value);
                    const p2Score = parseInt(document.getElementById('correct-p2-score').value);
                    
                    if (isNaN(p1Score) || isNaN(p2Score)) {
                        Swal.showValidationMessage('Please enter valid scores');
                        return false;
                    }
                    
                    if (p1Score < 0 || p2Score < 0) {
                        Swal.showValidationMessage('Scores cannot be negative');
                        return false;
                    }
                    
                    return { p1Score, p2Score };
                }
            });
            
            if (!formValues) return;
            
            const { p1Score, p2Score } = formValues;
            
            // Confirm update
            const confirmation = await Swal.fire({
                title: 'Update Score?',
                html: `
                    <div style="text-align: center; margin: 20px 0;">
                        <p>Update score from <strong>${matchData.myScore}-${matchData.oppScore}</strong> to <strong>${p1Score}-${p2Score}</strong>?</p>
                        <p style="color: #ff9800; font-size: 0.9rem;">
                            This will update stats for both players based on the corrected score.
                        </p>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, Update',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#ff9800'
            });
            
            if (!confirmation.isConfirmed) return;
            
            // Update match with corrected score
            await this.db.runTransaction(async (t) => {
                const matchRef = this.db.collection('matches').doc(matchId);
                const userRef = this.db.collection('users').doc(matchData.userId);
                const oppRef = this.db.collection('users').doc(matchData.opponentId);
                
                // Get current player data
                const userDoc = await t.get(userRef);
                const oppDoc = await t.get(oppRef);
                
                if (!userDoc.exists || !oppDoc.exists) {
                    throw "One of the players does not exist!";
                }
                
                const userData = userDoc.data();
                const oppData = oppDoc.data();
                
                // Helper to calculate new stats
                const calculateNewStats = (currentData, oldScored, oldConceded, newScored, newConceded) => {
                    // Remove old goals
                    let goalsScored = (currentData.goalsScored || 0) - oldScored;
                    let goalsConceded = (currentData.goalsConceded || 0) - oldConceded;
                    
                    // Remove old clean sheet if applicable
                    let cleanSheets = currentData.cleanSheets || 0;
                    if (oldConceded === 0) {
                        cleanSheets = Math.max(0, cleanSheets - 1);
                    }
                    
                    // Add new goals
                    goalsScored += newScored;
                    goalsConceded += newConceded;
                    
                    // Add new clean sheet if applicable
                    if (newConceded === 0) {
                        cleanSheets++;
                    }
                    
                    // Calculate win/loss/draw based on new score
                    let wins = currentData.wins || 0;
                    let losses = currentData.losses || 0;
                    let draws = currentData.draws || 0;
                    let streak = currentData.winStreak || 0;
                    
                    // First, we need to determine the old result to remove it
                    const oldWin = oldScored > oldConceded;
                    const oldDraw = oldScored === oldConceded;
                    const oldLoss = oldScored < oldConceded;
                    
                    // Remove old result
                    if (oldDraw) draws--;
                    else if (oldWin) wins--;
                    else losses--;
                    
                    // Reset streak - we'll recalculate it after
                    streak = 0;
                    
                    // Add new result
                    const newWin = newScored > newConceded;
                    const newDraw = newScored === newConceded;
                    const newLoss = newScored < newConceded;
                    
                    if (newDraw) draws++;
                    else if (newWin) wins++;
                    else losses++;
                    
                    // Recalculate win streak (this is simplified - in reality we'd need to recalculate all matches)
                    // For now, we'll set it to 1 if they won, 0 otherwise
                    streak = newWin ? 1 : 0;
                    
                    // Recalculate win rate
                    const total = wins + losses + draws;
                    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
                    
                    // Calculate goal difference
                    const goalDifference = goalsScored - goalsConceded;
                    
                    return {
                        wins,
                        losses,
                        draws,
                        winRate,
                        winStreak: streak,
                        goalsScored,
                        goalsConceded,
                        goalDifference,
                        cleanSheets,
                        matchesPlayed: currentData.matchesPlayed || 0 // This stays the same
                    };
                };
                
                // Calculate new stats for both players
                const userNewStats = calculateNewStats(
                    userData,
                    matchData.myScore,
                    matchData.oppScore,
                    p1Score,
                    p2Score
                );
                
                const oppNewStats = calculateNewStats(
                    oppData,
                    matchData.oppScore,
                    matchData.myScore,
                    p2Score,
                    p1Score
                );
                
                // Update players
                t.update(userRef, userNewStats);
                t.update(oppRef, oppNewStats);
                
                // Update match record
                t.update(matchRef, {
                    myScore: p1Score,
                    oppScore: p2Score,
                    status: 'approved',
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    approvalTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    approvedBy: window.adminManager.adminEmail,
                    disputeReason: null,
                    isDisputed: false,
                    correctedBy: window.adminManager.adminEmail,
                    correctedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    correctionNotes: `Score corrected from ${matchData.myScore}-${matchData.oppScore} to ${p1Score}-${p2Score}`
                });
            });
            
            Swal.fire({
                icon: 'success',
                title: 'Score Corrected!',
                text: 'Match score has been updated and player stats have been recalculated.',
                timer: 2000,
                showConfirmButton: false
            });
            
            this.loadMatchResults();
            window.adminManager.loadDashboardStats();
            
        } catch (error) {
            console.error('Error correcting score:', error);
            Swal.fire('Error', 'Failed to correct score: ' + error.message, 'error');
        }
    }

    // --- DIRECT ENTRY TAB FUNCTIONS ---
    
    // Populate dropdowns with all players who have gamerTags
    async populateDirectEntryPlayers() {
        const p1Select = document.getElementById('admin-p1-select');
        const p2Select = document.getElementById('admin-p2-select');
        
        if (!p1Select || !p2Select) return;

        try {
            if (this.allPlayers.length === 0) {
                p1Select.innerHTML = '<option value="">No players found</option>';
                p2Select.innerHTML = '<option value="">No players found</option>';
                return;
            }

            // Generate HTML options
            const optionsHtml = this.allPlayers.map(p => 
                `<option value="${p.id}" data-tag="${p.gamerTag}">@${p.gamerTag} (${p.fullName})</option>`
            ).join('');

            const placeholder = '<option value="">Select a player...</option>';
            p1Select.innerHTML = placeholder + optionsHtml;
            p2Select.innerHTML = placeholder + optionsHtml;

            console.log(`Populated dropdowns with ${this.allPlayers.length} players`);

        } catch (error) {
            console.error("Error populating player dropdowns:", error);
            p1Select.innerHTML = '<option value="">Error loading players</option>';
            p2Select.innerHTML = '<option value="">Error loading players</option>';
        }
    }

    // Submit admin direct entry match (with auto-approval)
    async submitAdminDirectEntry() {
        const p1Id = document.getElementById('admin-p1-select').value;
        const p2Id = document.getElementById('admin-p2-select').value;
        const p1Score = document.getElementById('admin-p1-score').value;
        const p2Score = document.getElementById('admin-p2-score').value;
        const tournament = document.getElementById('admin-match-tourney').value;

        if (!p1Id || !p2Id || p1Score === "" || p2Score === "") {
            Swal.fire('Error', 'Please select both players and enter scores.', 'error');
            return;
        }

        if (p1Id === p2Id) {
            Swal.fire('Error', 'Players cannot play against themselves.', 'error');
            return;
        }

        // Validate that both selected players exist in the allPlayers array
        const p1Exists = this.allPlayers.some(p => p.id === p1Id);
        const p2Exists = this.allPlayers.some(p => p.id === p2Id);
        
        if (!p1Exists || !p2Exists) {
            Swal.fire('Error', 'One or both selected players do not exist in the database.', 'error');
            return;
        }

        try {
            Swal.fire({ title: 'Submitting...', didOpen: () => Swal.showLoading() });

            // Get player details from allPlayers array
            const p1Data = this.allPlayers.find(p => p.id === p1Id);
            const p2Data = this.allPlayers.find(p => p.id === p2Id);

            const matchData = {
                userId: p1Id,
                userTag: p1Data.gamerTag,
                userDisplayName: p1Data.fullName,
                opponentId: p2Id,
                opponentTag: p2Data.gamerTag,
                opponentDisplayName: p2Data.fullName,
                myScore: Number(p1Score),
                oppScore: Number(p2Score),
                tournamentName: tournament || 'Admin Direct Entry',
                status: 'approved',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                approvalTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                approvedBy: window.adminManager.adminEmail,
                isDirectEntry: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Use transaction to also update player stats
            await this.db.runTransaction(async (t) => {
                // Get player documents
                const p1Ref = this.db.collection('users').doc(p1Id);
                const p2Ref = this.db.collection('users').doc(p2Id);
                
                const p1Doc = await t.get(p1Ref);
                const p2Doc = await t.get(p2Ref);
                
                if (!p1Doc.exists || !p2Doc.exists) {
                    throw "One or both players not found!";
                }
                
                const p1Data = p1Doc.data();
                const p2Data = p2Doc.data();
                
                // Helper function to update stats (same as approveMatch)
                const updateStats = (currentData, isWinner, isDraw, myGoals, oppGoals) => {
                    let wins = currentData.wins || 0;
                    let losses = currentData.losses || 0;
                    let draws = currentData.draws || 0;
                    let streak = currentData.winStreak || 0;
                    
                    // Goals tracking
                    let goalsScored = (currentData.goalsScored || 0) + myGoals;
                    let goalsConceded = (currentData.goalsConceded || 0) + oppGoals;
                    
                    // Matches played
                    let matchesPlayed = (currentData.matchesPlayed || 0) + 1;
                    
                    // Clean sheets
                    let cleanSheets = currentData.cleanSheets || 0;
                    if (oppGoals === 0) {
                        cleanSheets++;
                    }

                    if (isDraw) {
                        draws++;
                        streak = 0;
                    } else if (isWinner) {
                        wins++;
                        streak++;
                    } else {
                        losses++;
                        streak = 0;
                    }

                    const total = wins + losses + draws;
                    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
                    
                    // Calculate goal difference
                    const goalDifference = goalsScored - goalsConceded;

                    return { 
                        wins, 
                        losses, 
                        draws, 
                        winRate, 
                        winStreak: streak,
                        goalsScored,
                        goalsConceded,
                        goalDifference,
                        cleanSheets,
                        matchesPlayed
                    };
                };
                
                // Determine results
                const isDraw = (Number(p1Score) === Number(p2Score));
                const p1Won = (Number(p1Score) > Number(p2Score));
                
                // Calculate new stats
                const p1NewStats = updateStats(p1Data, p1Won, isDraw, Number(p1Score), Number(p2Score));
                const p2NewStats = updateStats(p2Data, !p1Won, isDraw, Number(p2Score), Number(p1Score));
                
                // Update player stats
                t.update(p1Ref, p1NewStats);
                t.update(p2Ref, p2NewStats);
                
                // Create match record
                const matchRef = this.db.collection('matches').doc();
                t.set(matchRef, matchData);
            });

            // Reset form
            document.getElementById('admin-p1-select').value = '';
            document.getElementById('admin-p2-select').value = '';
            document.getElementById('admin-p1-score').value = '0';
            document.getElementById('admin-p2-score').value = '0';
            document.getElementById('admin-match-tourney').value = '';
            
            // Clear search boxes
            const searchBoxes = document.querySelectorAll('.admin-search-box');
            searchBoxes.forEach(box => box.value = '');
            
            Swal.fire('Success', 'Match recorded. Player stats have been updated.', 'success');
            
            // Refresh dashboard stats
            window.adminManager.loadDashboardStats();
            
        } catch (e) {
            console.error('Error submitting admin direct entry:', e);
            Swal.fire('Error', e.message, 'error');
        }
    }
}

// Initialize module
window.adminMatches = new AdminMatches();