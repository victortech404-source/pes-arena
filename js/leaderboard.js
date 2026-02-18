// UON HUB/js/leaderboard.js
// PES ARENA Leaderboard with Chiromo Mode Integration

class LeaderboardManager {
    constructor() {
        this.tournamentsCache = [];
        this.playersCache = [];
        this.playerMatchesCache = new Map();
        this.tournamentPlayersMap = new Map();
        this.currentFilter = 'all';
        this.currentSort = 'points';
        this.chiromoMode = true;
        this.chiromoAnalytics = window.ChiromoAnalytics;
        this.init();
    }

    async init() {
        await this.loadTournaments();
        await this.loadLegendsDirectory();
        this.addStyles();
        this.setupSearch();
        this.setupSorting();
        this.setupChiromoMode();
        this.setupTooltips();
    }

    setupTooltips() {
        // Add tooltip functionality for info icons
        const infoIcons = document.querySelectorAll('.info-icon');
        infoIcons.forEach(icon => {
            icon.addEventListener('mouseenter', (e) => {
                const tooltip = e.target.querySelector('.tooltip');
                if (tooltip) tooltip.style.display = 'block';
            });
            icon.addEventListener('mouseleave', (e) => {
                const tooltip = e.target.querySelector('.tooltip');
                if (tooltip) tooltip.style.display = 'none';
            });
        });
    }

