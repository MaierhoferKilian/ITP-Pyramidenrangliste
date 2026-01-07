// Track the last active menu
let lastActiveMenu = 'user';

function getMenu(menuType){
    document.getElementById("sm-user").style.display="none";
    document.getElementById("sm-rules").style.display="none";
    document.getElementById("sm-player").style.display="none";
    document.getElementById("sm-challenge").style.display="none";
    
    // Remove mobile-active class from all side menus
    document.getElementById("sm-user").classList.remove("mobile-active");
    document.getElementById("sm-rules").classList.remove("mobile-active");
    document.getElementById("sm-player").classList.remove("mobile-active");
    document.getElementById("sm-challenge").classList.remove("mobile-active");
    
    document.getElementById("rules").classList.remove("active");
    document.getElementById("user").classList.remove("active");

    const vacationContainer = document.getElementById('vacation-warning-sidemenu');
    if (vacationContainer) {
        vacationContainer.style.display = 'none';
    }

    if (menuType==="rules"){
        document.getElementById("sm-rules").style.display="block";
        document.getElementById("sm-rules").classList.add("mobile-active");
        document.getElementById("rules").classList.add("active");
        lastActiveMenu = 'rules';
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
            console.log('Set all menus to display none');
        }, 300); // Match the CSS transition duration
    }
    
    // Also remove active states from menu icons
    document.getElementById("rules").classList.remove("active");
    document.getElementById("user").classList.remove("active");
    console.log('closeMenu completed');
}

function openLastActiveMenu() {
    getMenu(lastActiveMenu);
}