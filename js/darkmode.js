// Dark Mode Toggle functionality

class DarkModeToggle {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.init();
    }

    init() {
        // Create toggle button if it doesn't exist
        this.createToggleButton();
        this.setTheme(this.currentTheme);
        this.addStyles();
    }

    createToggleButton() {
        // First check if there's already a toggle button in the DOM
        const existingToggle = document.getElementById('darkModeToggle');
        const navActions = document.querySelector('.nav-actions') || this.createNavActions();
        
        if (existingToggle) {
            // Use existing toggle button
            this.toggleBtn = existingToggle;
            existingToggle.addEventListener('click', () => this.toggleTheme());
        } else {
            // Create new toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'dark-mode-toggle';
            toggleBtn.id = 'darkModeToggle';
            toggleBtn.innerHTML = '<span class="toggle-icon">🌙</span>';
            toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
            toggleBtn.addEventListener('click', () => this.toggleTheme());
            
            navActions.appendChild(toggleBtn);
            this.toggleBtn = toggleBtn;
        }
        
        this.updateToggleIcon();
    }

    createNavActions() {
        const navContainer = document.querySelector('.nav-container');
        const navActions = document.createElement('div');
        navActions.className = 'nav-actions';
        navContainer.appendChild(navActions);
        return navActions;
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.currentTheme = theme;
        this.updateToggleIcon();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        
        // Add animation
        if (this.toggleBtn) {
            this.toggleBtn.classList.add('theme-changing');
            setTimeout(() => {
                this.toggleBtn.classList.remove('theme-changing');
            }, 300);
        }
    }

    updateToggleIcon() {
        let icon;
        if (this.toggleBtn) {
            icon = this.toggleBtn.querySelector('.toggle-icon');
        } else {
            icon = document.querySelector('.toggle-icon');
        }
        
        if (icon) {
            icon.textContent = this.currentTheme === 'dark' ? '🌙' : '☀️';
        }
    }

    addStyles() {
        // Only add styles if they haven't been added already
        if (document.querySelector('#dark-mode-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'dark-mode-styles';
        style.textContent = `
            .nav-actions {
                display: flex;
                align-items: center;
                gap: var(--space-4);
            }
            
            .dark-mode-toggle {
                background: none;
                border: none;
                color: var(--text-primary);
                cursor: pointer;
                padding: var(--space-2);
                border-radius: var(--radius-md);
                transition: var(--transition-fast);
                font-size: var(--text-xl);
            }
            
            .dark-mode-toggle:hover {
                color: var(--primary-green);
                transform: rotate(15deg);
            }
            
            .theme-changing {
                animation: themeChange 0.3s ease-in-out;
            }
            
            @keyframes themeChange {
                0% { transform: scale(1); }
                50% { transform: scale(1.1) rotate(180deg); }
                100% { transform: scale(1) rotate(360deg); }
            }

            /* Smooth theme transition */
            * {
                transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize dark mode toggle when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DarkModeToggle();
});