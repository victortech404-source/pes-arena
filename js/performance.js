// Performance optimization and monitoring
class PerformanceManager {
    constructor() {
        this.init();
    }

    init() {
        this.lazyLoadImages();
        this.optimizeAnimations();
        this.monitorPerformance();
        this.preloadCriticalResources();
    }

    lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.getAttribute('data-src');
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    optimizeAnimations() {
        // Use will-change for elements that will animate
        const animatedElements = document.querySelectorAll('.btn, .nav-link, .widget-card');
        animatedElements.forEach(el => {
            el.style.willChange = 'transform, opacity';
        });
    }

    monitorPerformance() {
        // Monitor Core Web Vitals
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    console.log(`${entry.name}: ${entry.value}`);
                    
                    // Send to analytics
                    if (window.analyticsManager) {
                        window.analyticsManager.trackEvent('web_vital', {
                            vital_name: entry.name,
                            vital_value: Math.round(entry.value),
                            page_location: window.location.pathname
                        });
                    }
                }
            });

            observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'cumulative-layout-shift'] });
        }

        // Monitor load time
        window.addEventListener('load', () => {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            console.log(`Page load time: ${loadTime}ms`);
        });
    }

    preloadCriticalResources() {
        // Preload critical resources
        const criticalResources = [
            '/css/style.css',
            '/css/variables.css',
            'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Poppins:wght@300;400;500;600;700&display=swap'
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            link.as = resource.includes('.css') ? 'style' : 'font';
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    }

    // Cache management
    clearOldCaches() {
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                    if (cacheName !== 'uon-efootball-v1.0.0') {
                        caches.delete(cacheName);
                    }
                });
            });
        }
    }
}

// Initialize performance manager
document.addEventListener('DOMContentLoaded', () => {
    window.performanceManager = new PerformanceManager();
});