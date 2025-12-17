function getMenu(menuType){
    document.getElementById("sm-user").style.display="none";
    document.getElementById("sm-rules").style.display="none";
    document.getElementById("sm-player").style.display="none";
    document.getElementById("sm-challenge").style.display="none";
    
    document.getElementById("rules").classList.remove("active");
    document.getElementById("user").classList.remove("active");

    const vacationContainer = document.getElementById('vacation-warning-sidemenu');
    if (vacationContainer) {
        vacationContainer.style.display = 'none';
    }

    if (menuType==="rules"){
        document.getElementById("sm-rules").style.display="block";
        document.getElementById("rules").classList.add("active");
    }
    else if (menuType==="player"){
        document.getElementById("sm-player").style.display="block";
    }
    else if (menuType==="user"){
        document.getElementById("sm-user").style.display="block";
        document.getElementById("user").classList.add("active");
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
}