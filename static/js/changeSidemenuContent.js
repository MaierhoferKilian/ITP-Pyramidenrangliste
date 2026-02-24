// Track the last active menu and whether it's currently open on mobile
let lastActiveMenu = 'user';
let mobileMenuOpen = false;
let mobileNavOpen = false;

// Toggle the fullscreen mobile navigation overlay
function toggleMobileMenu() {
    const overlay = document.getElementById('mobile-nav-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');
    
    if (mobileNavOpen) {
        overlay.classList.remove('active');
        mobileNavOpen = false;
    } else {
        // Sync challenges visibility in overlay
        const navChallenges = document.querySelector('.nav-challenges');
        const mobileNavChallenges = document.querySelector('.mobile-nav-challenges');
        if (navChallenges && mobileNavChallenges) {
            mobileNavChallenges.style.display = navChallenges.style.display === 'none' ? 'none' : 'flex';
        }
        overlay.classList.add('active');
        mobileNavOpen = true;
    }
}

// Handle navigation selection from the mobile overlay menu
function mobileNavSelect(menuType) {
    // Close the overlay first
    toggleMobileMenu();
    // Then open the selected side menu
    getMenu(menuType);
}

function getMenu(menuType, skipChallengeReset){
    // On mobile, if the same menu icon is clicked again, close it (toggle)
    if (window.innerWidth <= 1031.534 && mobileMenuOpen && lastActiveMenu === menuType) {
        closeMenu();
        return;
    }

    document.getElementById("sm-user").style.display="none";
    document.getElementById("sm-rules").style.display="none";
    document.getElementById("sm-player").style.display="none";
    document.getElementById("sm-challenge").style.display="none";
    document.getElementById("sm-history").style.display="none";
    
    // Remove mobile-active class from all side menus
    document.getElementById("sm-user").classList.remove("mobile-active");
    document.getElementById("sm-rules").classList.remove("mobile-active");
    document.getElementById("sm-player").classList.remove("mobile-active");
    document.getElementById("sm-challenge").classList.remove("mobile-active");
    document.getElementById("sm-history").classList.remove("mobile-active");
    
    // Remove active from pyramid menu icons
    document.getElementById("rules").classList.remove("active");
    document.getElementById("user").classList.remove("active");
    document.getElementById("report").classList.remove("active");

    // Remove active from header nav icons
    document.querySelectorAll('.header-nav .nav-icon').forEach(function(icon) {
        icon.classList.remove('active');
    });

    // Reset challenge state whenever navigating away from challenge menu
    if (menuType !== 'challenge' && !skipChallengeReset) {
        if (typeof resetChallengeState === 'function') {
            resetChallengeState();
        }
    }

    const vacationContainer = document.getElementById('vacation-warning-sidemenu');
    if (vacationContainer) {
        vacationContainer.style.display = 'none';
    }

    // Recenter pyramid unless we are viewing player details (which zooms in)
    if (menuType !== 'player' && menuType !== 'challenge') {
        if (typeof window.fitPyramidToView === 'function') {
            window.fitPyramidToView(true);
        }
        if (typeof window.deselectAll === 'function') {
            window.deselectAll();
        }
    }

    if (menuType==="rules"){
        document.getElementById("sm-rules").style.display="block";
        document.getElementById("sm-rules").classList.add("mobile-active");
        document.getElementById("rules").classList.add("active");
        activateNavIcon('rules');
        lastActiveMenu = 'rules';
    }
    else if (menuType==="history"){
        document.getElementById("sm-history").style.display="block";
        document.getElementById("sm-history").classList.add("mobile-active");
        document.getElementById("report").classList.add("active");
        activateNavIcon('history');
        lastActiveMenu = 'history';
        if (typeof loadMatchHistory === 'function') {
            loadMatchHistory();
        }
    }
    else if (menuType==="player"){
        document.getElementById("sm-player").style.display="block";
        document.getElementById("sm-player").classList.add("mobile-active");
        lastActiveMenu = 'player';
    }
    else if (menuType==="user"){
        document.getElementById("sm-user").style.display="block";
        document.getElementById("sm-user").classList.add("mobile-active");
        document.getElementById("user").classList.add("active");
        activateNavIcon('user');
        lastActiveMenu = 'user';
    }
    else if (menuType==="challenge"){
        document.getElementById("sm-challenge").style.display="block";
        
        // Reset menu title when creating new challenge
        const challengeMenuTitle = document.querySelector('#sm-challenge .headline-container h2');
        if (challengeMenuTitle) {
            challengeMenuTitle.textContent = 'Spieler Herausfordern';
        }
        
        // Show challenge creation form
        const challengeCreationForm = document.getElementById('challenge-creation-form');
        if (challengeCreationForm) {
            challengeCreationForm.style.display = 'block';
        }
        
        // Show mobile challenge button container
        const mobileChallengeBtn = document.getElementById('mobile-challenge-btn');
        if (mobileChallengeBtn) {
            mobileChallengeBtn.style.display = '';
            mobileChallengeBtn.parentElement.style.display = '';
        }
        
        // Clear any existing active challenges from view
        const existingChallenges = document.querySelectorAll('#sm-challenge .active-challenge');
        existingChallenges.forEach(el => el.remove());
        document.getElementById("sm-challenge").classList.add("mobile-active");
        lastActiveMenu = 'challenge';
        
        // Update challenged player name if data is available
        if (window.selectedPlayerData) {
            const challengedNameElement = document.getElementById("challenged-player-name");
            if (challengedNameElement) {
                challengedNameElement.textContent = `${window.selectedPlayerData.firstname} ${window.selectedPlayerData.lastname}`;
            }
        }
    }
    else if (menuType==="challenges"){
        document.getElementById("sm-challenge").style.display="block";
        document.getElementById("sm-challenge").classList.add("mobile-active");
        
        // Hide challenge creation form when viewing existing challenges
        const challengeCreationForm = document.getElementById('challenge-creation-form');
        if (challengeCreationForm) {
            challengeCreationForm.style.display = 'none';
        }
        
        // Hide mobile challenge button when viewing existing challenges
        const mobileBtn = document.getElementById('mobile-challenge-btn');
        if (mobileBtn) {
            mobileBtn.style.display = 'none';
        }
        const mobileBtnContainer = mobileBtn ? mobileBtn.parentElement : null;
        if (mobileBtnContainer) {
            mobileBtnContainer.style.display = 'none';
        }
        
        // Load and display all challenges
        if (typeof loadMyChallenges === 'function') {
            loadMyChallenges();
        }
        activateNavIcon('challenges');
        lastActiveMenu = 'challenges';
    }
    
    // Add menu-open class to body on mobile
    if (window.innerWidth <= 1031.534) {
        document.body.classList.add('menu-open');
        mobileMenuOpen = true;
    }
}

