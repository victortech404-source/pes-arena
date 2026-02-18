// js/blog.js - Dynamic News Manager for UON GRiD

class NewsManager {
    constructor() {
        this.news = [];
        this.filteredNews = [];
        this.currentPage = 1;
        this.newsPerPage = 6;
        this.currentCategory = 'all';
        this.isLoading = false;
        this.hasMore = true;
        this.categories = [
            { id: 'all', name: 'All News' },
            { id: 'tournament', name: 'Tournament' },
            { id: 'matchday', name: 'Matchday' },
            { id: 'spotlight', name: 'Player Spotlight' },
            { id: 'transfers', name: 'Transfers' },
            { id: 'update', name: 'Update' },
            { id: 'community', name: 'Community' },
            { id: 'event', name: 'Event' }
        ];
        
        // Firestore references
        this.db = firebase.firestore();
        this.newsCollection = this.db.collection('news');
        this.usersCollection = this.db.collection('users');
        
        // Default images
        this.defaultHeroImage = 'images/default-hero.jpg';
        this.defaultCardImage = 'images/news-placeholder.jpg';
        this.defaultAvatar = 'images/default-avatar.png';
        this.gamerAvatar = 'images/gamer-avatar.png'; // Professional gaming placeholder
        
        this.init();
    }

    async init() {
        try {
            // Initialize UI first
            this.initCategoryFilters();
            this.initEventListeners();
            
            // Load news data with real-time updates
            this.loadNews();
            
            // Load additional data
            await this.loadTrendingPlayers();
            this.loadSeasonArchives();
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize news feed. Please refresh the page.');
        }
    }

    loadNews() {
        try {
            this.isLoading = true;
            this.updateLoadMoreButton();
            
            // Show loading state
            this.showLoading();
            
            // AUTO-REFRESH: Use onSnapshot for real-time updates
            this.newsUnsubscribe = this.newsCollection
                .orderBy('createdAt', 'desc')
                .onSnapshot(
                    (querySnapshot) => {
                        this.handleNewsSnapshot(querySnapshot);
                    },
                    (error) => {
                        console.error('News snapshot error:', error);
                        this.isLoading = false;
                        this.showError('Failed to load news. Please check your connection.');
                        this.updateLoadMoreButton();
                    }
                );
            
        } catch (error) {
            console.error('Error setting up news listener:', error);
            this.isLoading = false;
            this.showError('Failed to connect to news server.');
            this.updateLoadMoreButton();
        }
    }

