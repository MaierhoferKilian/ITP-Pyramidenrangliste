// Track the last active menu
let lastActiveMenu = 'user';

function getMenu(menuType){
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
    
    document.getElementById("rules").classList.remove("active");
    document.getElementById("user").classList.remove("active");
    document.getElementById("report").classList.remove("active");

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
        lastActiveMenu = 'rules';
    }
    else if (menuType==="history"){
        document.getElementById("sm-history").style.display="block";
        document.getElementById("sm-history").classList.add("mobile-active");
        document.getElementById("report").classList.add("active");
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
        
        // Hide challenge creation form when viewing existing challenges
        const challengeCreationForm = document.getElementById('challenge-creation-form');
        if (challengeCreationForm) {
            challengeCreationForm.style.display = 'none';
        }
        
        // Load and display all challenges
        if (typeof loadMyChallenges === 'function') {
            loadMyChallenges();
        }
    }
    
    // Add menu-open class to body on mobile
    if (window.innerWidth <= 1031.534) {
        document.body.classList.add('menu-open');
    }
}

function closeMenu() {
    console.log('closeMenu called');
    
    // Remove mobile-active from all menus
    document.querySelectorAll('.side-menu').forEach(menu => {
        menu.classList.remove('mobile-active');
        console.log('Removed mobile-active from:', menu.id);
    });
    
    // Remove menu-open class from body immediately
    document.body.classList.remove('menu-open');
    console.log('Removed menu-open from body');
    
    // On mobile, hide all menus after transition
    if (window.innerWidth <= 1031.534) {
        setTimeout(() => {
            document.getElementById("sm-user").style.display="none";
            document.getElementById("sm-rules").style.display="none";
            document.getElementById("sm-player").style.display="none";
            document.getElementById("sm-challenge").style.display="none";
            document.getElementById("sm-history").style.display="none";
            console.log('Set all menus to display none');
        }, 300); // Match the CSS transition duration
    }
    
    // Also remove active states from menu icons
    document.getElementById("rules").classList.remove("active");
    document.getElementById("user").classList.remove("active");
    document.getElementById("report").classList.remove("active");
    console.log('closeMenu completed');
}

function openLastActiveMenu() {
    getMenu(lastActiveMenu);
}