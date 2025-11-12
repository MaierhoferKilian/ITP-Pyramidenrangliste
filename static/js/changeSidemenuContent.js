function getRules(){
    if (document.getElementById("sm-rules").style.display==="block"){
        document.getElementById("sm-rules").style.display="none";
        document.getElementById("sm-player").style.display="block";
        return;
    }
    else{
        document.getElementById("sm-rules").style.display="block";
        document.getElementById("sm-player").style.display="none";
    }
}

function getPlayer(){

}

function getMenu(menuType){
    document.getElementById("sm-user").style.display="none";
    document.getElementById("sm-rules").style.display="none";
    document.getElementById("sm-player").style.display="none";

    if (menuType==="rules"){
        document.getElementById("sm-rules").style.display="block";
    }
    else if (menuType==="player"){
        document.getElementById("sm-player").style.display="block";
    }
    else if (menuType==="user"){
        document.getElementById("sm-user").style.display="block";
    }
}