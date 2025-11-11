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