// Advanced animations and micro-interactions for UON Efootball Hub

class AnimationsManager {
    constructor() {
        this.init();
    }

    init() {
        this.initScrollAnimations();
        this.initHoverEffects();
        this.initCounterAnimations();
        console.log('Animations manager initialized');
    }

    // Scroll animations using Intersection Observer
    initScrollAnimations() {
        const animationObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateOnScroll(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        // Elements to animate on scroll
        const animatedElements = document.querySelectorAll(
            '.widget-card, .player-card, .section-title, .milestone-item, .stat-item'
        );

        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            animationObserver.observe(el);
        });
    }

    animateOnScroll(element) {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        
        // Add staggered animation for child elements
        const children = element.querySelectorAll('.stat, .achievement, .footer-links li');
        children.forEach((child, index) => {
            child.style.opacity = '0';
            child.style.transform = 'translateX(-20px)';
            child.style.transition = `opacity 0.4s ease ${index * 0.1}s, transform 0.4s ease ${index * 0.1}s`;
            
            setTimeout(() => {
                child.style.opacity = '1';
                child.style.transform = 'translateX(0)';
            }, 100);
        });
    }

    // Hover effects with subtle animations
    initHoverEffects() {
        // Button hover effects
        const buttons = document.querySelectorAll('.btn, .nav-link, .social-link');
        
        buttons.forEach(button => {
            button.addEventListener('mouseenter', (e) => {
                this.createHoverEffect(e);
            });
            
            button.addEventListener('mouseleave', (e) => {
                this.removeHoverEffect(e);
            });
        });

        // Card hover effects
        const cards = document.querySelectorAll('.widget-card, .player-card, .milestone-item');
        
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                this.tiltCard(card, 5);
            });
            
            card.addEventListener('mouseleave', () => {
                this.tiltCard(card, 0);
            });
        });
    }

    createHoverEffect(event) {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        
        // Create ripple effect
        const ripple = document.createElement('span');
        ripple.className = 'hover-ripple';
        ripple.style.width = ripple.style.height = Math.max(rect.width, rect.height) + 'px';
        ripple.style.left = event.clientX - rect.left - Math.max(rect.width, rect.height) / 2 + 'px';
        ripple.style.top = event.clientY - rect.top - Math.max(rect.width, rect.height) / 2 + 'px';
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
            if (ripple.parentNode === button) {
                button.removeChild(ripple);
            }
        }, 600);
    }

    removeHoverEffect(event) {
        const button = event.currentTarget;
        const ripples = button.querySelectorAll('.hover-ripple');
        ripples.forEach(ripple => {
            ripple.style.opacity = '0';
            setTimeout(() => {
                if (ripple.parentNode === button) {
                    button.removeChild(ripple);
                }
            }, 300);
        });
    }

    tiltCard(card, degrees) {
        card.style.transform = `perspective(1000px) rotateX(${degrees}deg) rotateY(${degrees}deg)`;
        card.style.transition = 'transform 0.3s ease';
    }

    // Counter animations for stats
    initCounterAnimations() {
        const counters = document.querySelectorAll('.stat-number');
        
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => {
            if (counter.textContent.includes('+')) {
                counterObserver.observe(counter);
            }
        });
    }

    animateCounter(counter) {
        const target = parseInt(counter.getAttribute('data-target') || counter.textContent.replace('+', ''));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            counter.textContent = Math.floor(current) + '+';
        }, 16);
    }
}

// Add CSS for animations
const animationStyles = `
.hover-ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(0, 255, 136, 0.3);
    transform: scale(0);
    animation: ripple 0.6s linear;
    pointer-events: none;
}

@keyframes ripple {
    to {
        transform: scale(2);
        opacity: 0;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
    
    .hover-ripple {
        display: none !important;
    }
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = animationStyles;
document.head.appendChild(styleSheet);

// Initialize animations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.animationsManager = new AnimationsManager();
});