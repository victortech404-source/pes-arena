// Firebase Configuration with error handling
const firebaseConfig = {
    apiKey: "AIzaSyCvyN-rejUXKflXTZZzvmJp8w22RPil1og",
    authDomain: "uon-efootball.firebasestorage.app",
    projectId: "uon-efootball",
    storageBucket: "uon-efootball.firebasestorage.app",
    messagingSenderId: "641016442344",
    appId: "1:641016442344:web:58d7e48a0b14709b02085d",
    measurementId: "G-ZD27X0ZL0G"
};

// Initialize Firebase with error handling
let app, db, auth, analytics;

try {
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
    }
    
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    // analytics = firebase.analytics(); // Commented out to prevent crash
    console.log('✅ Firebase initialized successfully');
    console.log('✅ Firestore:', db);
    console.log('✅ Auth:', auth);
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.error('❌ Firebase object available:', typeof firebase !== 'undefined');
    // Fallback to mock data
    console.log('Using mock data mode');
}

class FirebaseManager {
    constructor() {
        this.currentUser = null;
        this.isFirebaseConnected = !!app;
        console.log('🔥 FirebaseManager initialized. Firebase connected:', this.isFirebaseConnected);
        this.init();
    }

    init() {
        if (this.isFirebaseConnected) {
            this.setupAuthListener();
            this.loadInitialData();
        } else {
            console.log('Firebase not connected - using demo mode');
            this.loadDemoData();
        }
    }

    // Demo data for when Firebase is not available
    loadDemoData() {
        this.tournaments = [
            {
                id: 'demo-1',
                name: "UON Championship 2025",
                description: "The premier eFootball competition at University of Nairobi",
                status: "active",
                format: "single-elimination",
                platform: "all",
                maxParticipants: 128,
                participants: 45,
                startDate: new Date('2025-03-01'),
                prizePool: 500,
                featured: true
            },
            {
                id: 'demo-2', 
                name: "Weekly Knockout Cup",
                description: "Fast-paced weekly tournament",
                status: "upcoming",
                format: "double-elimination",
                platform: "all",
                maxParticipants: 64,
                participants: 32,
                startDate: new Date('2025-03-08'),
                prizePool: 100
            }
        ];

        this.leaderboard = [
            {
                id: 'player-1',
                fullName: 'John "Striker" Doe',
                gamerTag: 'UON_Striker',
                points: 2450,
                wins: 42,
                losses: 8,
                winRate: 84,
                rank: 1
            },
            {
                id: 'player-2',
                fullName: 'Sarah "ProGamer" Smith', 
                gamerTag: 'UON_ProGamer',
                points: 2380,
                wins: 38,
                losses: 10,
                winRate: 79,
                rank: 2
            }
        ];
    }

    // Helper method for demo defenders data
    loadDemoDefenders() {
        console.log('📱 Using demo data for top defenders');
        return [
            { id: 'demo-1', gamerTag: 'DefensiveKing', goalsConceded: 12, matchesPlayed: 25, fullName: 'Mike Defensor', wins: 20, losses: 5 },
            { id: 'demo-2', gamerTag: 'Wall_UON', goalsConceded: 15, matchesPlayed: 30, fullName: 'Jane Defender', wins: 25, losses: 5 },
            { id: 'demo-3', gamerTag: 'CleanSheet', goalsConceded: 18, matchesPlayed: 22, fullName: 'David Guardian', wins: 18, losses: 4 },
            { id: 'demo-4', gamerTag: 'BrickWall', goalsConceded: 20, matchesPlayed: 35, fullName: 'Robert Shield', wins: 28, losses: 7 },
            { id: 'demo-5', gamerTag: 'GoalieGod', goalsConceded: 22, matchesPlayed: 28, fullName: 'Thomas Keeper', wins: 21, losses: 7 },
            { id: 'demo-6', gamerTag: 'DefensePro', goalsConceded: 24, matchesPlayed: 40, fullName: 'Linda Wall', wins: 32, losses: 8 },
            { id: 'demo-7', gamerTag: 'SafeHands', goalsConceded: 25, matchesPlayed: 32, fullName: 'Grace Stopper', wins: 25, losses: 7 },
            { id: 'demo-8', gamerTag: 'ZeroGoals', goalsConceded: 26, matchesPlayed: 29, fullName: 'Peter Defender', wins: 22, losses: 7 },
            { id: 'demo-9', gamerTag: 'BackLine', goalsConceded: 27, matchesPlayed: 36, fullName: 'Susan Guard', wins: 28, losses: 8 },
            { id: 'demo-10', gamerTag: 'SecureDef', goalsConceded: 28, matchesPlayed: 31, fullName: 'James Fortress', wins: 24, losses: 7 }
        ];
    }

