// UON HUB/js/admin-users.js - User Management Module
class AdminUsers {
    constructor() {
        this.db = null;
        this.allUsers = [];
        this.filteredUsers = [];
        this.currentTournamentId = null;
        this.currentTournamentName = null;
    }

    init(db) {
        this.db = db;
        console.log("AdminUsers module initialized");
    }

    // --- USER MANAGEMENT TAB ---
    async loadUsersList() {
        const container = document.getElementById('users-list-container');
        if (!container) return;
        
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px">
                    <div class="loading-spinner"></div>
                    <p style="color: #666; margin-top: 10px">Loading users...</p>
                </td>
            </tr>
        `;
        
        try {
            const snapshot = await this.db.collection('users')
                .orderBy('gamerTag')
                .get();
            
            this.allUsers = [];
            snapshot.forEach(doc => {
                const user = doc.data();
                this.allUsers.push({
                    id: doc.id,
                    ...user,
                    matchesPlayed: user.matchesPlayed || 0,
                    winRate: user.winRate || 0,
                    goalsScored: user.goalsScored || 0,
                    goalsConceded: user.goalsConceded || 0
                });
            });
            
            this.filteredUsers = [...this.allUsers];
            this.renderUsersTable();
            
        } catch (error) {
            console.error('Error loading users:', error);
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #ff4444">
                        <span class="empty-icon">⚠️</span>
                        <h4 style="margin: 10px 0">Error Loading Users</h4>
                        <p>${error.message}</p>
                    </td>
                </tr>
            `;
        }
    }

    renderUsersTable() {
        const container = document.getElementById('users-list-container');
        if (!container || this.filteredUsers.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #888">
                        <span class="empty-icon">👤</span>
                        <h4 style="margin: 10px 0">No Users Found</h4>
                        <p>No users match your search criteria</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        this.filteredUsers.forEach(user => {
            // Determine win rate class
            let winRateClass = 'low';
            if (user.winRate >= 70) winRateClass = 'high';
            else if (user.winRate >= 40) winRateClass = 'medium';
            
            // Format registration date
            let regDate = 'N/A';
            if (user.createdAt && user.createdAt.toDate) {
                regDate = user.createdAt.toDate().toLocaleDateString();
            }
            
            html += `
                <tr>
                    <td>
                        <span class="user-tag">@${user.gamerTag || 'No tag'}</span>
                    </td>
                    <td>${user.fullName || 'Unknown'}</td>
                    <td>${user.email || 'No email'}</td>
                    <td>
                        <span class="win-rate ${winRateClass}">
                            ${user.winRate || 0}%
                        </span>
                    </td>
                    <td>${user.matchesPlayed || 0}</td>
                    <td>
                        <button onclick="window.adminUsers.viewPlayerProfile('${user.id}')" 
                                class="btn btn-outline btn-sm"
                                style="border-color: var(--neon-green); color: var(--neon-green); padding: 4px 10px; font-size: 0.8rem;">
                            👤 View Profile
                        </button>
                    </td>
                </tr>
            `;
        });
        
        container.innerHTML = html;
    }

    searchUsers(event) {
        const searchTerm = event.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.filteredUsers = [...this.allUsers];
        } else {
            this.filteredUsers = this.allUsers.filter(user => {
                return (
                    (user.gamerTag && user.gamerTag.toLowerCase().includes(searchTerm)) ||
                    (user.fullName && user.fullName.toLowerCase().includes(searchTerm)) ||
                    (user.email && user.email.toLowerCase().includes(searchTerm)) ||
                    (user.uonId && user.uonId.toLowerCase().includes(searchTerm))
                );
            });
        }
        
        this.renderUsersTable();
    }

    // --- PLAYER PROFILE VIEW ---
    async viewPlayerProfile(userId) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            
            if (!userDoc.exists) {
                Swal.fire('Error', 'User not found!', 'error');
                return;
            }
            
            const user = userDoc.data();
            
            // Calculate additional stats
            const totalMatches = (user.wins || 0) + (user.losses || 0) + (user.draws || 0);
            const goalsScored = user.goalsScored || 0;
            const goalsConceded = user.goalsConceded || 0;
            const goalDifference = goalsScored - goalsConceded;
            
            // Format registration date
            let regDate = 'Unknown';
            if (user.createdAt && user.createdAt.toDate) {
                regDate = user.createdAt.toDate().toLocaleDateString();
            }
            
            // Get tournament registrations
            const registrations = await this.db.collection('tournamentRegistrations')
                .where('userId', '==', userId)
                .where('status', '==', 'approved')
                .get();
            
            const tournamentCount = registrations.size;
            
            // Create profile HTML
            const profileHtml = `
                <div style="text-align: left; max-height: 60vh; overflow-y: auto; padding: 10px;">
                    <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #333;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 5px 0; color: #fff;">${user.fullName || 'Unknown'}</h3>
                            <p style="margin: 0; color: var(--neon-green); font-weight: bold;">@${user.gamerTag || 'No tag'}</p>
                        </div>
                        <div style="text-align: right;">
                            <span style="background: rgba(0, 136, 255, 0.2); color: #0088ff; padding: 5px 10px; border-radius: 20px; font-size: 0.8rem;">
                                Registered: ${regDate}
                            </span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px;">
                            <div style="color: #888; font-size: 0.8rem; margin-bottom: 5px;">Email</div>
                            <div style="color: #fff; font-weight: 500;">${user.email || 'N/A'}</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px;">
                            <div style="color: #888; font-size: 0.8rem; margin-bottom: 5px;">Student ID</div>
                            <div style="color: #fff; font-weight: 500;">${user.uonId || 'N/A'}</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px;">
                            <div style="color: #888; font-size: 0.8rem; margin-bottom: 5px;">Phone</div>
                            <div style="color: #fff; font-weight: 500;">${user.phone || 'N/A'}</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px;">
                            <div style="color: #888; font-size: 0.8rem; margin-bottom: 5px;">Faculty</div>
                            <div style="color: #fff; font-weight: 500;">${user.faculty || 'N/A'}</div>
                        </div>
                    </div>
                    
                    <h4 style="color: var(--neon-green); margin: 25px 0 15px 0; border-bottom: 1px solid #333; padding-bottom: 8px;">📊 Match Statistics</h4>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div style="background: rgba(0, 255, 136, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #00ff88; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${user.wins || 0}</div>
                            <div style="color: #888; font-size: 0.8rem;">Wins</div>
                        </div>
                        <div style="background: rgba(255, 68, 68, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #ff4444; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${user.losses || 0}</div>
                            <div style="color: #888; font-size: 0.8rem;">Losses</div>
                        </div>
                        <div style="background: rgba(255, 193, 7, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #ffc107; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${user.draws || 0}</div>
                            <div style="color: #888; font-size: 0.8rem;">Draws</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #fff; font-size: 1.5rem; font-weight: bold; margin-bottom: 5px;">${user.winRate || 0}%</div>
                            <div style="color: #888; font-size: 0.8rem;">Win Rate</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #fff; font-size: 1.5rem; font-weight: bold; margin-bottom: 5px;">${user.winStreak || 0}</div>
                            <div style="color: #888; font-size: 0.8rem;">Win Streak</div>
                        </div>
                    </div>
                    
                    <h4 style="color: var(--neon-green); margin: 25px 0 15px 0; border-bottom: 1px solid #333; padding-bottom: 8px;">⚽ Goal Statistics</h4>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div style="background: rgba(0, 136, 255, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #0088ff; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${goalsScored}</div>
                            <div style="color: #888; font-size: 0.8rem;">Goals Scored</div>
                        </div>
                        <div style="background: rgba(255, 68, 68, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #ff4444; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${goalsConceded}</div>
                            <div style="color: #888; font-size: 0.8rem;">Goals Conceded</div>
                        </div>
                        <div style="background: rgba(0, 255, 136, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #00ff88; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${goalDifference}</div>
                            <div style="color: #888; font-size: 0.8rem;">Goal Difference</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #fff; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${user.cleanSheets || 0}</div>
                            <div style="color: #888; font-size: 0.8rem;">Clean Sheets</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #fff; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${user.matchesPlayed || 0}</div>
                            <div style="color: #888; font-size: 0.8rem;">Matches Played</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px;">
                            <div style="color: #888; font-size: 0.8rem; margin-bottom: 5px;">Favorite Team</div>
                            <div style="color: #fff; font-weight: 500;">${user.favoriteTeam || 'Not set'}</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px;">
                            <div style="color: #888; font-size: 0.8rem; margin-bottom: 5px;">Preferred Platform</div>
                            <div style="color: #fff; font-weight: 500;">${user.platform || 'Not set'}</div>
                        </div>
                    </div>
                    
                    <div style="background: rgba(255, 215, 0, 0.1); padding: 15px; border-radius: 10px; margin-top: 20px; text-align: center;">
                        <div style="color: #ffd700; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${tournamentCount}</div>
                        <div style="color: #888; font-size: 0.8rem;">Tournaments Joined</div>
                    </div>
                </div>
            `;
            
            Swal.fire({
                title: 'Player Profile',
                html: profileHtml,
                width: 800,
                showCloseButton: true,
                showConfirmButton: false,
                customClass: {
                    popup: 'dark-swal-popup'
                }
            });
            
        } catch (error) {
            console.error('Error loading player profile:', error);
            Swal.fire('Error', 'Failed to load player profile: ' + error.message, 'error');
        }
    }

    // --- TOURNAMENT EXPORT FUNCTION ---
    async exportTournamentUsers() {
        const overlay = document.getElementById('player-modal-overlay');
        const tournamentId = overlay.dataset.tournamentId;
        const tournamentName = overlay.dataset.tournamentName;
        
        if (!tournamentId || !tournamentName) {
            Swal.fire('Error', 'No tournament selected for export.', 'error');
            return;
        }
        
        try {
            // Show loading
            Swal.fire({
                title: 'Exporting Tournament List',
                text: 'Fetching registered users...',
                icon: 'info',
                showConfirmButton: false,
                allowOutsideClick: false
            });
            
            // Fetch tournament registrations
            const snapshot = await this.db.collection('tournamentRegistrations')
                .where('tournamentId', '==', tournamentId)
                .where('status', '==', 'approved')
                .get();
            
            if (snapshot.empty) {
                Swal.fire('No Data', 'No registered users found for this tournament.', 'info');
                return;
            }
            
            // Get user details for each registration
            const usersData = [];
            for (const doc of snapshot.docs) {
                const reg = doc.data();
                
                // Get user details
                const userDoc = await this.db.collection('users').doc(reg.userId).get();
                if (userDoc.exists) {
                    const user = userDoc.data();
                    usersData.push({
                        userId: reg.userId,
                        gamerTag: user.gamerTag || 'N/A',
                        fullName: user.fullName || 'N/A',
                        phone: user.phone || 'N/A',
                        email: user.email || 'N/A',
                        uonId: user.uonId || 'N/A',
                        faculty: user.faculty || 'N/A',
                        registrationDate: reg.timestamp ? reg.timestamp.toDate().toLocaleDateString() : 'N/A'
                    });
                }
            }
            
            // Prepare CSV data
            const headers = [
                'User ID',
                'Gamer Tag',
                'Full Name',
                'Phone Number',
                'Email',
                'Student ID',
                'Faculty',
                'Registration Date'
            ];
            
            const csvRows = [];
            csvRows.push(headers.join(','));
            
            usersData.forEach(user => {
                const row = [
                    user.userId,
                    `"${user.gamerTag}"`,
                    `"${user.fullName}"`,
                    `"${user.phone}"`,
                    `"${user.email}"`,
                    `"${user.uonId}"`,
                    `"${user.faculty}"`,
                    user.registrationDate
                ];
                csvRows.push(row.join(','));
            });
            
            const csvString = csvRows.join('\n');
            
            // Create download link
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            const sanitizedTournamentName = tournamentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `tournament_${sanitizedTournamentName}_players_${new Date().toISOString().split('T')[0]}.csv`;
            
            if (navigator.msSaveBlob) {
                navigator.msSaveBlob(blob, fileName);
            } else {
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            Swal.fire({
                icon: 'success',
                title: 'Export Complete!',
                text: `${usersData.length} players exported from "${tournamentName}".`,
                timer: 2000,
                showConfirmButton: false
            });
            
        } catch (error) {
            console.error('Error exporting tournament users:', error);
            Swal.fire('Export Failed', 'Could not export tournament users: ' + error.message, 'error');
        }
    }
}

// Initialize module
window.adminUsers = new AdminUsers();