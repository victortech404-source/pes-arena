// Environment Configuration
const CONFIG = {
    // Firebase Configuration
    FIREBASE: {
        apiKey: "AIzaSyCvyN-rejUXKflXTZZzvmJp8w22RPil1og",
        authDomain: "uon-efootball.firebaseapp.com",
        projectId: "uon-efootball",
        storageBucket: "uon-efootball.firebasestorage.app",
        messagingSenderId: "641016442344",
        appId: "1:641016442344:web:58d7e48a0b14709b02085d",
        measurementId: "G-ZD27X0ZL0G"
    },

    // Easy Tournament Integration
    EASY_TOURNAMENT: {
        baseUrl: "https://easytournament.net",
        tournamentId: process.env.EASY_TOURNAMENT_ID || "your-tournament-id"
    },

    // API Endpoints
    API: {
        baseUrl: process.env.API_BASE_URL || "https://api.uonefootballhub.ac.ke",
        endpoints: {
            tournaments: "/api/tournaments",
            leaderboard: "/api/leaderboard",
            players: "/api/players",
            matches: "/api/matches"
        }
    },

    // Feature Flags
    FEATURES: {
        registration: true,
        tournaments: true,
        leaderboard: true,
        liveStreaming: false, // Coming soon
        payments: false, // Coming soon
        teamManagement: false // Coming soon
    },

    // Social Links
    SOCIAL: {
        whatsapp: "https://chat.whatsapp.com/FbtJPdiPtzFFDQqzcAz75A",
        discord: "https://discord.gg/uonefootball",
        instagram: "https://instagram.com/uonefootball",
        twitter: "https://twitter.com/uonefootball",
        youtube: "https://youtube.com/uonefootball",
        twitch: "https://twitch.tv/uonefootball"
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}