    // NEW: Get player form (last 5 matches results)
    async getPlayerForm(userId) {
        console.log(`🔍 Fetching form for player: ${userId}`);
        
        if (!this.isFirebaseConnected) {
            console.log('📱 Using demo form data');
            // Return demo form data
            return ['W', 'L', 'W', 'D', 'W'];
        }

        try {
            // Query matches where player was either player1 or player2
            const snapshot = await db.collection('matches')
                .where('status', '==', 'approved')
                .where('player1Id', '==', userId)
                .orderBy('approvedAt', 'desc')
                .limit(5)
                .get();
            
            // Also query matches where player was player2
            const snapshot2 = await db.collection('matches')
                .where('status', '==', 'approved')
                .where('player2Id', '==', userId)
                .orderBy('approvedAt', 'desc')
                .limit(5)
                .get();
            
            // Combine both results
            let allMatches = [];
            
            snapshot.docs.forEach(doc => {
                allMatches.push({ id: doc.id, ...doc.data() });
            });
            
            snapshot2.docs.forEach(doc => {
                allMatches.push({ id: doc.id, ...doc.data() });
            });
            
            // Remove duplicates and sort by timestamp (most recent first)
            allMatches = allMatches
                .filter((match, index, self) => 
                    index === self.findIndex(m => m.id === match.id)
                )
                .sort((a, b) => {
                    const timeA = a.approvedAt?.toDate() || a.timestamp?.toDate() || new Date(0);
                    const timeB = b.approvedAt?.toDate() || b.timestamp?.toDate() || new Date(0);
                    return timeB - timeA;
                })
                .slice(0, 5); // Take only the 5 most recent
            
            // Convert matches to form results
            const formResults = allMatches.map(match => {
                const isPlayer1 = match.player1Id === userId;
                const playerScore = isPlayer1 ? match.score1 : match.score2;
                const opponentScore = isPlayer1 ? match.score2 : match.score1;
                
                if (playerScore > opponentScore) return 'W'; // Win
                if (playerScore < opponentScore) return 'L'; // Loss
                return 'D'; // Draw
            });
            
            console.log(`✅ Found ${formResults.length} form results:`, formResults);
            return formResults;
            
        } catch (error) {
            console.error('❌ Error fetching player form:', error);
            return [];
        }
    }

    // Get top 10 players by goalsScored (only those who have scored at least 1 goal)
    async getTopAttackers() {
        console.log('🔍 Fetching top attackers...');
        
        if (!this.isFirebaseConnected) {
            console.log('📱 Using demo data for top attackers');
            // Return demo attackers data
            return [
                { id: 'demo-1', gamerTag: 'UON_Striker', goalsScored: 42, fullName: 'John Doe', wins: 42, losses: 8, matchesPlayed: 50 },
                { id: 'demo-2', gamerTag: 'UON_ProGamer', goalsScored: 38, fullName: 'Sarah Smith', wins: 38, losses: 10, matchesPlayed: 48 },
                { id: 'demo-3', gamerTag: 'GoalMachine', goalsScored: 35, fullName: 'Alex Johnson', wins: 35, losses: 12, matchesPlayed: 47 }
            ];
        }

        try {
            // Fetch users who have scored at least 1 goal, ranked by goalsScored
            const snapshot = await db.collection('users')
                .where('goalsScored', '>', 0)
                .orderBy('goalsScored', 'desc')
                .limit(10)
                .get();
            
            const attackers = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            console.log(`✅ Found ${attackers.length} top attackers (goals > 0)`);
            return attackers;
            
        } catch (error) {
            console.error('❌ Error fetching top attackers:', error);
            return [];
        }
    }

    // UPDATED: Get top 10 defenders by least goalsConceded (must have played at least 1 match)
    async getTopDefenders() {
        console.log('🔍 Fetching top defenders...');
        
        if (!this.isFirebaseConnected) {
            return this.loadDemoDefenders(); // Use the new helper method
        }

        try {
            // Fetch more users to ensure we find 10 who have actually played matches
            const snapshot = await db.collection('users')
                .orderBy('goalsConceded', 'asc')
                .limit(100) 
                .get();
            
            const topDefenders = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(user => (user.matchesPlayed || 0) > 0) // Only active players
                .slice(0, 10); // Take top 10
            
            console.log(`✅ Found ${topDefenders.length} active top defenders`);
            return topDefenders;
            
        } catch (error) {
            console.error('❌ Error fetching top defenders:', error);
            return [];
        }
    }

