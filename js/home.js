class HomeManager {
    constructor() {
        this.db = firebase.firestore();
        this.init();
    }

    init() {
        this.loadHomePageData(); // Consolidated loading
        this.setupPWAInstallPrompt();
    }

    async loadHomePageData() {
        console.log('Loading all homepage data...');
        
        try {
            // Load all data in parallel for better performance
            const [
                usersSnapshot,
                matchesSnapshot,
                tournamentsSnapshot
            ] = await Promise.all([
                this.db.collection('users').get().catch(error => {
                    console.error('Failed to load users:', error);
                    throw new Error('Failed to load user data');
                }),
                this.db.collection('matches').where('status', '==', 'approved').get().catch(error => {
                    console.error('Failed to load matches:', error);
                    throw new Error('Failed to load match data');
                }),
                this.db.collection('tournaments').where('status', '==', 'active').get().catch(error => {
                    console.error('Failed to load tournaments:', error);
                    throw new Error('Failed to load tournament data');
                })
            ]);
            
            // Process and display all data
            this.calculateAndDisplayStats(usersSnapshot, matchesSnapshot, tournamentsSnapshot);
            
            // Load the three new sections
            await this.loadMatchOfTheDay();
            await this.loadTopAttackers();
            await this.loadTopDefenders();
            
            this.loadRecentMatches(matchesSnapshot);
            this.loadActiveTournaments(tournamentsSnapshot);
            
        } catch (error) {
            console.error('CRITICAL: Failed to load all data from Firebase.', error);
            this.showErrorState();
        }
    }

    // UPDATED METHOD: Load Match of the Day using new Firebase method
    async loadMatchOfTheDay() {
        const container = document.getElementById('match-of-the-day-content');
        if (!container) {
            console.error('match-of-the-day-content element not found');
            return;
        }
        
        const match = await window.firebaseManager.getLatestApprovedMatch();
        if (match) {
            this.renderFeaturedMatch(match);
        } else {
            container.innerHTML = '<p class="text-center">No approved matches yet today.</p>';
        }
    }

    // UPDATED METHOD: Render Featured Match
    renderFeaturedMatch(match) {
        const container = document.getElementById('match-of-the-day-content');
        if(!match || !container) return;
        
        // Format timestamp
        let dateText = 'Recently';
        if (match.timestamp && match.timestamp.toDate) {
            const matchDate = match.timestamp.toDate();
            const now = new Date();
            const diffHours = Math.floor((now - matchDate) / (1000 * 60 * 60));
            
            if (diffHours < 1) dateText = 'Just now';
            else if (diffHours < 24) dateText = `${diffHours}h ago`;
            else dateText = `${Math.floor(diffHours / 24)}d ago`;
        }
        
        // Determine winner and loser
        const winner = match.myScore > match.oppScore ? match.userTag : match.opponentTag;
        const winnerScore = Math.max(match.myScore, match.oppScore);
        const loserScore = Math.min(match.myScore, match.oppScore);
        
        container.innerHTML = `
            <div class="featured-match-card">
                <div class="match-badge">🔥 Match of the Day</div>
                <div class="match-content">
                    <div class="team ${match.myScore > match.oppScore ? 'winner' : ''}">
                        <span class="team-name">${match.userTag || 'Player 1'}</span>
                        <span class="team-score">${match.myScore || 0}</span>
                    </div>
                    <div class="vs">VS</div>
                    <div class="team ${match.oppScore > match.myScore ? 'winner' : ''}">
                        <span class="team-score">${match.oppScore || 0}</span>
                        <span class="team-name">${match.opponentTag || 'Player 2'}</span>
                    </div>
                </div>
                <div class="match-highlight">
                    <span class="winner-highlight">🏆 ${winner} wins!</span>
                    <span class="score-highlight">${winnerScore} - ${loserScore}</span>
                </div>
                <div class="match-footer">
                    <span>${match.tournamentName || 'Friendly Match'}</span>
                    <span class="match-time">${dateText}</span>
                </div>
            </div>
        `;
    }

    // UPDATED METHOD: Load Top Attackers with professional header
    async loadTopAttackers() {
        const container = document.getElementById('best-attack-container');
        if (!container) {
            console.error('best-attack-container element not found');
            return;
        }
        
        try {
            const players = await window.firebaseManager.getTopAttackers();
            if (!players || !players.length) {
                container.innerHTML = '<p class="text-center">No goals recorded yet.</p>';
                return;
            }
            
            container.innerHTML = `
                <div class='ranking-header'>
                    <span>Rank & Legend</span>
                    <span>Goals Scored</span>
                </div>
            ` + players.map((p, i) => `
                <div class="ranking-item">
                    <span>${i+1}. ${p.gamerTag || 'Player'}</span>
                    <span class="stat-value">${p.goalsScored || 0}</span>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading top attackers:', error);
            container.innerHTML = '<p class="text-center error">Error loading attack data</p>';
        }
    }

    // UPDATED METHOD: Load Top Defenders with professional header
    async loadTopDefenders() {
        const container = document.getElementById('best-defense-container');
        if (!container) {
            console.error('best-defense-container element not found');
            return;
        }
        
        try {
            const players = await window.firebaseManager.getTopDefenders();
            if (!players || !players.length) {
                container.innerHTML = '<p class="text-center">No defensive stats yet.</p>';
                return;
            }
            
            container.innerHTML = `
                <div class='ranking-header'>
                    <span>Rank & Legend</span>
                    <span>GA | CS</span>
                </div>
            ` + players.map((p, i) => `
                <div class="ranking-item">
                    <span>${i+1}. ${p.gamerTag || 'Player'}</span>
                    <span class="stat-value">${p.goalsConceded || 0} | ${p.cleanSheets || 0}</span>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading top defenders:', error);
            container.innerHTML = '<p class="text-center error">Error loading defense data</p>';
        }
    }

    // UPDATED METHOD: Show No Featured Match
    showNoFeaturedMatch() {
        const container = document.getElementById('match-of-the-day-content');
        if (container) {
            container.innerHTML = `
                <div class="featured-match-card empty">
                    <div class="match-badge">No Match of the Day</div>
                    <p style="text-align: center; color: var(--text-secondary);">
                        No approved matches yet. Play a match to be featured here!
                    </p>
                </div>
            `;
        }
    }

    calculateAndDisplayStats(usersSnapshot, matchesSnapshot, tournamentsSnapshot) {
        // --- CALCULATE DYNAMIC STATS ---
        
        // 1. Total Players (already has snapshot)
        const totalPlayers = usersSnapshot.size;
        
        // 2. Matches Played
        const matchesPlayed = matchesSnapshot.size;
        
        // 3. Goals Scored (sum of all goals from approved matches)
        let goalsScored = 0;
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            // Add both player's scores
            goalsScored += (match.myScore || 0);
            goalsScored += (match.oppScore || 0);
        });
        
        // 4. Active Tournaments
        const activeTournaments = tournamentsSnapshot.size;
        
        // --- UPDATE STATS COUNTERS ---
        this.updateStatCounter('stat-total-players', totalPlayers);
        this.updateStatCounter('stat-matches-played', matchesPlayed);
        this.updateStatCounter('stat-goals-scored', goalsScored);
        this.updateStatCounter('stat-active-tournaments', activeTournaments);
        
        console.log('Dynamic stats updated:', {
            totalPlayers,
            matchesPlayed,
            goalsScored,
            activeTournaments
        });
    }

    updateStatCounter(elementId, value) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Element ${elementId} not found`);
            return;
        }
        
        // Format large numbers
        let displayValue;
        if (value >= 1000000) {
            displayValue = (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            displayValue = (value / 1000).toFixed(1) + 'k';
        } else {
            displayValue = value.toString();
        }
        
        // Animate the counter
        element.textContent = displayValue;
        
        // Add animation class for visual feedback
        element.classList.add('updated');
        setTimeout(() => element.classList.remove('updated'), 500);
    }

    // UPDATED METHOD: Load Recent Matches (excluding Match of the Day)
    async loadRecentMatches(matchesSnapshot) {
        try {
            // If we don't have a snapshot, fetch from Firebase
            if (!matchesSnapshot) {
                matchesSnapshot = await this.db.collection('matches')
                    .where('status', '==', 'approved')
                    .orderBy('timestamp', 'desc')
                    .limit(6) // Get 6 matches: 1 for Match of the Day + 5 for recent list
                    .get();
            }

            if (matchesSnapshot.empty) {
                this.showNoRecentMatches();
                return;
            }

            // Get the latest match for Match of the Day
            const allMatches = matchesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Skip the first match (it's already shown as Match of the Day)
            // and take the next 5 matches for the recent list
            const recentMatches = allMatches.slice(1, 6);
            
            this.renderRecentList(recentMatches);
            
        } catch (error) {
            console.error("Recent matches error:", error);
            // Show empty state if there's an error
            this.showNoRecentMatches();
        }
    }

    renderRecentList(matches) {
        const container = document.getElementById('recent-results-list');
        if (!container) return;
        
        if (matches.length === 0) {
            container.innerHTML = `
                <div class="result-item empty">
                    <p style="color: var(--text-secondary); text-align: center;">
                        No recent matches to display
                    </p>
                </div>
            `;
            return;
        }
        
        let html = '';
        matches.forEach(m => {
            const result = m.myScore > m.oppScore ? 'WON' : (m.myScore < m.oppScore ? 'LOST' : 'DRAW');
            const color = m.myScore > m.oppScore ? 'var(--primary-green)' : 
                         (m.myScore < m.oppScore ? '#ff6b6b' : 'var(--gold)');
            
            // Format time
            let timeText = '';
            if (m.timestamp && m.timestamp.toDate) {
                const matchDate = m.timestamp.toDate();
                timeText = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            
            html += `
                <div class="result-item" style="border-left: 3px solid ${color}">
                    <div class="result-teams">
                        <span class="team-name">${m.userTag || 'Player 1'}</span> 
                        <span class="score" style="color:${color}; font-weight:bold;">${m.myScore || 0}-${m.oppScore || 0}</span> 
                        <span class="team-name">${m.opponentTag || 'Player 2'}</span>
                    </div>
                    <div class="result-meta">
                        <span class="tournament">${m.tournamentName || 'Friendly'}</span>
                        <span class="time">${timeText}</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    showNoRecentMatches() {
        const listContainer = document.getElementById('recent-results-list');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="result-item empty">
                    <p style="text-align: center; color: var(--text-secondary);">
                        No recent matches
                    </p>
                </div>
            `;
        }
    }

    async loadActiveTournaments(tournamentsSnapshot) {
        const container = document.getElementById('active-tournaments-container');
        if (!container) return;
        
        if (!tournamentsSnapshot) {
            try {
                tournamentsSnapshot = await this.db.collection('tournaments')
                    .where('status', '==', 'active')
                    .orderBy('startDate', 'desc')
                    .limit(3)
                    .get();
            } catch (error) {
                console.error("Tournaments error:", error);
                container.innerHTML = '<p style="color: #ff6b6b;">Error loading tournaments</p>';
                return;
            }
        }
        
        if (tournamentsSnapshot.empty) {
            container.innerHTML = `
                <div class="tournament-card empty">
                    <p>No active tournaments at the moment</p>
                    <a href="tournaments.html" class="btn btn-outline btn-sm">Browse Tournaments</a>
                </div>
            `;
            return;
        }
        
        let html = '';
        tournamentsSnapshot.forEach(doc => {
            const tournament = doc.data();
            
            // Format dates
            const startDate = tournament.startDate?.toDate?.() || new Date();
            const endDate = tournament.endDate?.toDate?.() || new Date();
            
            // Calculate participants count
            const participantsCount = tournament.participants?.length || 0;
            
            html += `
                <div class="tournament-card">
                    <div class="tournament-header">
                        <h3 class="tournament-title">${tournament.name || 'Tournament'}</h3>
                        <span class="tournament-status active">ACTIVE</span>
                    </div>
                    <div class="tournament-details">
                        <div class="detail">
                            <span class="label">Format:</span>
                            <span class="value">${tournament.format || 'Single Elimination'}</span>
                        </div>
                        <div class="detail">
                            <span class="label">Participants:</span>
                            <span class="value">${participantsCount} players</span>
                        </div>
                        <div class="detail">
                            <span class="label">Ends:</span>
                            <span class="value">${endDate.toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="tournament-footer">
                        <a href="tournament.html?id=${doc.id}" class="btn btn-primary btn-sm">View Details</a>
                        <span class="prize">🏆 $${tournament.prizePool || '0'}</span>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    showErrorState() {
        const errorMessage = 'Failed to load data. Please check your connection or try again later.';
        
        // Update stats section
        document.querySelectorAll('.stat-number').forEach(el => {
            if (el.textContent === '500+' || el.textContent === '1.2k' || el.textContent === '3.5k' || el.textContent === '8') {
                el.textContent = '--';
                el.style.color = '#ff6b6b';
            }
        });
        
        // Update all containers
        const containers = [
            'match-of-the-day-content',
            'recent-results-list',
            'active-tournaments-container',
            'best-attack-container',
            'best-defense-container'
        ];
        
        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <p style="color: #ff6b6b; text-align: center; padding: 20px;">
                            ⚠️ ${errorMessage}
                            <br>
                            <button onclick="window.location.reload()" class="btn btn-outline btn-sm" style="margin-top: 10px;">
                                Retry
                            </button>
                        </p>
                    </div>
                `;
            }
        });
    }

    setupPWAInstallPrompt() {
        const installContainer = document.getElementById("install-pwa-container");
        if (!installContainer) return;

        // 1. Detect if user is ALREADY in the App (Standalone or WebView)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isWebView = navigator.userAgent.includes('wv') || navigator.userAgent.includes('Android');

        // 2. Only show if NOT in the App
        if (!isStandalone && !isWebView) {
           
           // Show the banner
           installContainer.style.display = "block";
           
           // 3. Hide it automatically after 5 seconds
           setTimeout(() => {
             installContainer.style.opacity = "0";
             installContainer.style.transition = "opacity 0.5s ease";
             
             // Remove from layout after fade
             setTimeout(() => {
               installContainer.style.display = "none";
             }, 500); 
             
           }, 5000); // 5 seconds
        }
    }
}

// Initialize the HomeManager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.error('Firebase not initialized');
        return;
    }
    
    // Initialize HomeManager
    window.homeManager = new HomeManager();
    
    // Optional: Refresh data every 30 seconds for real-time updates
    setInterval(() => {
        if (window.homeManager) {
            window.homeManager.loadHomePageData();
        }
    }, 30000);
});

// Optional: Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    .stat-number.updated {
        animation: pulse 0.5s ease;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    
    .winner {
        color: var(--primary-green);
        font-weight: bold;
    }
    
    .error-state {
        background: rgba(255, 107, 107, 0.1);
        border-radius: 8px;
        padding: 20px;
        text-align: center;
    }
    
    .empty {
        opacity: 0.7;
        text-align: center;
        padding: 20px;
    }
    
    /* Styles for ranking items */
    .ranking-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        margin-bottom: 8px;
        background: var(--card-bg);
        border-radius: 6px;
        border-left: 3px solid var(--primary);
        font-size: 0.9rem;
    }
    
    .ranking-item:nth-child(2) { /* First ranking item after header */
        border-left-color: gold;
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), transparent);
    }
    
    .ranking-item:nth-child(3) {
        border-left-color: silver;
        background: linear-gradient(135deg, rgba(192, 192, 192, 0.1), transparent);
    }
    
    .ranking-item:nth-child(4) {
        border-left-color: #cd7f32;
        background: linear-gradient(135deg, rgba(205, 127, 50, 0.1), transparent);
    }
    
    .stat-value {
        color: var(--text-secondary);
        font-weight: 500;
        font-size: 0.85rem;
    }
    
    /* Defense-specific styling */
    #best-defense-container .ranking-item {
        border-left-color: var(--accent-blue);
    }
    
    #best-defense-container .stat-value {
        color: var(--accent-blue);
    }
    
    /* Attack-specific styling */
    #best-attack-container .ranking-item {
        border-left-color: #ff9800;
    }
    
    #best-attack-container .stat-value {
        color: #ff9800;
    }
    
    /* Text center utility */
    .text-center {
        text-align: center;
    }
    
    .error {
        color: #ff6b6b;
    }
    
    /* NEW: Professional ranking header styles */
    .ranking-header {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        font-size: 0.7rem;
        text-transform: uppercase;
        color: var(--text-secondary);
        font-weight: 700;
        letter-spacing: 1px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        margin-bottom: 12px;
    }
    .ranking-item .stat-value {
        font-family: 'Orbitron', sans-serif;
        color: var(--primary-green);
    }
`;
document.head.appendChild(style);