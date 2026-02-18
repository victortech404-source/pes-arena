// Google Analytics 4 Integration
class AnalyticsManager {
    constructor() {
        this.measurementId = 'G-XXXXXXXXXX'; // Replace with your GA4 Measurement ID
        this.init();
    }

    init() {
        this.loadGoogleAnalytics();
        this.trackPageViews();
        this.trackUserInteractions();
    }

    loadGoogleAnalytics() {
        // Load gtag.js
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', this.measurementId);
    }

    trackPageViews() {
        // Track page views
        gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href,
            page_path: window.location.pathname
        });
    }

    trackUserInteractions() {
        // Track button clicks
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button, .btn, a');
            if (button) {
                this.trackEvent('button_click', {
                    button_text: button.textContent.trim(),
                    button_id: button.id || 'no_id',
                    page_location: window.location.pathname
                });
            }
        });

        // Track form submissions
        document.addEventListener('submit', (e) => {
            this.trackEvent('form_submit', {
                form_id: e.target.id || 'no_id',
                form_name: e.target.getAttribute('name') || 'no_name',
                page_location: window.location.pathname
            });
        });

        // Track external links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="http"]');
            if (link && !link.href.includes(window.location.hostname)) {
                this.trackEvent('external_link_click', {
                    link_url: link.href,
                    link_text: link.textContent.trim(),
                    page_location: window.location.pathname
                });
            }
        });
    }

    trackEvent(eventName, parameters) {
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, parameters);
        }
    }

    // Custom event tracking methods
    trackTournamentView(tournamentName) {
        this.trackEvent('tournament_view', {
            tournament_name: tournamentName,
            page_location: window.location.pathname
        });
    }

    trackPlayerProfileView(playerName) {
        this.trackEvent('player_profile_view', {
            player_name: playerName,
            page_location: window.location.pathname
        });
    }

    trackRegistrationStart() {
        this.trackEvent('registration_start', {
            page_location: window.location.pathname
        });
    }

    trackRegistrationComplete() {
        this.trackEvent('registration_complete', {
            page_location: window.location.pathname
        });
    }
}

// Initialize analytics
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsManager = new AnalyticsManager();
});