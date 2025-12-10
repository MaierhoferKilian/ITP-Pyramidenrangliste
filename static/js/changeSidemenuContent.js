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
        
        // Update challenged player name if data is available
        if (window.selectedPlayerData) {
            const challengedNameElement = document.getElementById("challenged-player-name");
            if (challengedNameElement) {
                challengedNameElement.textContent = `${window.selectedPlayerData.firstname} ${window.selectedPlayerData.lastname}`;
            }
        }
    }
}