    // Get the single most recently approved match
    async getLatestApprovedMatch() {
        console.log('🔍 Fetching latest approved match...');
        
        if (!this.isFirebaseConnected) {
            console.log('📱 Using demo data for latest match');
            // Return demo match data
            return {
                id: 'demo-match-1',
                player1: 'UON_Striker',
                player2: 'UON_ProGamer',
                player1Id: 'user1',
                player2Id: 'user2',
                score1: 3,
                score2: 2,
                date: new Date().toISOString(),
                platform: 'PlayStation',
                status: 'approved',
                approvedAt: new Date()
            };
        }

        try {
            // Get the single most recently approved match
            const snapshot = await db.collection('matches')
                .where('status', '==', 'approved')
                .orderBy('approvedAt', 'desc')
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                console.log('ℹ️ No approved matches found');
                return null;
            }
            
            const match = { 
                id: snapshot.docs[0].id, 
                ...snapshot.docs[0].data() 
            };
            
            console.log('✅ Found latest approved match:', match);
            return match;
            
        } catch (error) {
            console.error('❌ Error fetching latest approved match:', error);
            return null;
        }
    }

    // Fixed registerUser method with proper Firebase implementation including faculty and teamStrength fields
    async registerUser(userData) {
        console.log('🔄 Attempting registration with data:', userData);
        
        if (!this.isFirebaseConnected) {
            console.error('❌ Firebase not connected - cannot register user');
            return { 
                success: false, 
                error: "Firebase not available. Please check your internet connection and try again." 
            };
        }

        try {
            console.log('🔐 Creating user with email and password...');
            
            // Create user with email and password
            const userCredential = await auth.createUserWithEmailAndPassword(
                userData.email, 
                userData.password
            );
            
            console.log('✅ User created successfully:', userCredential.user.uid);

            // Add user data to Firestore
            console.log('💾 Saving user data to Firestore...');
            await db.collection('users').doc(userCredential.user.uid).set({
                fullName: userData.fullName,
                uonId: userData.uonId,
                email: userData.email,
                phone: userData.phone,
                gamerTag: userData.gamerTag,
                platform: userData.platform,
                teamStrength: userData.teamStrength || '', // Replaced favoriteTeam with teamStrength
                skillLevel: userData.skillLevel,
                faculty: userData.faculty, // Added faculty field
                newsletter: userData.newsletter || false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isVerified: false,
                // Initialize stats for new users
                goalsScored: 0,
                goalsConceded: 0,
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                points: 0
            });

            console.log('✅ User data saved to Firestore');

            // Send verification email
            await userCredential.user.sendEmailVerification();
            console.log('✅ Verification email sent');
            
            return { success: true, userId: userCredential.user.uid };
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error message:', error.message);
            
            return { 
                success: false, 
                error: error.message,
                code: error.code
            };
        }
    }

    // Test Firebase connection
    async testFirebaseConnection() {
        if (!this.isFirebaseConnected) {
            return { success: false, error: "Firebase not initialized" };
        }

        try {
            // Try a simple Firestore operation
            const testDoc = await db.collection('test').doc('connection').get();
            return { success: true, exists: testDoc.exists };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getTournaments() {
        if (!this.isFirebaseConnected) {
            console.log('📱 Using demo tournaments data');
            return { success: true, data: this.tournaments };
        }

        try {
            const snapshot = await db.collection('tournaments')
                .where('status', 'in', ['active', 'upcoming'])
                .orderBy('startDate', 'asc')
                .limit(10)
                .get();
            
            const tournaments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            return { success: true, data: tournaments };
        } catch (error) {
            console.error('Error fetching tournaments:', error);
            return { success: false, error: error.message, data: this.tournaments };
        }
    }

    setupAuthListener() {
        if (!this.isFirebaseConnected) {
            console.log('❌ Cannot setup auth listener - Firebase not connected');
            return;
        }
        
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                console.log('✅ User signed in:', user.email);
                this.updateUIForLoggedInUser(user);
            } else {
                console.log('✅ User signed out');
                this.updateUIForLoggedOutUser();
            }
        });
    }

    updateUIForLoggedInUser(user) {
        // Remove existing Join button
        const joinBtn = document.getElementById('nav-join-hub');
        if (joinBtn) joinBtn.style.display = 'none';

        // Remove existing user menu if any
        const existingMenu = document.querySelector('.user-menu-item');
        if (existingMenu) existingMenu.remove();

        // Update navigation
        const nav = document.querySelector('.nav-menu');
        if (nav) {
            const userMenu = document.createElement('li');
            userMenu.className = 'nav-item user-menu-item';
            
            // Get first name only to save space
            const displayName = user.displayName ? user.displayName.split(' ')[0] : 'Player';
            
            userMenu.innerHTML = `
                <div class="user-menu">
                    <span>👋 ${displayName}</span>
                    <button onclick="window.firebaseManager.signOut()">Logout</button>
                </div>
            `;
            nav.appendChild(userMenu);
        }
    }

    updateUIForLoggedOutUser() {
        // Show login/register buttons
        const userMenu = document.querySelector('.user-menu-item');
        if (userMenu) {
            userMenu.remove();
        }
        
        // Show Join button again
        const joinBtn = document.getElementById('nav-join-hub');
        if (joinBtn) joinBtn.style.display = 'block';
    }

    async signOut() {
        if (!this.isFirebaseConnected) return;
        
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }

    loadInitialData() {
        console.log('📦 Loading initial data from Firebase...');
    }
}

// Initialize Firebase Manager
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Firebase Manager...');
    window.firebaseManager = new FirebaseManager();
    
    // Test Firebase connection after initialization
    setTimeout(async () => {
        const testResult = await window.firebaseManager.testFirebaseConnection();
        console.log('🧪 Firebase connection test:', testResult);
    }, 1000);
});