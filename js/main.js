// UON HUB/js/main.js
// Main Application Logic - Runs on every page

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    initNavigation();
    initAnimations();
    setupGlobalAuthListener(); // Global Auth Check
    setupRoleBasedNavigation(); // NEW: Setup role-based navigation clicks
}

// --- 1. Global Authentication & UI Sync ---
function setupGlobalAuthListener() {
    // Wait for Firebase to load
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.warn('Firebase Auth not ready yet.');
        return;
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('Global Auth: User is signed in:', user.email);
            updateUIForLoggedInUser(user);
        } else {
            console.log('Global Auth: User is signed out');
            updateUIForLoggedOutUser();
        }
    });
}

function updateUIForLoggedInUser(user) {
    // 1. Hide "Join Hub" Button (ID: nav-join-hub)
    const joinHubBtn = document.getElementById('nav-join-hub');
    if (joinHubBtn) joinHubBtn.style.display = 'none';

    // 2. Update "My Profile" to show it's active or add a Logout button next to it
    // We'll look for the nav-actions container to append a Logout button if it doesn't exist
    const navActions = document.querySelector('.nav-actions');
    const existingLogout = document.getElementById('global-logout-btn');

    if (navActions && !existingLogout) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'global-logout-btn';
        logoutBtn.className = 'btn btn-outline btn-sm'; // styling
        logoutBtn.style.marginLeft = '10px';
        logoutBtn.style.fontSize = '0.8rem';
        logoutBtn.textContent = 'Logout';
        logoutBtn.onclick = handleLogout;
        navActions.appendChild(logoutBtn);
    }
}

function updateUIForLoggedOutUser() {
    // 1. Show "Join Hub" Button
    const joinHubBtn = document.getElementById('nav-join-hub');
    if (joinHubBtn) joinHubBtn.style.display = 'block';

    // 2. Remove Logout Button
    const logoutBtn = document.getElementById('global-logout-btn');
    if (logoutBtn) logoutBtn.remove();
}

// Global Logout Function
window.handleLogout = function() {
    if (confirm('Are you sure you want to log out?')) {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Logout failed', error);
        });
    }
};

// --- 2. Navigation Functionality (Enhanced) ---
function initNavigation() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });
    }
    
    // Close menu when clicking a link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (hamburger && navMenu) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    });

    // Log current navigation structure for debugging
    console.log('Navigation initialized with links:', 
        Array.from(navLinks).map(l => l.getAttribute('href')).filter(Boolean));
}

// NEW: Setup role-based navigation click handlers
function setupRoleBasedNavigation() {
    // Management link click handler
    const managementLink = document.getElementById('nav-management');
    if (managementLink) {
        // Remove any existing listeners by cloning and replacing
        const newManagementLink = managementLink.cloneNode(true);
        managementLink.parentNode.replaceChild(newManagementLink, managementLink);
        
        // Add new click listener
        newManagementLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🔷 Navigating to: Management Page');
            navigateToPage('management');
        });
        
        console.log('Management navigation handler initialized');
    }

    // Boardroom link click handler
    const boardroomLink = document.getElementById('nav-boardroom');
    if (boardroomLink) {
        // Remove any existing listeners by cloning and replacing
        const newBoardroomLink = boardroomLink.cloneNode(true);
        boardroomLink.parentNode.replaceChild(newBoardroomLink, boardroomLink);
        
        // Add new click listener
        newBoardroomLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🛡️ Navigating to: Board Room');
            navigateToPage('boardroom');
        });
        
        console.log('Boardroom navigation handler initialized');
    }

    // Also handle direct clicks on the anchor tags inside
    document.querySelectorAll('#nav-management a, #nav-boardroom a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.closest('#nav-management') ? 'management' : 'boardroom';
            console.log(`📱 Navigation via anchor: ${page}`);
            navigateToPage(page);
        });
    });
}

// NEW: Centralized navigation function
function navigateToPage(pageName) {
    console.log(`🚀 Navigating to: ${pageName}`);
    
    // Define page configurations
    const pages = {
        'index': { url: 'index.html', title: 'Home - PES ARENA' },
        'management': { url: 'management.html', title: 'My Tournaments - PES ARENA' },
        'boardroom': { url: 'boardroom.html', title: 'Board Room - PES ARENA' },
        'profile': { url: 'profile.html', title: 'My Profile - PES ARENA' },
        'tournaments': { url: 'tournaments.html', title: 'Tournaments - PES ARENA' },
        'leaderboard': { url: 'leaderboard.html', title: 'Leaderboard - PES ARENA' },
        'about': { url: 'about.html', title: 'About - PES ARENA' },
        'blog': { url: 'blog.html', title: 'News - PES ARENA' },
        'community': { url: 'community.html', title: 'Community - PES ARENA' }
    };

    const pageConfig = pages[pageName];
    
    if (pageConfig) {
        // Update browser title
        document.title = pageConfig.title;
        
        // For now, use simple navigation
        // In a more advanced SPA, you'd load content dynamically here
        window.location.href = pageConfig.url;
    } else {
        console.error(`Unknown page: ${pageName}`);
    }
}

// NEW: Function to check if current page matches navigation
function updateActiveNavLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    console.log('Current page:', currentPath);
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to matching link
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        }
    });
}

// --- 3. Animations (Existing) ---
function initAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    const animatedElements = document.querySelectorAll('.widget-card, .player-card, .tournament-card');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// --- 4. Page Load Helper (for debugging) ---
window.addEventListener('load', () => {
    console.log('📍 Current location:', window.location.href);
    updateActiveNavLink();
    
    // Verify that management and boardroom links exist if user has access
    setTimeout(() => {
        const managementLink = document.getElementById('nav-management');
        const boardroomLink = document.getElementById('nav-boardroom');
        
        if (managementLink && managementLink.style.display !== 'none') {
            console.log('✅ Management link is visible');
        }
        if (boardroomLink && boardroomLink.style.display !== 'none') {
            console.log('✅ Boardroom link is visible');
        }
    }, 2000); // Check after 2 seconds when roles should be loaded
});

// --- 5. Optional: SPA-style loading (commented out - use if you want single-page app behavior) ---
/*
const loadPage = (pageName) => {
    console.log(`📦 Loading page: ${pageName}`);
    
    const pages = {
        'index': '/index.html',
        'management': '/management.html',
        'boardroom': '/boardroom.html',
        'profile': '/profile.html'
    };
    
    const url = pages[pageName];
    if (!url) {
        console.error(`No URL found for page: ${pageName}`);
        return;
    }
    
    // Show loading indicator
    document.body.style.opacity = '0.5';
    
    fetch(url)
        .then(response => response.text())
        .then(html => {
            // Parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract main content (adjust selector as needed)
            const mainContent = doc.querySelector('main') || doc.body;
            
            // Replace current content
            const currentMain = document.querySelector('main') || document.body;
            currentMain.innerHTML = mainContent.innerHTML;
            
            // Update title
            document.title = doc.title;
            
            // Re-initialize necessary scripts
            if (window.homeManager) {
                window.homeManager.loadHomePageData();
            }
            
            // Hide loading
            document.body.style.opacity = '1';
            
            // Update active nav
            updateActiveNavLink();
            
            console.log(`✅ Page ${pageName} loaded successfully`);
        })
        .catch(error => {
            console.error(`Failed to load page ${pageName}:`, error);
            document.body.style.opacity = '1';
            // Fallback to traditional navigation
            window.location.href = url;
        });
};
*/