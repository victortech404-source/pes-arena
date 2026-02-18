class LeaderboardManager {
    constructor() {
        this.tournamentsCache = [];
        this.playersCache = [];
        this.playerMatchesCache = new Map(); // Cache for player matches
        this.allActivePlayersCache = []; // Cache for all active players with stats
        this.tournamentPlayersMap = new Map(); // Map tournament ID to player IDs
        this.currentFilter = 'all'; // Current tournament filter
        this.init();
    }

    init() {
        this.loadTournaments();
        this.loadLegendsDirectory();
        this.addStyles();
        this.setupSearch();
    }

    async loadTournaments() {
        const container = document.getElementById('lb-tournaments-container');
        if (!container) return;

        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('tournaments').orderBy('createdAt', 'desc').get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="text-center" style="color:#888;">No active tournaments found.</p>';
                return;
            }

            let html = '';
            this.tournamentsCache = [];

            snapshot.forEach(doc => {
                const t = doc.data();
                this.tournamentsCache.push({ id: doc.id, ...t });

                const hasLink = t.link && t.link.startsWith('http');
                const btnEmbed = hasLink
                    ? `<button onclick="window.leaderboardManager.showEmbed('${t.name.replace(/'/g, "\\'")}', '${t.link}')" 
                              class="btn btn-primary btn-sm flex-1 action-btn">
                          🔴 Live Bracket
                       </button>`
                    : `<button disabled class="btn btn-outline btn-sm flex-1 disabled action-btn" style="opacity:0.5; border-color:#444; color:#666;">
                          No Live Link
                       </button>`;

                const btnTable = t.standingsImg
                    ? `<button onclick="window.leaderboardManager.showImage('${doc.id}', 'standings')" 
                              class="btn btn-secondary btn-sm flex-1 action-btn">
                          📊 Table
                       </button>`
                    : `<button disabled class="btn btn-outline btn-sm flex-1 disabled action-btn" style="opacity:0.5; border-color:#444; color:#666;">
                          No Table
                       </button>`;

                const btnFixtures = t.fixturesImg
                    ? `<button onclick="window.leaderboardManager.showImage('${doc.id}', 'fixtures')" 
                              class="btn btn-outline btn-sm flex-1 action-btn">
                          📅 Fixtures
                       </button>`
                    : `<button disabled class="btn btn-outline btn-sm flex-1 disabled action-btn" style="opacity:0.5; border-color:#444; color:#666;">
                          No Fixtures
                       </button>`;

                const statusClass = this.getStatusClass(t.status || 'active');

                html += `
                    <div class="widget-card tournament-widget" data-id="${doc.id}">
                        <div class="widget-header">
                            <div class="tournament-info">
                                <h3 class="tournament-title">${t.name}</h3>
                                <p class="tournament-details">${t.platform || 'General'} • ${t.format || 'Tournament'}</p>
                            </div>
                            <div class="status-badge ${statusClass}">${t.status || 'Active'}</div>
                        </div>
                        
                        <div class="action-buttons">
                            ${btnEmbed}
                            ${btnTable}
                            ${btnFixtures}
                        </div>
                    </div>`;
            });
            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading tournaments:', error);
            container.innerHTML = '<p class="text-center" style="color:#ff6b6b;">Error loading tournament data.</p>';
        }
    }

    async loadLegendsDirectory() {
        const container = document.getElementById('legends-list-container');
        const playerCountElement = document.getElementById('player-count');
        const tournamentButtonsContainer = document.getElementById('tournament-filters-buttons');
        
        // Show loading states
        container.innerHTML = '<div class="loading-spinner"></div>';
        playerCountElement.textContent = 'Loading players...';
        
        // Load tournament filters first
        await this.loadTournamentFilters();

        try {
            const db = firebase.firestore();
            
            // Fetch all users who have a gamerTag
            const usersSnapshot = await db.collection('users')
                .where('gamerTag', '!=', '')
                .orderBy('gamerTag', 'asc')
                .get();

            // Fetch all approved tournament registrations
            const registrationsSnapshot = await db.collection('tournamentRegistrations')
                .where('status', '==', 'approved')
                .get();

            // Build tournament-player map
            this.buildTournamentPlayersMap(registrationsSnapshot);
            
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter to ensure no sensitive faculty/admin data shows
            const filteredUsers = users.filter(p => p.role !== 'faculty' && p.gamerTag);

            // Clear and update cache
            this.playersCache = [];
            
            // Process each user and add to cache
            const playerPromises = filteredUsers.map(async (userData) => {
                // Get player matches
                const matches = await this.getPlayerLastMatches(userData.id);
                
                // Get tournaments this player is registered for
                const playerTournaments = [];
                for (const [tournamentId, playerIds] of this.tournamentPlayersMap) {
                    if (playerIds.includes(userData.id)) {
                        const tournament = this.tournamentsCache.find(t => t.id === tournamentId);
                        if (tournament) {
                            playerTournaments.push(tournament.id);
                        }
                    }
                }
                
                // Create player object with proper goal statistics mapping
                const player = {
                    id: userData.id,
                    gamerTag: userData.gamerTag,
                    fullName: userData.fullName || userData.gamerTag,
                    wins: userData.wins || 0,
                    losses: userData.losses || 0,
                    draws: userData.draws || 0,
                    winStreak: userData.winStreak || 0,
                    avatar: userData.avatar || this.getDefaultAvatar(userData.gamerTag),
                    profilePic: userData.profilePic || null,
                    matches: matches,
                    recentForm: this.getRecentFormIndicators(matches),
                    role: userData.role || 'player',
                    matchesPlayed: userData.matchesPlayed || 0,
                    
                    // Fixed field names for goal statistics with fallbacks
                    goalsFor: userData.goalsFor || userData.goalsScored || 0,
                    goalsAgainst: userData.goalsAgainst || userData.goalsConceded || 0,
                    goalDifference: userData.goalDifference || 0,
                    
                    tournaments: playerTournaments // Array of tournament IDs this player is in
                };
                
                this.playersCache.push(player);
                return player;
            });

            // Wait for all player data to be processed
            const validPlayers = (await Promise.all(playerPromises)).filter(p => p !== null);
            
            // Update player count
            playerCountElement.textContent = `${validPlayers.length} players`;
            
            // Update "All Players" count badge
            const allPlayersBtn = document.querySelector('[data-tournament="all"]');
            if (allPlayersBtn) {
                const badge = allPlayersBtn.querySelector('.player-count-badge');
                if (badge) {
                    badge.textContent = validPlayers.length;
                }
            }
            
            // Render the directory with current filter
            this.renderFilteredPlayers();

        } catch (error) {
            console.error("Error loading directory:", error);
            container.innerHTML = '<p class="error-msg">Failed to load directory. Please refresh.</p>';
            playerCountElement.textContent = '0 players';
        }
    }

    async loadTournamentFilters() {
        const container = document.getElementById('tournament-filters-buttons');
        if (!container) return;

        try {
            const db = firebase.firestore();
            
            // Fetch active tournaments
            const snapshot = await db.collection('tournaments')
                .where('status', 'in', ['active', 'upcoming', 'completed'])
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="no-tournaments-msg">No tournaments available</p>';
                return;
            }

            // Store tournaments in cache
            this.tournamentsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Create filter buttons
            let buttonsHTML = `
                <button class="tournament-filter-btn active" data-tournament="all" onclick="window.leaderboardManager.setTournamentFilter('all')">
                    All Players
                    <span class="player-count-badge">0</span>
                </button>
            `;

            snapshot.forEach(doc => {
                const t = doc.data();
                buttonsHTML += `
                    <button class="tournament-filter-btn" data-tournament="${doc.id}" onclick="window.leaderboardManager.setTournamentFilter('${doc.id}')">
                        ${t.name}
                        <span class="player-count-badge" id="tournament-count-${doc.id}">0</span>
                    </button>
                `;
            });

            container.innerHTML = buttonsHTML;

        } catch (error) {
            console.error("Error loading tournament filters:", error);
            container.innerHTML = '<p class="error-msg">Failed to load tournaments</p>';
        }
    }

    buildTournamentPlayersMap(registrationsSnapshot) {
        // Clear the map
        this.tournamentPlayersMap.clear();
        
        // Group registrations by tournament
        registrationsSnapshot.forEach(doc => {
            const reg = doc.data();
            const tournamentId = reg.tournamentId;
            const playerId = reg.userId;
            
            if (tournamentId && playerId) {
                if (!this.tournamentPlayersMap.has(tournamentId)) {
                    this.tournamentPlayersMap.set(tournamentId, []);
                }
                this.tournamentPlayersMap.get(tournamentId).push(playerId);
            }
        });
        
        // Update tournament count badges
        this.updateTournamentCountBadges();
    }

    updateTournamentCountBadges() {
        // Update "All Players" count
        const allPlayersBtn = document.querySelector('[data-tournament="all"]');
        if (allPlayersBtn) {
            const allBadge = allPlayersBtn.querySelector('.player-count-badge');
            if (allBadge) {
                allBadge.textContent = this.playersCache.length;
            }
        }
        
        // Update individual tournament counts
        for (const [tournamentId, playerIds] of this.tournamentPlayersMap) {
            const tournamentBtn = document.querySelector(`[data-tournament="${tournamentId}"]`);
            if (tournamentBtn) {
                const badge = tournamentBtn.querySelector('.player-count-badge');
                if (badge) {
                    badge.textContent = playerIds.length;
                }
            }
        }
    }

    setTournamentFilter(tournamentId) {
        // Update active button
        const buttons = document.querySelectorAll('.tournament-filter-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        const activeBtn = document.querySelector(`[data-tournament="${tournamentId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Update current filter
        this.currentFilter = tournamentId;
        
        // Apply filter
        this.renderFilteredPlayers();
    }

    renderFilteredPlayers() {
        const container = document.getElementById('legends-list-container');
        const noResultsMsg = document.getElementById('no-results-message');
        const emptyTournamentMsg = document.getElementById('empty-tournament-message');
        const playerCountElement = document.getElementById('player-count');
        
        // Hide all messages initially
        noResultsMsg.style.display = 'none';
        emptyTournamentMsg.style.display = 'none';
        container.style.display = 'grid';
        
        // Filter players based on current filter
        let filteredPlayers;
        
        if (this.currentFilter === 'all') {
            filteredPlayers = this.playersCache;
        } else {
            // Get player IDs for this tournament
            const tournamentPlayerIds = this.tournamentPlayersMap.get(this.currentFilter) || [];
            
            // Filter players who are in this tournament
            filteredPlayers = this.playersCache.filter(player => 
                tournamentPlayerIds.includes(player.id)
            );
            
            // Show empty tournament message if no players
            if (filteredPlayers.length === 0) {
                container.style.display = 'none';
                emptyTournamentMsg.style.display = 'block';
                playerCountElement.textContent = `0 of ${this.playersCache.length} players`;
                return;
            }
        }
        
        // Update player count
        playerCountElement.textContent = `${filteredPlayers.length} of ${this.playersCache.length} players`;
        
        // Render players
        container.innerHTML = filteredPlayers.map(p => {
            const total = (p.wins || 0) + (p.losses || 0) + (p.draws || 0);
            const winRate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
            const record = `${p.wins || 0}-${p.draws || 0}-${p.losses || 0}`;

            return `
                <div class="player-directory-card" data-player-id="${p.id}">
                    <div class="directory-avatar-container">
                        ${p.profilePic 
                            ? `<img src="${p.profilePic}" class="directory-avatar" alt="${p.gamerTag}">`
                            : `<div class="directory-avatar-default" style="background-color: ${p.avatar};">${p.gamerTag.charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <h3 class="directory-tag">${p.gamerTag}</h3>
                    
                    <div class="recent-form" id="form-${p.id}">
                        ${this.renderFormIndicator(p.recentForm)}
                    </div>

                    <div class="directory-stats-row">
                        <span class="stat-badge wr-badge">${winRate}% WR</span>
                        <span class="stat-badge record-badge">${record}</span>
                    </div>

                    <button class="btn-view-stats" onclick="window.leaderboardManager.showPublicProfile('${p.id}')">
                        📊 View Stats
                    </button>
                </div>
            `;
        }).join('');
        
        // Populate form indicators for filtered players
        filteredPlayers.forEach(p => {
            this.populatePlayerForm(p.id, `form-${p.id}`);
        });
    }

    async populatePlayerForm(userId, targetElementId) {
        const container = document.getElementById(targetElementId);
        if (!container) return;

        try {
            // Fetch last 5 approved matches for this specific player
            // We look for matches where the user was either player 1 or player 2
            const snapshot = await db.collection('matches')
                .where('status', '==', 'approved')
                .orderBy('approvedAt', 'desc')
                .get();

            const recentMatches = snapshot.docs
                .map(doc => doc.data())
                .filter(m => m.userId === userId || m.opponentId === userId)
                .slice(0, 5);

            if (recentMatches.length === 0) {
                container.innerHTML = '<span style="color:#666; font-size:0.7rem;">No matches yet</span>';
                return;
            }

            container.innerHTML = recentMatches.map(m => {
                let result = '';
                const isSubmitter = m.userId === userId;
                const myScore = isSubmitter ? Number(m.myScore) : Number(m.oppScore);
                const oppScore = isSubmitter ? Number(m.oppScore) : Number(m.myScore);

                if (myScore > oppScore) result = 'W';
                else if (myScore < oppScore) result = 'L';
                else result = 'D';

                return `<span class="form-circle form-${result.toLowerCase()}">${result}</span>`;
            }).join('');

        } catch (error) {
            console.error("Error fetching form:", error);
            container.innerHTML = '<span style="color:#666; font-size:0.7rem;">Error loading form</span>';
        }
    }

    renderFormIndicator(recentForm) {
        let html = '';
        // Show last 5 matches
        for (let i = 0; i < 5; i++) {
            if (i < recentForm.length && recentForm[i].result) {
                html += `<span class="form-dot ${recentForm[i].result === 'W' ? 'win' : recentForm[i].result === 'L' ? 'loss' : 'draw'}"></span>`;
            } else {
                html += '<span class="form-dot empty"></span>';
            }
        }
        return html;
    }

    async getPlayerLastMatches(userId) {
        // Check cache first
        if (this.playerMatchesCache.has(userId)) {
            return this.playerMatchesCache.get(userId);
        }

        try {
            const db = firebase.firestore();
            
            // Query matches where player is either userId or opponentId AND status is 'approved'
            const matchesQuery = await db.collection('matches')
                .where('status', '==', 'approved')
                .orderBy('approvedAt', 'desc')
                .get();

            const recentMatches = matchesQuery.docs
                .map(doc => doc.data())
                .filter(m => m.userId === userId || m.opponentId === userId)
                .slice(0, 5);

            const matches = recentMatches.map(m => {
                let result = '';
                const isSubmitter = m.userId === userId;
                const myScore = isSubmitter ? Number(m.myScore) : Number(m.oppScore);
                const oppScore = isSubmitter ? Number(m.oppScore) : Number(m.myScore);

                if (myScore > oppScore) result = 'W';
                else if (myScore < oppScore) result = 'L';
                else result = 'D';

                return {
                    id: m.userId === userId ? m.opponentId : m.userId,
                    result: result,
                    opponent: isSubmitter ? m.opponentName : m.userName,
                    timestamp: m.approvedAt
                };
            });

            // Cache the results
            this.playerMatchesCache.set(userId, matches);
            return matches;

        } catch (error) {
            console.error(`Error getting matches for user ${userId}:`, error);
            return [];
        }
    }

    getRecentFormIndicators(matches) {
        // Create form indicators (max 5)
        const form = [];
        for (let i = 0; i < 5; i++) {
            if (i < matches.length) {
                const result = matches[i].result;
                form.push({
                    result: result,
                    color: result === 'W' ? '#00ff88' : result === 'L' ? '#ff4757' : '#666'
                });
            } else {
                // Empty slot for no recent match
                form.push({
                    result: null,
                    color: 'transparent'
                });
            }
        }
        return form;
    }

    getDefaultAvatar(gamerTag) {
        // Generate a simple colored avatar based on gamerTag
        const colors = [
            '#00ff88', '#ff6b6b', '#4ecdc4', '#ffd166', '#06d6a0',
            '#118ab2', '#ef476f', '#073b4c', '#7209b7', '#3a86ff'
        ];
        const colorIndex = gamerTag.charCodeAt(0) % colors.length;
        return colors[colorIndex];
    }

    setupSearch() {
        const searchInput = document.getElementById('player-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            this.filterPlayers(searchTerm);
        });
    }

    filterPlayers(searchTerm) {
        const container = document.getElementById('legends-list-container');
        const noResultsMsg = document.getElementById('no-results-message');
        const emptyTournamentMsg = document.getElementById('empty-tournament-message');
        const playerCountElement = document.getElementById('player-count');
        
        // Hide tournament empty message if search is active
        emptyTournamentMsg.style.display = 'none';
        
        if (!searchTerm) {
            // Show filtered players based on current tournament filter
            this.renderFilteredPlayers();
            return;
        }

        // Get base players based on current filter
        let basePlayers;
        if (this.currentFilter === 'all') {
            basePlayers = this.playersCache;
        } else {
            const tournamentPlayerIds = this.tournamentPlayersMap.get(this.currentFilter) || [];
            basePlayers = this.playersCache.filter(player => 
                tournamentPlayerIds.includes(player.id)
            );
        }

        // Filter by search term
        const filteredPlayers = basePlayers.filter(player =>
            player.gamerTag.toLowerCase().includes(searchTerm) ||
            (player.fullName && player.fullName.toLowerCase().includes(searchTerm))
        );

        if (filteredPlayers.length === 0) {
            container.style.display = 'none';
            noResultsMsg.style.display = 'block';
            playerCountElement.textContent = `0 of ${basePlayers.length} players`;
            return;
        }

        container.style.display = 'grid';
        noResultsMsg.style.display = 'none';
        
        // Render filtered players
        container.innerHTML = filteredPlayers.map(p => {
            const total = (p.wins || 0) + (p.losses || 0) + (p.draws || 0);
            const winRate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
            const record = `${p.wins || 0}-${p.draws || 0}-${p.losses || 0}`;

            return `
                <div class="player-directory-card" data-player-id="${p.id}">
                    <div class="directory-avatar-container">
                        ${p.profilePic 
                            ? `<img src="${p.profilePic}" class="directory-avatar" alt="${p.gamerTag}">`
                            : `<div class="directory-avatar-default" style="background-color: ${p.avatar};">${p.gamerTag.charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <h3 class="directory-tag">${p.gamerTag}</h3>
                    
                    <div class="recent-form" id="form-${p.id}">
                        ${this.renderFormIndicator(p.recentForm)}
                    </div>

                    <div class="directory-stats-row">
                        <span class="stat-badge wr-badge">${winRate}% WR</span>
                        <span class="stat-badge record-badge">${record}</span>
                    </div>

                    <button class="btn-view-stats" onclick="window.leaderboardManager.showPublicProfile('${p.id}')">
                        📊 View Stats
                    </button>
                </div>
            `;
        }).join('');
        
        // Populate form indicators for filtered players
        filteredPlayers.forEach(p => {
            this.populatePlayerForm(p.id, `form-${p.id}`);
        });
        
        playerCountElement.textContent = `${filteredPlayers.length} of ${basePlayers.length} players`;
    }

    async showPublicProfile(userId) {
        try {
            const player = this.playersCache.find(p => p.id === userId);
            if (!player) {
                Swal.fire('Error', 'Player data not found.', 'error');
                return;
            }

            // Fetch fresh user data to ensure we have latest stats
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            
            // Calculate statistics with fallbacks
            const wins = player.wins || userData.wins || 0;
            const losses = player.losses || userData.losses || 0;
            const draws = player.draws || userData.draws || 0;
            const totalGames = wins + losses + draws;
            
            // Use the correct field names with fallbacks
            const goalsScored = player.goalsFor || userData.goalsFor || userData.goalsScored || 0;
            const goalsConceded = player.goalsAgainst || userData.goalsAgainst || userData.goalsConceded || 0;
            const goalDifference = userData.goalDifference || (goalsScored - goalsConceded);
            
            const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
            const record = `${wins}W - ${losses}L - ${draws}D`;

            // Get tournaments this player is in
            const playerTournaments = player.tournaments || [];
            const tournamentNames = [];
            
            for (const tournamentId of playerTournaments) {
                const tournament = this.tournamentsCache.find(t => t.id === tournamentId);
                if (tournament) {
                    tournamentNames.push(tournament.name);
                }
            }

            // Determine player rank
            const playerRank = await this.calculatePlayerRank(userId);

            // Show modal with player stats
            const modal = document.getElementById('player-stats-modal');
            const modalBody = document.getElementById('modal-player-stats');
            const modalName = document.getElementById('modal-player-name');

            modalName.textContent = `${player.gamerTag}'s Stats`;
            
            modalBody.innerHTML = `
                <div class="player-stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">👤</div>
                        <div class="stat-info">
                            <h4>Player Info</h4>
                            <p><strong>GamerTag:</strong> ${player.gamerTag}</p>
                            <p><strong>Name:</strong> ${player.fullName}</p>
                            <p><strong>Global Rank:</strong> ${playerRank}</p>
                            ${tournamentNames.length > 0 ? `
                                <p><strong>Tournaments:</strong> ${tournamentNames.join(', ')}</p>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-info">
                            <h4>Performance</h4>
                            <p><strong>Record:</strong> ${record}</p>
                            <p><strong>Win Rate:</strong> ${winRate}%</p>
                            <p><strong>Goal Difference:</strong> 
                                <span class="${goalDifference > 0 ? 'positive' : goalDifference < 0 ? 'negative' : ''}">
                                    ${goalDifference > 0 ? '+' : ''}${goalDifference}
                                </span>
                            </p>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">🔥</div>
                        <div class="stat-info">
                            <h4>Recent Form</h4>
                            <div class="form-indicators large">
                                ${player.recentForm.map(form => `
                                    <div class="form-indicator-large" style="background-color: ${form.color}; 
                                        ${form.result ? '' : 'border: 1px solid #333;'}">
                                        ${form.result || '?'}
                                    </div>
                                `).join('')}
                            </div>
                            <p class="form-note">Last 5 matches (W/L/D)</p>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">🎮</div>
                        <div class="stat-info">
                            <h4>Activity</h4>
                            <p><strong>Total Games:</strong> ${totalGames}</p>
                            <p><strong>Goals For:</strong> ${goalsScored}</p>
                            <p><strong>Goals Against:</strong> ${goalsConceded}</p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="window.leaderboardManager.sendChallenge('${player.id}')">
                        ⚔️ Send Challenge
                    </button>
                    <button class="btn btn-outline" onclick="hidePlayerStatsModal()">
                        Close
                    </button>
                </div>
            `;

            modal.style.display = 'flex';

        } catch (error) {
            console.error('Error showing public profile:', error);
            Swal.fire('Error', 'Failed to load player profile.', 'error');
        }
    }

    async calculatePlayerRank(userId) {
        try {
            // Fetch all users with matchesPlayed > 0
            const db = firebase.firestore();
            const snapshot = await db.collection('users')
                .where('matchesPlayed', '>', 0)
                .get();

            if (snapshot.empty) {
                return 'Unranked';
            }

            // Map user data and calculate goalDifference
            const activePlayers = snapshot.docs.map(doc => {
                const data = doc.data();
                const goalDifference = (data.goalsFor || data.goalsScored || 0) - (data.goalsAgainst || data.goalsConceded || 0);
                
                return {
                    id: doc.id,
                    wins: data.wins || 0,
                    goalDifference: goalDifference
                };
            });

            // Sort them by wins (primary) and goalDifference (secondary)
            activePlayers.sort((a, b) => {
                // First sort by wins (descending)
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }
                // If wins are equal, sort by goalDifference (descending)
                return b.goalDifference - a.goalDifference;
            });

            // Find the indexOf the current userId
            const playerIndex = activePlayers.findIndex(player => player.id === userId);
            
            // If index is found, set rank = index + 1. Otherwise, default to 'Unranked'
            if (playerIndex !== -1) {
                return `#${playerIndex + 1}`;
            } else {
                return 'Unranked';
            }

        } catch (error) {
            console.error('Error calculating player rank:', error);
            return 'Unranked';
        }
    }

    sendChallenge(playerId) {
        const player = this.playersCache.find(p => p.id === playerId);
        if (!player) return;

        Swal.fire({
            title: 'Challenge Sent!',
            text: `Challenge request sent to ${player.gamerTag}. They will be notified.`,
            icon: 'success',
            confirmButtonText: 'OK'
        });
        
        // You can implement actual challenge logic here
        // For now, just show a success message
    }

    showImage(docId, type) {
        const t = this.tournamentsCache.find(x => x.id === docId);
        if (!t) return;

        const img = type === 'standings' ? t.standingsImg : t.fixturesImg;
        const title = type === 'standings' ? `${t.name} - Standings` : `${t.name} - Fixtures`;

        if (!img) {
            Swal.fire('Info', 'No image uploaded for this section yet.', 'info');
            return;
        }

        Swal.fire({
            title: title,
            html: `
                <div style="width: 100%; overflow-y: auto; max-height: 70vh; background: #111; border-radius: 8px; border: 1px solid #333;">
                    <img src="${img}" 
                         style="width: 100%; display: block; height: auto;" 
                         alt="${title}">
                </div>
            `,
            width: '800px',
            padding: '20px',
            background: '#1a1a1a',
            color: '#fff',
            showCloseButton: true,
            showConfirmButton: false,
            footer: `<a href="#" onclick="var w=window.open(); w.document.write('<img src=\\'${img}\\' style=\\'width:100%\\'>'); w.document.close(); return false;" 
                        style="color:var(--primary-green); text-decoration:none;">
                        🔍 Open Full Size
                     </a>`
        });
    }

    showEmbed(name, link) {
        document.getElementById('leaderboard-list-view').style.display = 'none';
        document.getElementById('leaderboard-embed-view').style.display = 'block';
        
        document.getElementById('embed-title').textContent = name;
        document.getElementById('lb-embed-frame').src = link;
    }

    showList() {
        document.getElementById('leaderboard-embed-view').style.display = 'none';
        document.getElementById('leaderboard-list-view').style.display = 'block';
        document.getElementById('lb-embed-frame').src = '';
    }

    getStatusClass(status) {
        const s = status.toLowerCase();
        if (s.includes('live') || s.includes('active')) return 'status-live';
        if (s.includes('complete') || s.includes('finish')) return 'status-completed';
        if (s.includes('upcoming')) return 'status-upcoming';
        return 'status-default';
    }

    addStyles() {
        if (document.getElementById('leaderboard-styles')) return;
        const style = document.createElement('style');
        style.id = 'leaderboard-styles';
        style.textContent = `
            /* Tournament Results Section Styles */
            .tournament-results-section { 
                margin-bottom: 40px; 
            }
            
            /* Tournament Styles */
            .tournament-widget { 
                margin-bottom: 20px; 
                transition: transform 0.2s; 
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 20px;
            }
            .tournament-widget:hover { 
                transform: translateY(-3px); 
                border-color: var(--primary-green); 
            }
            
            .widget-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: flex-start; 
                margin-bottom: 15px; 
            }
            .tournament-title { 
                margin: 0 0 5px; 
                color: var(--text-primary); 
                font-size: 1.2rem; 
            }
            .tournament-details { 
                margin: 0; 
                color: var(--text-secondary); 
                font-size: 0.9rem; 
            }
            
            .action-buttons { 
                display: flex; 
                gap: 10px; 
                flex-wrap: wrap; 
            }
            .action-btn { 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                gap: 8px; 
                padding: 8px 16px;
                border-radius: 6px;
                border: 1px solid transparent;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s ease;
                font-size: 14px;
            }
            
            .status-badge { 
                padding: 4px 12px; 
                border-radius: 20px; 
                font-size: 0.8rem; 
                font-weight: bold; 
                text-transform: uppercase; 
            }
            .status-live { 
                background: rgba(0, 255, 136, 0.1); 
                color: #00ff88; 
                border: 1px solid #00ff88; 
            }
            .status-completed { 
                background: rgba(100, 100, 100, 0.2); 
                color: #aaa; 
                border: 1px solid #555; 
            }
            .status-upcoming { 
                background: rgba(255, 215, 0, 0.1); 
                color: #ffd700; 
                border: 1px solid #ffd700; 
            }
            
            /* Campus Legends Directory Styles */
            .legends-directory-section { 
                margin-bottom: 40px; 
            }
            .section-header { 
                text-align: center; 
                margin-bottom: 30px; 
    }
            .section-subtitle { 
                color: var(--text-secondary); 
                margin-top: 10px; 
            }
            
            .search-container { 
                margin-bottom: 30px; 
            }
            .search-box { 
                position: relative; 
                max-width: 600px; 
                margin: 0 auto; 
            }
            .search-icon { 
                position: absolute; 
                left: 16px; 
                top: 50%; 
                transform: translateY(-50%); 
                color: var(--text-secondary); 
            }
            .search-input { 
                width: 100%; 
                padding: 14px 20px 14px 48px; 
                background: var(--bg-tertiary); 
                border: 1px solid var(--border-color); 
                border-radius: 12px; 
                color: var(--text-primary);
                font-size: 16px;
                transition: all 0.3s ease;
            }
            .search-input:focus { 
                outline: none; 
                border-color: var(--primary-green); 
                box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.1);
            }
            .search-stats { 
                position: absolute; 
                right: 16px; 
                top: 50%; 
                transform: translateY(-50%); 
                color: var(--text-secondary);
                font-size: 14px;
            }
            
            /* Tournament Filters Styles */
            .tournament-filters-container {
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 30px;
            }
            
            .filters-title {
                margin: 0 0 5px 0;
                color: var(--text-primary);
                font-size: 1.1rem;
            }
            
            .filters-subtitle {
                margin: 0 0 15px 0;
                color: var(--text-secondary);
                font-size: 0.9rem;
            }
            
            .tournament-filters-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-bottom: 15px;
            }
            
            .tournament-filter-btn {
                padding: 10px 16px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                color: var(--text-secondary);
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            }
            
            .tournament-filter-btn:hover {
                border-color: var(--primary-green);
                color: var(--text-primary);
            }
            
            .tournament-filter-btn.active {
                background: rgba(0, 255, 136, 0.1);
                border-color: var(--primary-green);
                color: var(--primary-green);
            }
            
            .player-count-badge {
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 2px 8px;
                font-size: 12px;
                font-weight: 600;
                min-width: 24px;
                text-align: center;
            }
            
            .tournament-filter-btn.active .player-count-badge {
                background: rgba(0, 255, 136, 0.2);
                color: var(--primary-green);
            }
            
            /* Legends Display Area */
            .legends-display-area {
                margin-top: 20px;
            }
            
            .legends-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
            }
            
            /* Player Directory Card Styles */
            .player-directory-card {
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                transition: all 0.3s ease;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .player-directory-card:hover {
                transform: translateY(-5px);
                border-color: var(--primary-green);
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
            }
            
            .directory-avatar-container {
                margin-bottom: 15px;
            }
            
            .directory-avatar {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                object-fit: cover;
                border: 3px solid var(--primary-green);
                margin: 0 auto 10px;
            }
            
            .directory-avatar-default {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                font-weight: bold;
                color: white;
                margin: 0 auto 10px;
                border: 3px solid var(--primary-green);
            }
            
            .directory-tag {
                margin: 0 0 15px 0;
                color: var(--text-primary);
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .recent-form {
                display: flex;
                justify-content: center;
                gap: 8px;
                margin-bottom: 15px;
                min-height: 20px;
            }
            
            .form-circle {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                color: white;
            }
            
            .form-circle.form-w {
                background-color: #00ff88;
            }
            
            .form-circle.form-l {
                background-color: #ff4757;
            }
            
            .form-circle.form-d {
                background-color: #666;
            }
            
            .form-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
            }
            
            .form-dot.win {
                background-color: #00ff88;
            }
            
            .form-dot.loss {
                background-color: #ff4757;
            }
            
            .form-dot.draw {
                background-color: #666;
            }
            
            .form-dot.empty {
                background-color: transparent;
                border: 1px solid #333;
            }
            
            .directory-stats-row {
                display: flex;
                justify-content: center;
                gap: 10px;
                margin-bottom: 15px;
            }
            
            .stat-badge {
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.85rem;
                font-weight: 500;
            }
            
            .wr-badge {
                background: rgba(0, 255, 136, 0.1);
                color: #00ff88;
                border: 1px solid rgba(0, 255, 136, 0.3);
            }
            
            .record-badge {
                background: rgba(100, 100, 100, 0.2);
                color: var(--text-secondary);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .btn-view-stats {
                width: 100%;
                padding: 10px 15px;
                background: transparent;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                color: var(--text-primary);
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-top: auto;
            }
            
            .btn-view-stats:hover {
                border-color: var(--primary-green);
                color: var(--primary-green);
            }
            
            /* Loading States */
            .loading-spinner {
                border: 3px solid rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                border-top: 3px solid var(--primary-green);
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }
            
            .loading-spinner.small {
                width: 24px;
                height: 24px;
                border-width: 2px;
            }
            
            .loading-dots {
                display: inline-block;
                animation: dots 1.5s infinite;
            }
            
            @keyframes dots {
                0%, 20% { content: '.'; }
                40% { content: '..'; }
                60%, 100% { content: '...'; }
            }
            
            .error-msg {
                text-align: center;
                color: #ff4757;
                padding: 20px;
                background: rgba(255, 71, 87, 0.1);
                border-radius: 8px;
                border: 1px solid rgba(255, 71, 87, 0.3);
            }
            
            .no-tournaments-msg {
                text-align: center;
                color: var(--text-secondary);
                padding: 20px;
            }
            
            /* Modal Styles */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                padding: 20px;
            }
            
            .modal-content {
                background: var(--bg-primary);
                border-radius: 16px;
                width: 100%;
                max-width: 800px;
                max-height: 90vh;
                overflow-y: auto;
                border: 1px solid var(--border-color);
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                color: var(--text-primary);
            }
            
            .modal-close {
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            
            .modal-close:hover {
                background: var(--bg-tertiary);
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .player-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .stat-card {
                background: var(--bg-tertiary);
                border-radius: 12px;
                padding: 20px;
                display: flex;
                gap: 15px;
                align-items: flex-start;
            }
            
            .stat-icon {
                font-size: 24px;
                color: var(--primary-green);
            }
            
            .stat-info h4 {
                margin: 0 0 10px 0;
                color: var(--text-primary);
            }
            
            .stat-info p {
                margin: 5px 0;
                color: var(--text-secondary);
                font-size: 14px;
            }
            
            .stat-info strong {
                color: var(--text-primary);
            }
            
            .form-indicators.large {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin: 10px 0;
            }
            
            .form-indicator-large {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: bold;
                color: white;
            }
            
            .form-note {
                text-align: center;
                color: var(--text-secondary);
                font-size: 12px;
                margin-top: 10px;
            }
            
            .positive {
                color: #00ff88;
            }
            
            .negative {
                color: #ff4757;
            }
            
            .modal-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                padding-top: 20px;
                border-top: 1px solid var(--border-color);
            }
            
            .no-results-message {
                text-align: center;
                padding: 60px 20px;
                color: var(--text-secondary);
            }
            
            .no-results-icon {
                font-size: 48px;
                margin-bottom: 20px;
            }
            
            /* Button Styles */
            .btn {
                padding: 10px 20px;
                border-radius: 6px;
                border: 1px solid transparent;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            
            .btn-primary {
                background: var(--primary-green);
                color: white;
            }
            
            .btn-primary:hover {
                background: #00d475;
            }
            
            .btn-outline {
                background: transparent;
                border-color: var(--border-color);
                color: var(--text-primary);
            }
            
            .btn-outline:hover {
                border-color: var(--primary-green);
                color: var(--primary-green);
            }
            
            .btn-sm {
                padding: 8px 16px;
                font-size: 14px;
            }
            
            .disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .flex-1 {
                flex: 1;
            }
            
            .text-center {
                text-align: center;
            }
            
            /* Loading Spinner */
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Skeleton Loader */
            @keyframes shimmer {
                0% { background-position: -200px 0; }
                100% { background-position: 200px 0; }
            }
            
            .skeleton-loader {
                background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%);
                background-size: 200px 100%;
                animation: shimmer 1.5s infinite;
                border-radius: 8px;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .widget-header { 
                    flex-direction: column; 
                    gap: 10px; 
                }
                .action-buttons { 
                    flex-direction: column; 
                }
                .legends-grid { 
                    grid-template-columns: 1fr; 
                }
                .modal-actions { 
                    flex-direction: column; 
                }
                .search-stats { 
                    position: static; 
                    transform: none; 
                    margin-top: 10px; 
                    text-align: center; 
                }
                .player-stats-grid {
                    grid-template-columns: 1fr;
                }
                .tournament-filters-buttons {
                    flex-direction: column;
                }
                .tournament-filter-btn {
                    width: 100%;
                    justify-content: space-between;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Global functions for modal
function hidePlayerStatsModal() {
    document.getElementById('player-stats-modal').style.display = 'none';
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('player-stats-modal');
    if (e.target === modal) {
        hidePlayerStatsModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hidePlayerStatsModal();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    window.leaderboardManager = new LeaderboardManager();
});