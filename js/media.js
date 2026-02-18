// Media gallery functionality

class MediaGallery {
    constructor() {
        this.currentTab = 'photos';
        this.photoPage = 1;
        this.videoPage = 1;
        this.highlightPage = 1;
        this.photos = [];
        this.videos = [];
        this.highlights = [];
        
        this.init();
    }

    init() {
        this.loadSampleData();
        this.initTabSwitching();
        this.initFilters();
        this.initLightbox();
        this.renderCurrentTab();
    }

    loadSampleData() {
        // Sample photo data
        this.photos = [
            {
                id: 1,
                src: 'images/gallery/photo1.jpg',
                thumbnail: 'images/gallery/thumbnails/photo1-thumb.jpg',
                title: 'Championship Finals 2025',
                category: 'tournament',
                date: '2025-03-01',
                description: 'The intense final match between top players'
            },
            {
                id: 2,
                src: 'images/gallery/photo2.jpg',
                thumbnail: 'images/gallery/thumbnails/photo2-thumb.jpg',
                title: 'Player Celebration',
                category: 'players',
                date: '2025-02-28',
                description: 'Moment of victory for the tournament winner'
            },
            // Add more sample photos...
        ];

        // Sample video data
        this.videos = [
            {
                id: 1,
                youtubeId: 'dQw4w9WgXcQ',
                title: 'Grand Finals - UON Championship 2025',
                category: 'matches',
                duration: '15:30',
                views: '2.4K',
                date: '2025-03-01'
            },
            {
                id: 2,
                youtubeId: 'dQw4w9WgXcQ',
                title: 'Player Interview: Champion Profile',
                category: 'interviews',
                duration: '8:45',
                views: '1.2K',
                date: '2025-02-28'
            },
            // Add more sample videos...
        ];

        // Sample highlights data
        this.highlights = [
            {
                id: 1,
                youtubeId: 'dQw4w9WgXcQ',
                title: 'Incredible Comeback - Semi Finals',
                tournament: 'championship-2025',
                duration: '2:15',
                players: ['Player A', 'Player B'],
                date: '2025-02-25'
            },
            // Add more sample highlights...
        ];
    }

    initTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Hide all tab content
                document.querySelectorAll('.media-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Show selected tab content
                document.getElementById(tabId).classList.add('active');
                
                // Update current tab and render content
                this.currentTab = tabId;
                this.renderCurrentTab();
            });
        });
    }

    initFilters() {
        // Photo category filter
        const photoFilter = document.getElementById('photo-category');
        if (photoFilter) {
            photoFilter.addEventListener('change', () => {
                this.renderPhotos();
            });
        }

        // Video category filter
        const videoFilter = document.getElementById('video-category');
        if (videoFilter) {
            videoFilter.addEventListener('change', () => {
                this.renderVideos();
            });
        }

        // Highlight tournament filter
        const highlightFilter = document.getElementById('highlight-tournament');
        if (highlightFilter) {
            highlightFilter.addEventListener('change', () => {
                this.renderHighlights();
            });
        }

        // Load more buttons
        document.getElementById('load-more-photos')?.addEventListener('click', () => this.loadMorePhotos());
        document.getElementById('load-more-videos')?.addEventListener('click', () => this.loadMoreVideos());
        document.getElementById('load-more-highlights')?.addEventListener('click', () => this.loadMoreHighlights());
    }

    initLightbox() {
        // Lightbox is initialized automatically by the library
        // We just need to ensure proper configuration
        lightbox.option({
            'resizeDuration': 200,
            'wrapAround': true,
            'imageFadeDuration': 300,
            'positionFromTop': 100,
            'showImageNumberLabel': true,
            'alwaysShowNavOnTouchDevices': true
        });
    }

    renderCurrentTab() {
        switch (this.currentTab) {
            case 'photos':
                this.renderPhotos();
                break;
            case 'videos':
                this.renderVideos();
                break;
            case 'highlights':
                this.renderHighlights();
                break;
        }
    }

    renderPhotos() {
        const grid = document.getElementById('photo-grid');
        const category = document.getElementById('photo-category')?.value || 'all';
        
        const filteredPhotos = category === 'all' 
            ? this.photos 
            : this.photos.filter(photo => photo.category === category);

        grid.innerHTML = filteredPhotos.map(photo => `
            <div class="photo-item" data-category="${photo.category}">
                <a href="${photo.src}" data-lightbox="photos" data-title="${photo.title} - ${photo.description}">
                    <img src="${photo.thumbnail || photo.src}" alt="${photo.title}" loading="lazy" class="photo-image">
                    <div class="photo-overlay">
                        <div class="photo-info">
                            <h3 class="photo-title">${photo.title}</h3>
                            <p class="photo-date">${this.formatDate(photo.date)}</p>
                        </div>
                    </div>
                </a>
            </div>
        `).join('');

        // Add loading animation for images
        this.lazyLoadImages();
    }

    renderVideos() {
        const grid = document.getElementById('video-grid');
        const category = document.getElementById('video-category')?.value || 'all';
        
        const filteredVideos = category === 'all' 
            ? this.videos 
            : this.videos.filter(video => video.category === category);

        grid.innerHTML = filteredVideos.map(video => `
            <div class="video-item" data-category="${video.category}">
                <div class="video-thumbnail">
                    <img src="https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg" alt="${video.title}" loading="lazy" class="video-image">
                    <div class="video-play-btn">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                    <div class="video-duration">${video.duration}</div>
                </div>
                <div class="video-info">
                    <h3 class="video-title">${video.title}</h3>
                    <div class="video-meta">
                        <span class="video-views">${video.views} views</span>
                        <span class="video-date">${this.formatDate(video.date)}</span>
                    </div>
                </div>
                <button class="video-play" data-youtube-id="${video.youtubeId}">Watch Video</button>
            </div>
        `).join('');

        // Add click events to video play buttons
        grid.querySelectorAll('.video-play').forEach(button => {
            button.addEventListener('click', () => {
                const youtubeId = button.getAttribute('data-youtube-id');
                this.playVideo(youtubeId, button.closest('.video-item').querySelector('.video-title').textContent);
            });
        });

        this.lazyLoadImages();
    }

    renderHighlights() {
        const grid = document.getElementById('highlights-grid');
        const tournament = document.getElementById('highlight-tournament')?.value || 'all';
        
        const filteredHighlights = tournament === 'all' 
            ? this.highlights 
            : this.highlights.filter(highlight => highlight.tournament === tournament);

        grid.innerHTML = filteredHighlights.map(highlight => `
            <div class="highlight-item" data-tournament="${highlight.tournament}">
                <div class="highlight-thumbnail">
                    <img src="https://img.youtube.com/vi/${highlight.youtubeId}/hqdefault.jpg" alt="${highlight.title}" loading="lazy" class="highlight-image">
                    <div class="highlight-play-btn">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                    <div class="highlight-duration">${highlight.duration}</div>
                </div>
                <div class="highlight-info">
                    <h3 class="highlight-title">${highlight.title}</h3>
                    <div class="highlight-meta">
                        <span class="highlight-players">${highlight.players.join(' vs ')}</span>
                        <span class="highlight-date">${this.formatDate(highlight.date)}</span>
                    </div>
                </div>
                <button class="highlight-play" data-youtube-id="${highlight.youtubeId}">Watch Highlight</button>
            </div>
        `).join('');

        // Add click events to highlight play buttons
        grid.querySelectorAll('.highlight-play').forEach(button => {
            button.addEventListener('click', () => {
                const youtubeId = button.getAttribute('data-youtube-id');
                this.playVideo(youtubeId, button.closest('.highlight-item').querySelector('.highlight-title').textContent);
            });
        });

        this.lazyLoadImages();
    }

    playVideo(youtubeId, title) {
        // Create video modal
        const modal = document.createElement('div');
        modal.className = 'video-modal';
        modal.innerHTML = `
            <div class="video-modal-content">
                <div class="video-modal-header">
                    <h3>${title}</h3>
                    <button class="video-modal-close">&times;</button>
                </div>
                <div class="video-modal-body">
                    <iframe 
                        width="100%" 
                        height="400" 
                        src="https://www.youtube.com/embed/${youtubeId}?autoplay=1" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Close modal functionality
        const closeBtn = modal.querySelector('.video-modal-close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            document.body.style.overflow = 'auto';
        });

        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                document.body.style.overflow = 'auto';
            }
        });
    }

    lazyLoadImages() {
        const images = document.querySelectorAll('img[loading="lazy"]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.src;
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    loadMorePhotos() {
        // Simulate loading more photos
        const button = document.getElementById('load-more-photos');
        button.innerHTML = '<span class="loading-spinner"></span> Loading...';
        button.disabled = true;

        setTimeout(() => {
            // In a real app, this would fetch from an API
            this.photoPage++;
            this.renderPhotos();
            
            button.textContent = 'Load More Photos';
            button.disabled = false;

            // Show notification
            this.showNotification('More photos loaded!', 'success');
        }, 1500);
    }

    loadMoreVideos() {
        const button = document.getElementById('load-more-videos');
        button.innerHTML = '<span class="loading-spinner"></span> Loading...';
        button.disabled = true;

        setTimeout(() => {
            this.videoPage++;
            this.renderVideos();
            
            button.textContent = 'Load More Videos';
            button.disabled = false;
            this.showNotification('More videos loaded!', 'success');
        }, 1500);
    }

    loadMoreHighlights() {
        const button = document.getElementById('load-more-highlights');
        button.innerHTML = '<span class="loading-spinner"></span> Loading...';
        button.disabled = true;

        setTimeout(() => {
            this.highlightPage++;
            this.renderHighlights();
            
            button.textContent = 'Load More Highlights';
            button.disabled = false;
            this.showNotification('More highlights loaded!', 'success');
        }, 1500);
    }

    formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);

        notification.querySelector('.notification-close').addEventListener('click', function() {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }
}

// Initialize media gallery when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaGallery = new MediaGallery();
});