    handleNewsSnapshot(querySnapshot) {
        this.news = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.createdAt?.toDate() || new Date();
            
            this.news.push({
                id: doc.id,
                title: data.title || 'Untitled Article',
                content: data.content || '',
                excerpt: data.excerpt || data.content?.substring(0, 150) + '...' || '',
                category: data.category || 'news',
                imageUrl: data.imageUrl || data.image || 'images/news-placeholder.jpg',
                timestamp: dateObj,
                author: data.author || 'UON GRiD Team',
                views: data.views || 0,
                likes: data.likes || 0,
                comments: data.comments || 0,
                readTime: this.calculateReadTime(data.content || '')
            });
        });

        this.filteredNews = [...this.news];
        this.isLoading = false;
        
        // Render content
        this.renderFeaturedNews();
        this.renderNewsGrid();
        this.updateLoadMoreButton();
        
        // Update season archives with new data
        this.loadSeasonArchives();
        
        // Show empty state if no news
        if (this.news.length === 0) {
            this.showEmptyState();
        }
    }

    initCategoryFilters() {
        const filtersContainer = document.getElementById('category-filters');
        if (!filtersContainer) return;

        filtersContainer.innerHTML = this.categories.map(category => `
            <button class="filter-btn ${category.id === 'all' ? 'active' : ''}" 
                    data-category="${category.id}">
                ${category.name}
            </button>
        `).join('');
    }

    initEventListeners() {
        // Category filter buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                const category = e.target.dataset.category;
                this.filterByCategory(category);
                
                // Update active state
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                
                // Scroll filters container if needed
                e.target.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        });

        // Load more button
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreNews());
        }

        // Refresh button (in error/empty states)
        document.addEventListener('click', (e) => {
            if (e.target.matches('#refresh-news') || e.target.closest('#refresh-news')) {
                this.loadNews();
            }
        });

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.id === 'news-modal') {
                this.closeModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    renderFeaturedNews() {
        if (this.news.length === 0) return;

        const featuredNews = this.news[0];
        const elements = {
            badge: document.getElementById('featured-badge'),
            title: document.getElementById('featured-title'),
            excerpt: document.getElementById('featured-excerpt'),
            date: document.getElementById('featured-date'),
            author: document.getElementById('featured-author'),
            link: document.getElementById('featured-link'),
            image: document.getElementById('featured-image'),
            meta: document.getElementById('featured-meta')
        };

        // Update elements if they exist
        if (elements.badge) {
            elements.badge.textContent = this.formatCategory(featuredNews.category);
            elements.badge.className = `featured-badge badge-${featuredNews.category}`;
        }

        if (elements.title) {
            elements.title.textContent = featuredNews.title;
        }

        if (elements.excerpt) {
            elements.excerpt.textContent = featuredNews.excerpt;
        }

        if (elements.date) {
            elements.date.textContent = this.formatDate(featuredNews.timestamp);
        }

        if (elements.author) {
            elements.author.textContent = `By ${featuredNews.author}`;
        }

        // MODAL LOGIC: Open modal instead of navigation
        if (elements.link) {
            elements.link.href = 'javascript:void(0)';
            elements.link.onclick = () => this.openModal(featuredNews.id);
            elements.link.textContent = 'Read Full Story →';
            elements.link.title = `Read: ${featuredNews.title}`;
        }

        // Update image with fallback
        if (elements.image) {
            const imageUrl = featuredNews.imageUrl || this.defaultHeroImage;
            elements.image.src = imageUrl;
            elements.image.alt = featuredNews.title;
            elements.image.onerror = () => {
                elements.image.src = this.defaultHeroImage;
                elements.image.style.display = 'block';
            };
        }

        // Show meta section
        if (elements.meta) {
            elements.meta.style.display = 'flex';
        }
    }

    renderNewsGrid() {
        const container = document.getElementById('news-feed-container');
        if (!container) {
            console.error('news-feed-container not found!');
            return;
        }

        // Clear container
        container.innerHTML = '';

        if (this.filteredNews.length === 0) {
            this.showEmptyState();
            return;
        }

        const startIndex = (this.currentPage - 1) * this.newsPerPage;
        const endIndex = startIndex + this.newsPerPage;
        const pageNews = this.filteredNews.slice(startIndex, endIndex);

        // Create news cards
        pageNews.forEach(news => {
            const newsCard = this.createCard(news);
            container.appendChild(newsCard);
        });

        // Update load more button
        this.updateLoadMoreButton();
    }

    createCard(news) {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.dataset.category = news.category;
        
        const categoryClass = `badge-${news.category}`;
        const formattedDate = this.formatDate(news.timestamp);
        
        // Determine image source with fallback
        const imageUrl = news.imageUrl || this.defaultCardImage;
        const imageAlt = news.title;
        
        // Support Base64, HTTP, and local images
        const imageHtml = (imageUrl.startsWith('http') || 
                          imageUrl.startsWith('data:') || 
                          imageUrl.includes('/images/')) ? 
            `<img src="${imageUrl}" alt="${imageAlt}" loading="lazy" 
                  onerror="this.onerror=null; this.src='${this.defaultCardImage}';">` : 
            `<div class="image-placeholder">📰</div>`;
        
        card.innerHTML = `
            <div class="card-image">
                <div class="card-image-content">
                    ${imageHtml}
                    <div class="category-badge ${categoryClass}">${this.formatCategory(news.category)}</div>
                </div>
            </div>
            <div class="card-content">
                <div class="card-meta">
                    <span class="card-date">${formattedDate}</span>
                    <span class="card-read-time">${news.readTime}</span>
                </div>
                <h3 class="card-title">${news.title}</h3>
                <p class="card-excerpt">${news.excerpt}</p>
                <div class="card-footer">
                    <div class="card-stats">
                        <span class="stat">👁️ ${this.formatViews(news.views)}</span>
                        <span class="stat">💬 ${news.comments}</span>
                        <span class="stat">❤️ ${news.likes}</span>
                    </div>
                    <!-- MODAL LOGIC: Open modal instead of navigation -->
                    <a href="javascript:void(0)" class="card-link" onclick="window.newsManager.openModal('${news.id}')">Read More →</a>
                </div>
            </div>
        `;

        // Add click event to the entire card
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-link')) {
                this.openModal(news.id);
            }
        });

        return card;
    }

    async loadTrendingPlayers() {
        try {
            const container = document.getElementById('trending-list');
            if (!container) return;

            // UPGRADE: Changed from limit(5) to limit(10) for Top 10 players
            const querySnapshot = await this.usersCollection
                .orderBy('winRate', 'desc')
                .limit(10)
                .get();

            if (querySnapshot.empty) {
                container.innerHTML = `
                    <div class="empty-state-mini">
                        <p>No players ranked yet. Be the first!</p>
                    </div>
                `;
                return;
            }

            const players = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                // UPGRADE: Use professional gaming placeholder for missing avatars
                const avatarUrl = data.avatarURL || data.avatarUrl || data.avatar || this.gamerAvatar;
                const wins = data.wins || 0;
                const losses = data.losses || 0;
                const draws = data.draws || 0;
                const totalMatches = wins + losses + draws;
                const winRate = data.winRate || (totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0);
                
                players.push({
                    id: doc.id,
                    gamerTag: data.gamerTag || data.name || 'Anonymous Player',
                    avatar: avatarUrl,
                    winRate: winRate,
                    wins: wins,
                    losses: losses,
                    draws: draws,
                    totalMatches: totalMatches,
                    faculty: data.faculty || data.campus || 'UON Student'
                });
            });

            // UPGRADE: 2-column grid layout with professional design
            container.innerHTML = `
                <div class="top-players-grid">
                    ${players.map((player, index) => {
                        const medal = index === 0 ? '🥇' : 
                                    index === 1 ? '🥈' : 
                                    index === 2 ? '🥉' : '';
                        const isTopThree = index < 3;
                        
                        return `
                            <div class="player-card ${isTopThree ? 'top-three' : ''}">
                                <div class="player-header">
                                    <div class="player-rank">
                                        <span class="rank-number">#${index + 1}</span>
                                        ${medal ? `<span class="medal-icon">${medal}</span>` : ''}
                                    </div>
                                    <!-- UPGRADE: Larger circular profile picture -->
                                    <div class="player-avatar-large">
                                        <img src="${player.avatar}" alt="${player.gamerTag}" 
                                             class="player-avatar-img"
                                             onerror="this.src='${this.gamerAvatar}'; this.onerror=null;">
                                    </div>
                                </div>
                                <div class="player-info">
                                    <h4 class="player-gamertag">${player.gamerTag}</h4>
                                    <div class="player-stats">
                                        <div class="stat-item">
                                            <span class="stat-label">Win Rate</span>
                                            <span class="stat-value ${player.winRate >= 70 ? 'excellent' : player.winRate >= 50 ? 'good' : 'average'}">
                                                ${player.winRate}%
                                            </span>
                                        </div>
                                        <div class="stat-row">
                                            <div class="stat-item">
                                                <span class="stat-label">W</span>
                                                <span class="stat-value">${player.wins}</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-label">L</span>
                                                <span class="stat-value">${player.losses}</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-label">D</span>
                                                <span class="stat-value">${player.draws}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

        } catch (error) {
            console.error('Error loading trending players:', error);
            const container = document.getElementById('trending-list');
            if (container) {
                container.innerHTML = `
                    <div class="error-state-mini">
                        <p>Player rankings loading...</p>
                        <small>Check back soon for updated stats</small>
                    </div>
                `;
            }
        }
    }

    loadSeasonArchives() {
        const container = document.getElementById('archive-list');
        if (!container) return;

        // ARCHIVE COUNT: Handle empty state
        if (this.news.length === 0) {
            container.innerHTML = `
                <div class="archive-empty">
                    <p>No posts yet</p>
                </div>
            `;
            return;
        }

        // Group news by season/year
        const archives = {};
        this.news.forEach(item => {
            const year = item.timestamp.getFullYear();
            const season = `Season ${year - 2022}`;
            
            if (!archives[season]) {
                archives[season] = 0;
            }
            archives[season]++;
        });

        // ARCHIVE COUNT: Show only if we have posts
        if (Object.keys(archives).length === 0) {
            container.innerHTML = `
                <div class="archive-empty">
                    <p>No posts yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = Object.entries(archives).map(([season, count]) => `
            <div class="archive-item" onclick="window.location.href='?season=${season}'">
                <span class="archive-season">${season}</span>
                <span class="archive-count">${count} posts</span>
            </div>
        `).join('');
    }

    // MODAL LOGIC: Open modal with news details
    openModal(newsId) {
        let newsItem;
        
        if (newsId === null || newsId === undefined) {
            // Featured article
            newsItem = this.news[0];
        } else {
            // Find news by ID
            newsItem = this.news.find(item => item.id === newsId);
        }
        
        if (!newsItem) {
            console.error('News item not found:', newsId);
            return;
        }

        // Update modal content
        document.getElementById('modal-title').textContent = newsItem.title;
        document.getElementById('modal-author').textContent = newsItem.author;
        document.getElementById('modal-date').textContent = this.formatDate(newsItem.timestamp);
        
        // Set category badge
        const categoryBadge = document.getElementById('modal-category');
        categoryBadge.textContent = this.formatCategory(newsItem.category);
        categoryBadge.className = `category-badge badge-${newsItem.category}`;
        
        // Set image
        const modalImage = document.getElementById('modal-image');
        modalImage.src = newsItem.imageUrl || this.defaultCardImage;
        modalImage.alt = newsItem.title;
        modalImage.onerror = () => {
            modalImage.src = this.defaultCardImage;
        };
        
        // Set content
        const contentElement = document.getElementById('modal-full-content');
        contentElement.innerHTML = newsItem.content || newsItem.excerpt || 'No content available.';
        
        // Show modal
        document.getElementById('news-modal').style.display = 'flex';
        
        // Track view
        this.trackNewsView(newsItem.id);
    }

    // MODAL LOGIC: Close modal
    closeModal() {
        document.getElementById('news-modal').style.display = 'none';
    }

    trackNewsView(newsId) {
        // Optional: Track news views
        try {
            this.newsCollection.doc(newsId).update({
                views: firebase.firestore.FieldValue.increment(1)
            });
        } catch (error) {
            console.error('Error tracking view:', error);
        }
    }

    filterByCategory(category) {
        this.currentCategory = category;
        this.currentPage = 1;

        if (category === 'all') {
            // FIXED 'ALL NEWS': Show ALL items without filtering
            this.filteredNews = [...this.news];
        } else {
            // FIXED CATEGORY FILTERING: Use includes instead of exact match
            this.filteredNews = this.news.filter(news => {
                const newsCategory = news.category?.toLowerCase() || '';
                const filterCategory = category.toLowerCase();
                return newsCategory.includes(filterCategory);
            });
        }

        this.renderNewsGrid();
    }

    async loadMoreNews() {
        if (this.isLoading || !this.hasMore) return;

        const button = document.getElementById('load-more-btn');
        if (!button) return;

        this.isLoading = true;
        this.updateLoadMoreButton();

        try {
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 800));
            
            this.currentPage++;
            
            // Check if we have more data to show
            const totalFiltered = this.filteredNews.length;
            const totalPages = Math.ceil(totalFiltered / this.newsPerPage);
            
            if (this.currentPage > totalPages) {
                this.hasMore = false;
                this.updateLoadMoreButton();
            } else {
                // Append more cards
                const container = document.getElementById('news-feed-container');
                if (!container) return;

                const startIndex = (this.currentPage - 1) * this.newsPerPage;
                const endIndex = startIndex + this.newsPerPage;
                const pageNews = this.filteredNews.slice(startIndex, endIndex);

                pageNews.forEach(news => {
                    const newsCard = this.createCard(news);
                    container.appendChild(newsCard);
                });

                // Smooth scroll to show new cards
                const lastCard = container.lastElementChild;
                if (lastCard) {
                    lastCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
            
        } catch (error) {
            console.error('Error loading more news:', error);
            this.showNotification('Failed to load more news', 'error');
        } finally {
            this.isLoading = false;
            this.updateLoadMoreButton();
        }
    }

    updateLoadMoreButton() {
        const button = document.getElementById('load-more-btn');
        if (!button) return;

        // Hide button during loading or errors
        if (this.isLoading || this.news.length === 0) {
            button.style.display = 'none';
            return;
        }

        const totalFiltered = this.filteredNews.length;
        const totalPages = Math.ceil(totalFiltered / this.newsPerPage);
        
        if (this.currentPage >= totalPages || totalFiltered === 0) {
            button.style.display = 'none';
        } else {
            button.style.display = 'block';
            button.disabled = this.isLoading;
            button.innerHTML = this.isLoading ? 
                '<span class="loading-spinner-small"></span> Loading...' : 
                'Load More Posts';
        }
    }

    showLoading() {
        const container = document.getElementById('news-feed-container');
        if (!container) return;

        container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <h3>Loading Latest Updates</h3>
                <p>Fetching the newest content from UON GRiD...</p>
            </div>
        `;
    }

    showEmptyState() {
        const container = document.getElementById('news-feed-container');
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📰</div>
                <h3>More Updates Coming Soon!</h3>
                <p>We're preparing exciting news, tournament updates, and community highlights. Check back later or join our community for real-time updates.</p>
                <button class="btn btn-primary" id="refresh-news">
                    <span class="btn-icon">🔄</span> Refresh Feed
                </button>
            </div>
        `;
    }

    showError(message) {
        const container = document.getElementById('news-feed-container');
        if (!container) return;

        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">🔧</div>
                <h3>Configuration Error</h3>
                <p>Unable to connect to the news server. Please check your connection and try again.</p>
                <button onclick="window.location.reload()" class="btn btn-primary">
                    Retry Connection
                </button>
            </div>
        `;
        
        // Also hide the load more button
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(notification => {
            notification.remove();
        });

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
    }

    // Helper Methods
    calculateReadTime(content) {
        if (!content) return '1 min read';
        const wordsPerMinute = 200;
        const wordCount = content.split(/\s+/).length;
        const readTime = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
        return `${readTime} min read`;
    }

    formatDate(date) {
        if (!date) return 'Recently';
        
        const now = new Date();
        const newsDate = new Date(date);
        const diffInDays = Math.floor((now - newsDate) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
        
        return newsDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }

    formatCategory(category) {
        const categoryMap = {
            'tournament': 'Tournament',
            'matchday': 'Matchday',
            'spotlight': 'Player Spotlight',
            'transfers': 'Transfers',
            'update': 'Update',
            'community': 'Community',
            'event': 'Event',
            'archive': 'Archive',
            'news': 'News'
        };
        
        return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    formatViews(views) {
        if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
        if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
        return views;
    }

    // Cleanup
    cleanup() {
        if (this.newsUnsubscribe) {
            this.newsUnsubscribe();
        }
    }
}

// Initialize when DOM is ready and Firebase is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if Firebase is initialized
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        window.newsManager = new NewsManager();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (window.newsManager && window.newsManager.cleanup) {
                window.newsManager.cleanup();
            }
        });
    } else {
        console.error('Firebase is not initialized. Please check firebase-config.js');
        
        // Show error state
        const container = document.getElementById('news-feed-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">🔧</div>
                    <h3>Configuration Error</h3>
                    <p>Unable to connect to the news server. Please check your connection and try again.</p>
                    <button onclick="window.location.reload()" class="btn btn-primary">
                        Retry Connection
                    </button>
                </div>
            `;
        }
    }
});