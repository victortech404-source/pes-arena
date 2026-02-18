// UON HUB/js/admin-core.js - Main Admin Controller with Role-Based Governance & Paid Tournaments
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
            case 'create':
                // Tournament creation form is already loaded
                break;
        }
    }

    // --- EXCEL EXPORT FUNCTIONALITY (UPDATED) ---
    async exportUsersToCSV() {
        const exportButton = document.querySelector('.admin-actions .btn-outline');
        const originalText = exportButton.textContent;
        
        // Show loading state
        exportButton.textContent = "📊 Exporting...";
        exportButton.disabled = true;
        
        try {
            // Show loading notification
            Swal.fire({
                title: 'Exporting User Data',
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

            // Define CSV headers - UPDATED
            const headers = [
                'Full Name',
                'Student ID', 
                'Institution/Region', // Changed from Faculty to Institution/Region
                'Phone',
                'Email',
                'Gamer Tag',
                'Fav Team',
                'Team Strength',
                'Skill Level',
                'Platform', // Ensure Platform is correctly mapped
                'Registration Date',
                'Wins',
                'Losses',
                'Draws',
                'Win Rate',
                'Win Streak',
                'Goals Scored',
                'Goals Conceded',
                'Goal Difference',
                'Clean Sheets',
                'Matches Played'
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

                // Calculate goal difference if not present
                const goalsScored = user.goalsScored || 0;
                const goalsConceded = user.goalsConceded || 0;
                const goalDifference = goalsScored - goalsConceded;

                // Map user data to CSV columns
                const row = [
                    getValue('fullName'),
                    getValue('uonId'),
                    getValue('institution') || getValue('faculty'), // Use institution if available, fallback to faculty
                    getValue('phone'),
                    getValue('email'),
                    getValue('gamerTag'),
                    getValue('favoriteTeam'),
                    getValue('teamStrength'),
                    getValue('skillLevel'),
                    getValue('platform'), // Ensure Platform field is used
                    user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A',
                    user.wins || 0,
                    user.losses || 0,
                    user.draws || 0,
                    user.winRate || 0,
                    user.winStreak || 0,
                    goalsScored,
                    goalsConceded,
                    goalDifference,
                    user.cleanSheets || 0,
                    user.matchesPlayed || 0
                ];
                
                csvRows.push(row.join(','));
            });

            // Create CSV string
            const csvString = csvRows.join('\n');
            
            // Create download link with updated filename
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (navigator.msSaveBlob) { // IE 10+
                navigator.msSaveBlob(blob, 'PES_ARENA_Master_Database.csv'); // Updated filename
            } else {
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', 'PES_ARENA_Master_Database.csv'); // Updated filename
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            // Show success message
            Swal.fire({
                title: 'Export Complete!',
                text: `${snapshot.size} users exported successfully.`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
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

    // --- APPLICATIONS TAB (UPDATED with organizer filter) ---
    async loadPendingRequests() {
        const container = document.getElementById('pending-requests-container');
        container.innerHTML = '<p>Loading...</p>';
        try {
            let query = this.db.collection('tournamentRegistrations')
                .where('status', '==', 'pending')
                .orderBy('timestamp', 'desc');
            
            // Step 11: Filter for non-super admins
            if (this.currentUser && this.currentUser.email.toLowerCase() !== this.SUPER_ADMIN_EMAIL.toLowerCase()) {
                // First get tournaments organized by this user
                const myTournaments = await this.db.collection('tournaments')
                    .where('organizerId', '==', this.currentUser.uid)
                    .get();
                
                if (myTournaments.empty) {
                    container.innerHTML = '<div class="empty-state"><span class="empty-icon">📋</span><h3>No Applications</h3><p>No pending join requests for your tournaments.</p></div>'; 
                    return;
                }
                
                const myTournamentIds = myTournaments.docs.map(doc => doc.id);
                query = query.where('tournamentId', 'in', myTournamentIds.slice(0, 10)); // Firebase limit of 10 in 'in' queries
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

    // --- TOURNAMENTS TAB (UPDATED with organizer filter) ---
    async loadTournaments() {
        const container = document.getElementById('active-tournaments-list');
        container.innerHTML = '<p>Loading tournaments...</p>';
        
        try {
            let query = this.db.collection('tournaments').orderBy('createdAt', 'desc');
            
            // Step 11: Filter tournaments for non-super admins
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
                const time = t.matchTime || 'TBA';
                
                // Check for existing images
                const hasStandings = !!t.standingsImg;
                const hasFixtures = !!t.fixturesImg;
                
                // Display entry fee if it exists
                const entryFeeDisplay = t.entryFee ? `💰 Ksh ${t.entryFee} Entry` : '🎟️ Free Entry';
                
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
                            <span>${entryFeeDisplay}</span>
                        </div>
                        <div class="action-row">
                            <button onclick="window.adminManager.viewTournamentPlayers('${doc.id}', '${t.name}')" class="btn-approve">👥 Manage</button>
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
        
        // Store tournament ID for export
        overlay.dataset.tournamentId = tournamentId;
        overlay.dataset.tournamentName = tournamentName;
        
        // 1. Show Modal immediately
        overlay.classList.add('open');
        overlay.style.display = 'flex';
        
        // 2. Set Header & Loading State
        title.textContent = `Players: ${tournamentName}`;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading players...</td></tr>';
        
        // Show export button
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
            // Hide export button
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
        
        // Reset Inputs
        document.getElementById('mm-standings').value = '';
        document.getElementById('mm-fixtures').value = '';
        
        // Load Current Data to show Previews
        try {
            const doc = await this.db.collection('tournaments').doc(tournamentId).get();
            if (doc.exists) {
                const t = doc.data();
                
                // Helper to setup preview
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

        // Helper to convert image
        const readFile = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        };

        try {
            const updateData = {};
            
            // Only update fields if a NEW file was selected
            if (standingsFile) {
                updateData.standingsImg = await readFile(standingsFile);
            }
            if (fixturesFile) {
                updateData.fixturesImg = await readFile(fixturesFile);
            }

            if (Object.keys(updateData).length === 0) {
                throw new Error("No new files selected. Nothing to update.");
            }

            // Update timestamp to force refresh on client side if needed
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
            this.loadTournaments(); // Refresh list to show checkmarks

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

    // Step 11 & Paid Tournaments: Updated tournament creation with organizerId and entryFee
    async handleCreateTournament() {
        const btn = document.querySelector('#create-tournament-form button');
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
            const standingsFile = document.getElementById('t-img-standings').files[0];
            const fixturesFile = document.getElementById('t-img-fixtures').files[0];

            let standingsBase64 = null;
            let fixturesBase64 = null;

            // Convert if files exist
            if (standingsFile) standingsBase64 = await readFileAsBase64(standingsFile);
            if (fixturesFile) fixturesBase64 = await readFileAsBase64(fixturesFile);

            // Get entry fee value (new field for paid tournaments)
            const entryFeeInput = document.getElementById('t-entry-fee');
            const entryFeeValue = entryFeeInput ? entryFeeInput.value : '0';
            
            // Convert entry fee to number, default to 0 if empty or invalid
            const entryFee = entryFeeValue && !isNaN(parseFloat(entryFeeValue)) ? parseFloat(entryFeeValue) : 0;

            const data = {
                name: document.getElementById('t-name').value,
                link: document.getElementById('t-link').value || '',
                startDate: new Date(document.getElementById('t-date').value),
                matchTime: document.getElementById('t-time').value,
                format: document.getElementById('t-format').value,
                platform: document.getElementById('t-platform').value,
                maxParticipants: parseInt(document.getElementById('t-max').value) || 32,
                prizePool: document.getElementById('t-prize').value || '',
                description: document.getElementById('t-desc').value || '',
                formatDetails: document.getElementById('t-format-details').value || '',
                matchRules: document.getElementById('t-rules').value || '',
                
                // IMAGE FIELDS
                standingsImg: standingsBase64, 
                fixturesImg: fixturesBase64,

                // PAID TOURNAMENTS: Entry fee field
                entryFee: entryFee,
                
                // Step 11: Store organizer information for multi-university scaling
                organizerId: this.currentUser.uid,
                organizerEmail: this.currentUser.email,
                organizerName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
                
                status: 'active',
                participants: 0,
                featured: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Validate entry fee is not negative
            if (entryFee < 0) {
                throw new Error("Entry fee cannot be negative. Please enter a valid amount.");
            }

            await this.db.collection('tournaments').add(data);
            
            // Show success message with entry fee information
            let successMessage = 'Tournament created successfully!';
            if (entryFee > 0) {
                successMessage = `💰 Paid Tournament Created! Entry fee: Ksh ${entryFee}`;
            }
            
            Swal.fire('Success!', successMessage, 'success');
            document.getElementById('create-tournament-form').reset();
            this.loadDashboardStats();
            this.switchTab('tournaments');
        } catch (error) {
            console.error(error);
            Swal.fire('Error', error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = "🚀 Launch Tournament";
        }
    }

    async handlePostNews() {
        const btn = document.querySelector('#create-news-form button');
        btn.disabled = true;
        btn.textContent = "Publishing...";

        try {
            // Helper to read file as Base64
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

            // Get form values
            const title = document.getElementById('news-title').value;
            const category = document.getElementById('news-category').value;
            const content = document.getElementById('news-content').value;
            const dateInput = document.getElementById('news-date').value;
            const authorInput = document.getElementById('news-author').value;
            const imageFile = document.getElementById('news-image').files[0];

            // Validate required fields
            if (!title || !category || !content) {
                throw new Error("Please fill in all required fields: Title, Category, and Content.");
            }

            // Convert image if exists
            let imageBase64 = null;
            if (imageFile) {
                imageBase64 = await readFileAsBase64(imageFile);
            }

            // Handle date - use input if provided, otherwise use current date
            let publishDate;
            let dateString = '';
            
            if (dateInput) {
                // Create date from input
                publishDate = new Date(dateInput);
                dateString = dateInput; // Store the raw date string for sorting
            } else {
                // Use current date
                publishDate = new Date();
                dateString = publishDate.toISOString().split('T')[0]; // YYYY-MM-DD format
            }

            // Handle author - use input if provided, otherwise use admin email
            const author = authorInput.trim() || this.currentUser.email;

            // Prepare news data
            const newsData = {
                title: title,
                category: category,
                content: content,
                image: imageBase64,
                author: author,
                dateString: dateString, // Store the date string for easy sorting
                status: 'published',
                views: 0,
                createdAt: dateInput ? firebase.firestore.Timestamp.fromDate(publishDate) : firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Save to Firestore
            await this.db.collection('news').add(newsData);
            
            // Reset form and show success
            document.getElementById('create-news-form').reset();
            
            Swal.fire({
                icon: 'success',
                title: 'Published!',
                text: 'News post has been published successfully.',
                timer: 1500,
                showConfirmButton: false
            });
            
            // Reload news posts
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
                
                // Use dateString if available, otherwise format from createdAt
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
                
                // Format display date (without time)
                const displayDate = dateStr;
                
                // Truncate content for preview
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
                
                // Remove from UI
                document.getElementById(`news-${postId}`).remove();
                
                Swal.fire(
                    'Deleted!',
                    'The news post has been deleted.',
                    'success'
                );
                
                // Check if there are no more posts
                const container = document.getElementById('news-posts-list');
                if (container.children.length === 0) {
                    this.loadNewsPosts(); // Reload to show empty state
                }
                
            } catch (error) {
                Swal.fire('Error', 'Failed to delete post: ' + error.message, 'error');
            }
        }
    }

    // --- SYNC OLD STATS FUNCTION (UPDATED with new notification text) ---
    async syncOldStats() {
        const result = await Swal.fire({
            title: 'Recalculate Global Rankings?',
            text: 'Recalculating all PES ARENA global rankings and ELO scores...', // Updated text
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

            // 1. Fetch all approved matches FIRST
            const matches = await this.db.collection('matches').where('status', '==', 'approved').get();
            
            if (matches.empty) {
                Swal.fire('No Data', 'No approved matches found to sync.', 'info');
                return;
            }

            // 2. Create a map to accumulate stats per user
            const userStatsMap = new Map();
            
            // 3. Process all matches and accumulate stats
            for (const matchDoc of matches.docs) {
                const m = matchDoc.data();
                
                // Convert scores to Numbers
                const p1Score = Number(m.myScore || 0);
                const p2Score = Number(m.oppScore || 0);
                
                // Process player 1
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
                
                // Process player 2
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

            // 4. Get all users to reset non-participants
            const allUsers = await this.db.collection('users').get();
            
            // 5. Update users in batches
            const batch = this.db.batch();
            let batchCount = 0;
            
            // First, reset everyone to zero
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
                
                // Commit batch every 500 operations
                if (batchCount >= 500) {
                    batch.commit();
                    batchCount = 0;
                }
            });
            
            if (batchCount > 0) {
                await batch.commit();
            }

            // 6. Update users with calculated stats
            const updateBatch = this.db.batch();
            let updateCount = 0;
            
            for (const [userId, stats] of userStatsMap.entries()) {
                const userRef = this.db.collection('users').doc(userId);
                
                const totalMatches = stats.wins + stats.losses + stats.draws;
                const winRate = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;
                const goalDifference = stats.goalsScored - stats.goalsConceded;
                
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
                    winStreak: 0
                });
                
                updateCount++;
                
                // Commit batch every 500 operations
                if (updateCount >= 500) {
                    await updateBatch.commit();
                    updateCount = 0;
                }
            }
            
            if (updateCount > 0) {
                await updateBatch.commit();
            }

            // 7. Final Step: Calculate Ranks based on Wins and Goal Difference
            const finalUsers = await this.db.collection('users')
                .where('matchesPlayed', '>', 0)
                .get();
            
            let players = finalUsers.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            // Sort by wins (descending), then goal difference (descending)
            players.sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.goalDifference - a.goalDifference;
            });

            // Update ranks in batches
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
                        <p>• Rankings are now 100% accurate based on historical performance</p>
                    </div>
                `,
                confirmButtonText: 'Awesome!'
            });
            
        } catch (e) { 
            console.error('Recalculation failed:', e);
            Swal.fire('Error', 'Recalculation failed: ' + e.message, 'error'); 
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { 
    window.adminManager = new AdminManager(); 
});