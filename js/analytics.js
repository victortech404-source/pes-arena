// UON HUB/js/analytics.js
// PES ARENA "Chiromo Mode" Statistical Engine

class ChiromoAnalytics {
    constructor() {
        this.matches = [];
        this.users = [];
        this.initialized = false;
        this.consistencyWeights = [1.5, 1.2, 1.0, 0.8, 0.5]; // Match 1-5 weights
        this.pointsMap = { 'W': 3, 'D': 1, 'L': 0 };
    }

    // Initialize and load data
    async init() {
        await this.loadData();
        this.initialized = true;
        console.log('Chiromo Analytics Engine initialized');
        return this;
    }

    // Load data from Firebase/localStorage
    async loadData() {
        try {
            // Try Firebase first
            if (window.firebase && firebase.firestore) {
                await this.loadFromFirebase();
            } else {
                // Fallback to localStorage
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading analytics data:', error);
        }
    }

    async loadFromFirebase() {
        const db = firebase.firestore();
        
        // Load approved matches
        const matchesSnapshot = await db.collection('matches')
            .where('status', '==', 'approved')
            .get();
        
        this.matches = matchesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Load users
        const usersSnapshot = await db.collection('users').get();
        this.users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    loadFromLocalStorage() {
        const storedMatches = localStorage.getItem('uonhub_matches');
        const storedUsers = localStorage.getItem('uonhub_users');
        
        this.matches = storedMatches ? JSON.parse(storedMatches) : [];
        this.users = storedUsers ? JSON.parse(storedUsers) : [];
    }

    // ============== WIN CONSISTENCY ALGORITHM ==============
    /**
     * Calculate consistency score based on last 5 matches with weighted multipliers
     * @param {Array} matches - Array of match result strings ['W', 'L', 'W', 'W', 'D']
     * @returns {Object} - { score: number, label: string, details: Array }
     */
    calculateConsistency(matches) {
        if (!matches || matches.length === 0) {
            return {
                score: 0,
                label: 'No Data',
                details: [],
                maxPossibleScore: 0
            };
        }

        // Take last 5 matches (most recent first)
        const last5 = matches.slice(0, 5);
        const details = [];
        let totalWeightedPoints = 0;
        let maxPossibleWeightedPoints = 0;

        last5.forEach((result, index) => {
            const weight = this.consistencyWeights[index] || 0.5;
            const points = this.pointsMap[result] || 0;
            const weightedPoints = points * weight;
            
            totalWeightedPoints += weightedPoints;
            maxPossibleWeightedPoints += 3 * weight; // Max points (3) * weight
            
            details.push({
                match: index + 1,
                result,
                weight,
                points,
                weightedPoints
            });
        });

        // Normalize to score out of 100
        const rawScore = maxPossibleWeightedPoints > 0 
            ? (totalWeightedPoints / maxPossibleWeightedPoints) * 100 
            : 0;
        
        // Round to 2 decimal places
        const score = Math.round(rawScore * 100) / 100;

        // Determine label
        let label = 'Ice Cold';
        if (score > 70) label = 'On Fire';
        else if (score > 30) label = 'Stable';

        return {
            score,
            label,
            details,
            maxPossibleScore: maxPossibleWeightedPoints,
            achievedScore: totalWeightedPoints
        };
    }

    // ============== RELIABILITY SCORE ==============
    /**
     * Calculate reliability based on matches played vs no-shows
     * @param {number} matchesPlayed - Number of matches actually played
     * @param {number} noShows - Number of times player didn't show
     * @returns {Object} - { score: number, risk: string, probability: number }
     */
    calculateReliability(matchesPlayed, noShows) {
        const totalScheduled = matchesPlayed + noShows;
        
        if (totalScheduled === 0) {
            return {
                score: 100,
                risk: 'Low Risk',
                probability: 0,
                matchesPlayed: 0,
                noShows: 0
            };
        }

        // Formula: (MatchesPlayed / (MatchesPlayed + NoShows)) * 100
        const score = Math.round((matchesPlayed / totalScheduled) * 100 * 100) / 100;
        
        // Calculate no-show probability
        const probability = (noShows / totalScheduled) * 100;
        
        // Determine risk level
        let risk = 'Low Risk';
        if (score < 70) risk = 'High Risk';
        else if (score < 85) risk = 'Medium Risk';

        return {
            score,
            risk,
            probability: Math.round(probability * 100) / 100,
            matchesPlayed,
            noShows
        };
    }

    // ============== PREDICTIVE FUNCTIONS ==============
    /**
     * Predict if player is likely to no-show based on reliability score
     * @param {number} reliabilityScore - Score from 0-100
     * @returns {Object} - Prediction result
     */
    predictNoShow(reliabilityScore) {
        const prediction = {
            isHighRisk: reliabilityScore < 70,
            confidenceLevel: 'Medium',
            recommendation: ''
        };

        if (reliabilityScore < 50) {
            prediction.confidenceLevel = 'High';
            prediction.recommendation = 'Consider having a substitute ready';
        } else if (reliabilityScore < 70) {
            prediction.confidenceLevel = 'Medium';
            prediction.recommendation = 'Send reminder before match';
        } else if (reliabilityScore < 85) {
            prediction.confidenceLevel = 'Low';
            prediction.recommendation = 'Generally reliable';
        } else {
            prediction.confidenceLevel = 'Very Low';
            prediction.recommendation = 'Extremely reliable player';
        }

        return prediction;
    }

    // ============== UTILITY FUNCTIONS ==============
    /**
     * Get player's last 5 match results
     * @param {string} userId - Player ID
     * @returns {Array} - Array of result strings
     */
    getPlayerLast5Results(userId) {
        const playerMatches = this.matches
            .filter(m => m.userId === userId || m.opponentId === userId)
            .sort((a, b) => {
                const dateA = a.approvedAt || a.date || 0;
                const dateB = b.approvedAt || b.date || 0;
                return new Date(dateB) - new Date(dateA);
            })
            .slice(0, 5);

        return playerMatches.map(match => {
            const isSubmitter = match.userId === userId;
            const myScore = isSubmitter ? Number(match.myScore) : Number(match.oppScore);
            const oppScore = isSubmitter ? Number(match.oppScore) : Number(match.myScore);
            
            if (myScore > oppScore) return 'W';
            if (myScore < oppScore) return 'L';
            return 'D';
        });
    }

    /**
     * Get player's no-show count
     * @param {string} userId - Player ID
     * @returns {number} - Number of no-shows
     */
    getPlayerNoShows(userId) {
        // Find user in users array
        const user = this.users.find(u => u.id === userId);
        return user?.noShows || 0;
    }

    /**
     * Get player's matches played count
     * @param {string} userId - Player ID
     * @returns {number} - Number of approved matches
     */
    getPlayerMatchesPlayed(userId) {
        return this.matches.filter(m => 
            m.status === 'approved' && 
            (m.userId === userId || m.opponentId === userId)
        ).length;
    }

    /**
     * Check if player has maintained consistency for 10+ matches
     * @param {string} userId - Player ID
     * @returns {Object} - Consistency streak info
     */
    checkConsistencyStreak(userId) {
        const allResults = this.matches
            .filter(m => m.userId === userId || m.opponentId === userId)
            .sort((a, b) => {
                const dateA = a.approvedAt || a.date || 0;
                const dateB = b.approvedAt || b.date || 0;
                return new Date(dateB) - new Date(dateA);
            });

        if (allResults.length < 10) {
            return {
                hasStreak: false,
                streakLength: allResults.length,
                needsMoreMatches: 10 - allResults.length,
                isConsistent: false
            };
        }

        // Check last 10 matches for consistency (Stable or better)
        const last10 = allResults.slice(0, 10);
        const consistencyScores = [];
        
        for (let i = 0; i <= last10.length - 5; i++) {
            const fiveMatchSlice = last10.slice(i, i + 5).map(m => {
                const isSubmitter = m.userId === userId;
                const myScore = isSubmitter ? Number(m.myScore) : Number(m.oppScore);
                const oppScore = isSubmitter ? Number(m.oppScore) : Number(m.myScore);
                
                if (myScore > oppScore) return 'W';
                if (myScore < oppScore) return 'L';
                return 'D';
            });
            
            const consistency = this.calculateConsistency(fiveMatchSlice);
            consistencyScores.push(consistency.score);
        }

        // Check if average consistency is Stable (>30)
        const avgConsistency = consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length;
        const isConsistent = avgConsistency > 30;

        return {
            hasStreak: isConsistent,
            streakLength: 10,
            averageConsistency: Math.round(avgConsistency * 100) / 100,
            isConsistent,
            label: isConsistent ? 'Consistency Streak 🔥' : 'Inconsistent Form'
        };
    }

    /**
     * Get comprehensive player stats
     * @param {string} userId - Player ID
     * @returns {Object} - All analytics for player
     */
    getPlayerAnalytics(userId) {
        const matchesPlayed = this.getPlayerMatchesPlayed(userId);
        const noShows = this.getPlayerNoShows(userId);
        const last5Results = this.getPlayerLast5Results(userId);
        
        const consistency = this.calculateConsistency(last5Results);
        const reliability = this.calculateReliability(matchesPlayed, noShows);
        const noShowPrediction = this.predictNoShow(reliability.score);
        const consistencyStreak = this.checkConsistencyStreak(userId);

        return {
            userId,
            consistency,
            reliability,
            noShowPrediction,
            consistencyStreak,
            last5Results,
            matchesPlayed,
            noShows,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Get leaderboard sorted by consistency
     * @param {number} limit - Number of players to return
     * @returns {Array} - Sorted players with analytics
     */
    getConsistencyLeaderboard(limit = 20) {
        const playersWithAnalytics = this.users
            .filter(user => user.gamerTag && this.getPlayerMatchesPlayed(user.id) > 0)
            .map(user => ({
                ...user,
                analytics: this.getPlayerAnalytics(user.id)
            }))
            .sort((a, b) => b.analytics.consistency.score - a.analytics.consistency.score)
            .slice(0, limit);

        return playersWithAnalytics;
    }
}

// Create global instance
window.ChiromoAnalytics = new ChiromoAnalytics();

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    window.ChiromoAnalytics.init();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChiromoAnalytics;
}