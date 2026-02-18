// UON HUB/js/main.js
// Main Application Logic - Runs on every page

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    initNavigation();
    initAnimations();
    setupGlobalAuthListener(); // New Global Auth Check
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

// --- 2. Navigation Functionality (Restored to original) ---
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