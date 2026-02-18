// UON HUB/js/splash.js
// Enhanced splash screen controller with glitch animations and progress bar

document.addEventListener("DOMContentLoaded", () => {
    const splashScreen = document.getElementById("app-splash-screen");
    const tagline = document.querySelector(".typing-text");
    const progressBar = document.querySelector(".loader-progress");
    const glitchText = document.querySelector(".glitch-text");
    const scanline = document.querySelector(".scanline");
    
    // Ensure splash screen is visible
    if (splashScreen) {
        splashScreen.style.display = "flex";
        splashScreen.style.opacity = "1";
        
        // Start scanline animation
        if (scanline) {
            scanline.style.animation = "scanline 3s linear infinite";
        }
        
        // Trigger glitch effect at intervals
        if (glitchText) {
            setInterval(() => {
                glitchText.classList.add("glitch-active");
                setTimeout(() => {
                    glitchText.classList.remove("glitch-active");
                }, 300);
            }, 2000);
        }
    }
    
    // Animated progress bar
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 90) { // Fill to 90% then wait for completion
            progress += Math.random() * 15 + 5;
            if (progress > 90) progress = 90;
            
            if (progressBar) {
                progressBar.style.width = progress + "%";
            }
        }
    }, 100);

    // Sequence for text changes to keep users engaged
    const sequences = [
        "ESTABLISHING CONNECTION...",
        "SYNCING PLAYER DATA...",
        "LOADING ARENA ASSETS...",
        "PREPARING GAME ENGINE...",
        "INITIALIZING UON GRiD HUB...",
        "WELCOME, LEGEND."
    ];

    let sequenceIndex = 0;
    const textInterval = setInterval(() => {
        if (sequenceIndex < sequences.length) {
            if (tagline) {
                tagline.style.opacity = "0";
                setTimeout(() => {
                    tagline.textContent = sequences[sequenceIndex];
                    tagline.style.opacity = "1";
                    tagline.style.transition = "opacity 0.3s ease";
                    
                    // Special effect for last message
                    if (sequenceIndex === sequences.length - 1) {
                        tagline.classList.add("final-glow");
                        
                        // Complete progress bar
                        clearInterval(progressInterval);
                        if (progressBar) {
                            progressBar.style.width = "100%";
                            progressBar.style.transition = "width 0.5s ease";
                        }
                    }
                }, 300);
            }
            sequenceIndex++;
        } else {
            clearInterval(textInterval);
        }
    }, 600); // Change text every 600ms

    // Enhanced fade out with multiple effects
    setTimeout(() => {
        if (splashScreen) {
            // Add multiple effects for dramatic exit
            splashScreen.style.opacity = "0";
            splashScreen.style.transform = "scale(1.1)";
            splashScreen.style.filter = "blur(10px)";
            splashScreen.style.transition = "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
            
            // Hide after transition
            setTimeout(() => {
                splashScreen.style.display = "none";
                
                // Show main content
                const mainContent = document.getElementById("main-content");
                if (mainContent) {
                    mainContent.style.display = "block";
                    
                    // Add subtle entrance animation
                    setTimeout(() => {
                        mainContent.style.opacity = "1";
                        mainContent.style.transition = "opacity 0.5s ease";
                    }, 50);
                    
                    // Trigger custom event for other scripts
                    document.dispatchEvent(new CustomEvent('splash-hidden', {
                        detail: { timestamp: Date.now() }
                    }));
                }
            }, 800);
        }
    }, 3000); // Total splash duration: 3 seconds

    // Backup timer to ensure splash screen disappears
    setTimeout(() => {
        const splashScreen = document.getElementById("app-splash-screen");
        const mainContent = document.getElementById("main-content");
        
        if (splashScreen && splashScreen.style.display !== 'none') {
            splashScreen.style.opacity = "0";
            splashScreen.style.transition = "opacity 0.5s ease";
            
            setTimeout(() => {
                splashScreen.style.display = "none";
                if (mainContent) {
                    mainContent.style.display = "block";
                    document.dispatchEvent(new CustomEvent('splash-hidden'));
                }
            }, 500);
        }
    }, 4000); // 4 second absolute maximum
});

// Additional CSS for the glitch effect (would normally be in CSS file)
// Added here for reference and could be injected dynamically
const injectGlitchCSS = () => {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes glitch {
            0% { transform: translate(0); }
            20% { transform: translate(-2px, 2px); }
            40% { transform: translate(-2px, -2px); }
            60% { transform: translate(2px, 2px); }
            80% { transform: translate(2px, -2px); }
            100% { transform: translate(0); }
        }
        
        @keyframes scanline {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100vh); }
        }
        
        .glitch-text {
            position: relative;
            font-family: 'Orbitron', monospace;
            font-weight: 900;
            color: #00ff88;
            text-shadow: 0 0 10px #00ff88;
            letter-spacing: 2px;
        }
        
        .glitch-text::before,
        .glitch-text::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.8;
        }
        
        .glitch-text::before {
            color: #ff00ff;
            z-index: -1;
            animation: glitch 0.3s infinite;
        }
        
        .glitch-text::after {
            color: #00ffff;
            z-index: -2;
            animation: glitch 0.5s infinite reverse;
        }
        
        .glitch-active {
            animation: glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        
        .scanline {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: linear-gradient(to right, 
                transparent 0%, 
                rgba(0, 255, 136, 0.8) 50%, 
                transparent 100%);
            z-index: 10;
            pointer-events: none;
        }
        
        .typing-text {
            font-family: 'Orbitron', monospace;
            font-weight: 500;
            color: #88ffcc;
            text-shadow: 0 0 5px rgba(0, 255, 136, 0.5);
            letter-spacing: 1px;
            min-height: 24px;
        }
        
        .final-glow {
            animation: text-glow 1s ease-in-out infinite alternate;
            color: #ffff00 !important;
        }
        
        @keyframes text-glow {
            from { text-shadow: 0 0 5px #ffff00, 0 0 10px #ffff00; }
            to { text-shadow: 0 0 10px #ffff00, 0 0 20px #ffff00, 0 0 30px #ffaa00; }
        }
        
        .loader-bar {
            width: 300px;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            margin-top: 30px;
            overflow: hidden;
            position: relative;
        }
        
        .loader-bar::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, 
                transparent, 
                rgba(0, 255, 136, 0.3), 
                transparent);
            animation: shimmer 2s infinite;
        }
        
        .loader-progress {
            height: 100%;
            background: linear-gradient(90deg, #00ff88, #00ccff);
            border-radius: 2px;
            width: 0%;
            transition: width 0.2s ease;
            position: relative;
            z-index: 2;
        }
        
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .splash-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            overflow: hidden;
        }
        
        .splash-container::before {
            content: '';
            position: absolute;
            width: 200%;
            height: 200%;
            background: 
                radial-gradient(circle at 20% 50%, rgba(0, 255, 136, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(0, 204, 255, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 40% 80%, rgba(255, 0, 255, 0.05) 0%, transparent 50%);
            animation: rotate 20s linear infinite;
        }
        
        .splash-content {
            text-align: center;
            z-index: 2;
            position: relative;
        }
        
        @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
};

// Inject CSS when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectGlitchCSS);
} else {
    injectGlitchCSS();
}