// Activate the matching header-nav icon
function activateNavIcon(menuType) {
    var icon = document.querySelector('.header-nav .nav-icon[data-menu="' + menuType + '"]');
    if (icon) {
        icon.classList.add('active');
    }
}

function closeMenu() {
    // Remove mobile-active from all menus
    document.querySelectorAll('.side-menu').forEach(function(menu) {
        menu.classList.remove('mobile-active');
    });
    
    // Remove menu-open class from body
    document.body.classList.remove('menu-open');
    mobileMenuOpen = false;
    
    // On mobile, hide all menus after transition
    if (window.innerWidth <= 1031.534) {
        setTimeout(function() {
            document.getElementById("sm-user").style.display="none";
            document.getElementById("sm-rules").style.display="none";
            document.getElementById("sm-player").style.display="none";
            document.getElementById("sm-challenge").style.display="none";
            document.getElementById("sm-history").style.display="none";
        }, 300);
    }
    
    // Remove active states from pyramid menu icons
    document.getElementById("rules").classList.remove("active");
    document.getElementById("user").classList.remove("active");
    document.getElementById("report").classList.remove("active");

    // Remove active states from header nav icons
    document.querySelectorAll('.header-nav .nav-icon').forEach(function(icon) {
        icon.classList.remove('active');
    });
}

function openLastActiveMenu() {
    getMenu(lastActiveMenu);
}

// Function to copy email to clipboard
function copyEmail() {
    const emailElement = document.getElementById('player-email');
    const email = emailElement.textContent.trim();
    
    // Don't copy if it's the "Kopiert!" message
    if (email === 'Kopiert!') {
        return;
    }
    
    navigator.clipboard.writeText(email).then(function() {
        // Show a temporary confirmation message
        const originalText = emailElement.textContent;
        emailElement.textContent = 'Kopiert!';
        setTimeout(function() {
            emailElement.textContent = originalText;
        }, 1500);
    }).catch(function(err) {
        console.error('Failed to copy email: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = email;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            const originalText = emailElement.textContent;
            emailElement.textContent = 'Kopiert!';
            setTimeout(function() {
                emailElement.textContent = originalText;
            }, 1500);
        } catch (err) {
            console.error('Fallback copy failed: ', err);
        }
        document.body.removeChild(textArea);
    });
}