    setupChiromoMode() {
        const toggleBtn = document.getElementById('chiromo-mode-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.chiromoMode = !this.chiromoMode;
                toggleBtn.textContent = `Chiromo Mode: ${this.chiromoMode ? 'On' : 'Off'}`;
                toggleBtn.classList.toggle('active', this.chiromoMode);
                this.renderLeaderboard();
            });
        }
    }

    setupSorting() {
        const sortSelect = document.getElementById('sort-leaderboard');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.renderLeaderboard();
            });
        }
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
                                <p class="tournament-details">${t.platform || 'PES'} • ${t.format || 'Tournament'}</p>
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
        
        container.innerHTML = '<div class="loading-spinner"></div>';
        playerCountElement.textContent = 'Loading players...';
        
        await this.loadTournamentFilters();

        try {
            const db = firebase.firestore();
            
            const usersSnapshot = await db.collection('users')
                .where('gamerTag', '!=', '')
                .orderBy('gamerTag', 'asc')
                .get();

            const registrationsSnapshot = await db.collection('tournamentRegistrations')
                .where('status', '==', 'approved')
                .get();

            this.buildTournamentPlayersMap(registrationsSnapshot);
            
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filteredUsers = users.filter(p => p.role !== 'faculty' && p.gamerTag);

            this.playersCache = [];
            
            // Wait for Chiromo Analytics to be ready
            if (!this.chiromoAnalytics.initialized) {
                await this.chiromoAnalytics.init();
            }
            
            const playerPromises = filteredUsers.map(async (userData) => {
                const matches = await this.getPlayerLastMatches(userData.id);
                
                // Get Chiromo Analytics
                const analytics = this.chiromoAnalytics.getPlayerAnalytics(userData.id);
                
                const playerTournaments = [];
                for (const [tournamentId, playerIds] of this.tournamentPlayersMap) {
                    if (playerIds.includes(userData.id)) {
                        const tournament = this.tournamentsCache.find(t => t.id === tournamentId);
                        if (tournament) {
                            playerTournaments.push(tournament.id);
                        }
                    }
                }
                
                const player = {
                    id: userData.id,
                    gamerTag: userData.gamerTag,
                    fullName: userData.fullName || userData.gamerTag,
                    wins: userData.wins || 0,
                    losses: userData.losses || 0,
                    draws: userData.draws || 0,
                    avatar: userData.avatar || this.getDefaultAvatar(userData.gamerTag),
                    profilePic: userData.profilePic || null,
                    matches: matches,
                    recentForm: this.getRecentFormIndicators(matches),
                    role: userData.role || 'player',
                    matchesPlayed: userData.matchesPlayed || analytics.matchesPlayed,
                    goalsFor: userData.goalsFor || userData.goalsScored || 0,
                    goalsAgainst: userData.goalsAgainst || userData.goalsConceded || 0,
                    goalDifference: (userData.goalsFor || userData.goalsScored || 0) - (userData.goalsAgainst || userData.goalsConceded || 0),
                    tournaments: playerTournaments,
                    
                    // Chiromo Mode stats
                    consistency: analytics.consistency,
                    reliability: analytics.reliability,
                    consistencyStreak: analytics.consistencyStreak,
                    noShowPrediction: analytics.noShowPrediction,
                    last5Results: analytics.last5Results,
                    
                    // Points calculation
                    points: (userData.wins || 0) * 3 + (userData.draws || 0) * 1
                };
                
                this.playersCache.push(player);
                return player;
            });

            const validPlayers = (await Promise.all(playerPromises)).filter(p => p !== null);
            
            playerCountElement.textContent = `${validPlayers.length} players`;
            
            const allPlayersBtn = document.querySelector('[data-tournament="all"]');
            if (allPlayersBtn) {
                const badge = allPlayersBtn.querySelector('.player-count-badge');
                if (badge) {
                    badge.textContent = validPlayers.length;
                }
            }
            
            this.renderLeaderboard();

        } catch (error) {
            console.error("Error loading directory:", error);
            container.innerHTML = '<p class="error-msg">Failed to load directory. Please refresh.</p>';
            playerCountElement.textContent = '0 players';
        }
    }

    renderLeaderboard() {
        const container = document.getElementById('legends-list-container');
        const noResultsMsg = document.getElementById('no-results-message');
        const emptyTournamentMsg = document.getElementById('empty-tournament-message');
        const playerCountElement = document.getElementById('player-count');
        
        noResultsMsg.style.display = 'none';
        emptyTournamentMsg.style.display = 'none';
        container.style.display = 'block';
        
        // Filter players
        let filteredPlayers;
        if (this.currentFilter === 'all') {
            filteredPlayers = this.playersCache;
        } else {
            const tournamentPlayerIds = this.tournamentPlayersMap.get(this.currentFilter) || [];
            filteredPlayers = this.playersCache.filter(player => 
                tournamentPlayerIds.includes(player.id)
            );
            
            if (filteredPlayers.length === 0) {
                container.style.display = 'none';
                emptyTournamentMsg.style.display = 'block';
                playerCountElement.textContent = `0 of ${this.playersCache.length} players`;
                return;
            }
        }

        // Sort players
        filteredPlayers = this.sortPlayers(filteredPlayers, this.currentSort);
        
        playerCountElement.textContent = `${filteredPlayers.length} of ${this.playersCache.length} players`;
        
        // Render as table
        container.innerHTML = `
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Pld</th>
                        <th>GD</th>
                        <th>Pts</th>
                        ${this.chiromoMode ? `
                            <th class="tooltip-header">
                                RLB 
                                <span class="info-icon">ⓘ
                                    <span class="tooltip">Reliability Score: (Matches Played / Total Scheduled) × 100</span>
                                </span>
                            </th>
                            <th class="tooltip-header">
                                Consistency 
                                <span class="info-icon">ⓘ
                                    <span class="tooltip">Weighted average of last 5 games: Latest match 1.5x, then 1.2x, 1.0x, 0.8x, 0.5x</span>
                                </span>
                            </th>
                            <th>Form</th>
                        ` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${filteredPlayers.map((player, index) => this.renderPlayerRow(player, index + 1)).join('')}
                </tbody>
            </table>
        `;
    }

    renderPlayerRow(player, rank) {
        const trendingIcon = player.consistencyStreak?.hasStreak ? ' 🔥' : '';
        const formCircles = this.renderFormCirclesGradient(player.last5Results || []);
        
        // Get consistency label class
        const consistencyLabelClass = this.getConsistencyLabelClass(player.consistency?.label);
        
        return `
            <tr class="player-row" onclick="window.leaderboardManager.showPublicProfile('${player.id}')">
                <td class="rank-cell">#${rank}</td>
                <td class="player-cell">
                    <div class="player-info">
                        <div class="player-avatar">
                            ${player.profilePic 
                                ? `<img src="${player.profilePic}" alt="${player.gamerTag}">`
                                : `<div class="avatar-default" style="background-color: ${player.avatar};">${player.gamerTag.charAt(0).toUpperCase()}</div>`
                            }
                        </div>
                        <span class="player-name">${player.gamerTag}${trendingIcon}</span>
                        ${player.consistencyStreak?.hasStreak ? '<span class="streak-badge" title="10+ Match Consistency Streak">📊 Streak</span>' : ''}
                    </div>
                </td>
                <td>${player.matchesPlayed || 0}</td>
                <td class="${player.goalDifference > 0 ? 'positive' : player.goalDifference < 0 ? 'negative' : ''}">
                    ${player.goalDifference > 0 ? '+' : ''}${player.goalDifference}
                </td>
                <td class="points-cell"><strong>${player.points}</strong></td>
                ${this.chiromoMode ? `
                    <td class="reliability-cell">
                        <div class="reliability-bar">
                            <div class="reliability-fill ${this.getReliabilityClass(player.reliability?.score)}" 
                                 style="width: ${player.reliability?.score || 0}%"></div>
                            <span>${player.reliability?.score || 0}%</span>
                        </div>
                        ${player.reliability?.risk === 'High Risk' ? 
                            '<span class="risk-badge high-risk" title="High no-show risk">⚠️</span>' : ''}
                    </td>
                    <td>
                        <div class="consistency-display">
                            <span class="consistency-score">${player.consistency?.score || 0}</span>
                            <span class="consistency-label ${consistencyLabelClass}">${player.consistency?.label || 'No Data'}</span>
                        </div>
                    </td>
                    <td class="form-cell">
                        <div class="form-indicator gradient-circles">
                            ${formCircles}
                        </div>
                    </td>
                ` : ''}
            </tr>
        `;
    }

    getConsistencyLabelClass(label) {
        switch(label) {
            case 'On Fire': return 'label-onfire';
            case 'Stable': return 'label-stable';
            case 'Ice Cold': return 'label-icecold';
            default: return '';
        }
    }

    getReliabilityClass(score) {
        if (score >= 85) return 'reliability-excellent';
        if (score >= 70) return 'reliability-good';
        if (score >= 50) return 'reliability-fair';
        return 'reliability-poor';
    }

    renderFormCirclesGradient(results) {
        let html = '';
        for (let i = 0; i < 5; i++) {
            if (i < results.length && results[i]) {
                const result = results[i];
                let gradient = '';
                if (result === 'W') {
                    gradient = 'linear-gradient(135deg, #00ff88, #00cc6a)';
                } else if (result === 'L') {
                    gradient = 'linear-gradient(135deg, #ff4757, #cc3543)';
                } else {
                    gradient = 'linear-gradient(135deg, #666, #444)';
                }
                html += `<div class="form-circle" style="background: ${gradient}; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`;
            } else {
                html += `<div class="form-circle empty"></div>`;
            }
        }
        return html;
    }

    sortPlayers(players, sortBy) {
        return players.sort((a, b) => {
            switch(sortBy) {
                case 'points':
                    return b.points - a.points || b.goalDifference - a.goalDifference;
                case 'reliability':
                    return (b.reliability?.score || 0) - (a.reliability?.score || 0);
                case 'consistency':
                    return (b.consistency?.score || 0) - (a.consistency?.score || 0);
                case 'efficiency':
                    return (b.goalDifference / (b.matchesPlayed || 1)) - (a.goalDifference / (a.matchesPlayed || 1));
                default:
                    return b.points - a.points;
            }
        });
    }

    // ... (rest of the existing methods remain the same: loadTournamentFilters, 
    // buildTournamentPlayersMap, getPlayerLastMatches, etc.)
    
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
            /* Leaderboard Table Styles */
            .leaderboard-table {
                width: 100%;
                border-collapse: collapse;
                background: var(--bg-tertiary);
                border-radius: 12px;
                overflow: hidden;
                margin-bottom: 30px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            
            .leaderboard-table th {
                background: linear-gradient(135deg, var(--bg-secondary), #1a1a1a);
                color: var(--text-primary);
                font-weight: 600;
                padding: 15px;
                text-align: left;
                border-bottom: 2px solid var(--primary-green);
            }
            
            .leaderboard-table td {
                padding: 12px 15px;
                color: var(--text-secondary);
                border-bottom: 1px solid var(--border-color);
            }
            
            .player-row {
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .player-row:hover {
                background: rgba(0, 255, 136, 0.05);
                transform: translateY(-1px);
            }
            
            /* Tooltip Styles */
            .tooltip-header {
                position: relative;
            }
            
            .info-icon {
                display: inline-block;
                margin-left: 5px;
                cursor: help;
                position: relative;
                color: var(--text-secondary);
            }
            
            .tooltip {
                display: none;
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 1000;
                border: 1px solid var(--primary-green);
                margin-bottom: 5px;
            }
            
            .info-icon:hover .tooltip {
                display: block;
            }
            
            /* Reliability Bar */
            .reliability-cell {
                min-width: 120px;
                position: relative;
            }
            
            .reliability-bar {
                background: rgba(255, 255, 255, 0.1);
                height: 24px;
                border-radius: 12px;
                position: relative;
                overflow: hidden;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
            }
            
            .reliability-fill {
                height: 100%;
                border-radius: 12px;
                transition: width 0.3s ease;
            }
            
            .reliability-fill.reliability-excellent {
                background: linear-gradient(90deg, #00ff88, #00cc6a);
            }
            
            .reliability-fill.reliability-good {
                background: linear-gradient(90deg, #ffd700, #ccac00);
            }
            
            .reliability-fill.reliability-fair {
                background: linear-gradient(90deg, #ffa500, #cc8400);
            }
            
            .reliability-fill.reliability-poor {
                background: linear-gradient(90deg, #ff4757, #cc3543);
            }
            
            .reliability-bar span {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 11px;
                font-weight: bold;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                z-index: 1;
            }
            
            .risk-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                font-size: 14px;
            }
            
            /* Consistency Display */
            .consistency-display {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .consistency-score {
                font-weight: 700;
                color: var(--primary-green);
                font-size: 16px;
            }
            
            .consistency-label {
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 12px;
                display: inline-block;
                width: fit-content;
                font-weight: 600;
            }
            
            .consistency-label.label-onfire {
                background: linear-gradient(135deg, #ffd700, #ff8c00);
                color: black;
                box-shadow: 0 0 10px rgba(255,215,0,0.3);
            }
            
            .consistency-label.label-stable {
                background: linear-gradient(135deg, #00ff88, #00cc6a);
                color: black;
            }
            
            .consistency-label.label-icecold {
                background: linear-gradient(135deg, #4a90e2, #3570b0);
                color: white;
            }
            
            /* Form Circles with Gradients */
            .form-indicator.gradient-circles {
                display: flex;
                gap: 6px;
            }
            
            .form-circle {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                transition: transform 0.2s ease;
            }
            
            .form-circle:hover {
                transform: scale(1.1);
            }
            
            .form-circle.empty {
                background: transparent;
                border: 2px solid #333;
            }
            
            /* Streak Badge */
            .streak-badge {
                background: linear-gradient(135deg, #ffd700, #ff8c00);
                color: black;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: 8px;
                font-weight: 600;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
            }
            
            /* Controls Bar */
            .controls-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding: 15px;
                background: var(--bg-tertiary);
                border-radius: 12px;
                border: 1px solid var(--border-color);
            }
            
            .sort-controls {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .sort-select {
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                color: var(--text-primary);
                padding: 10px 15px;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
            }
            
            .sort-select:focus {
                outline: none;
                border-color: var(--primary-green);
            }
            
            .chiromo-toggle {
                background: transparent;
                border: 2px solid var(--primary-green);
                color: var(--text-primary);
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .chiromo-toggle.active {
                background: var(--primary-green);
                color: black;
                box-shadow: 0 0 20px rgba(0,255,136,0.3);
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .leaderboard-table {
                    font-size: 12px;
                }
                
                .leaderboard-table td,
                .leaderboard-table th {
                    padding: 8px 5px;
                }
                
                .player-cell {
                    min-width: 120px;
                }
                
                .player-info {
                    gap: 5px;
                }
                
                .player-avatar {
                    width: 25px;
                    height: 25px;
                }
                
                .form-circle {
                    width: 20px;
                    height: 20px;
                }
                
                .controls-bar {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .sort-controls {
                    width: 100%;
                }
                
                .sort-select {
                    flex: 1;
                }
                
                .chiromo-toggle {
                    width: 100%;
                }
                
                .tooltip {
                    white-space: normal;
                    width: 200px;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Global functions
function hidePlayerStatsModal() {
    document.getElementById('player-stats-modal').style.display = 'none';
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('player-stats-modal');
    if (e.target === modal) {
        hidePlayerStatsModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hidePlayerStatsModal();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    window.leaderboardManager = new LeaderboardManager();
});