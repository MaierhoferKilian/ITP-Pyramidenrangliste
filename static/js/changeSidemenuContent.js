function getMenu(menuType){
    document.getElementById("sm-user").style.display="none";
    document.getElementById("sm-rules").style.display="none";
    document.getElementById("sm-player").style.display="none";
    
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
}