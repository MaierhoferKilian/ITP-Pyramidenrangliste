let isChallengerConfirmed = false;
let isChallengeConfirmed = false;
let isCancelChallengerConfirmed = false;
let isCancelChallengedConfirmed = false;

function resetChallengeState() {
    // Reset confirmation flags
    isChallengeConfirmed = false;
    isChallengerConfirmed = false;
    isCancelChallengerConfirmed = false;
    isCancelChallengedConfirmed = false;

    // Reset ball button text back to "HERAUS FORDERN"
    const buttonText = document.getElementById('challenge-button-text');
    if (buttonText) {
        buttonText.textContent = 'HERAUS FORDERN';
    }

    // Reset challenger status display
    setChallengerStatus(false);

    // Reset cancel statuses
    setCancelChallengerStatus(false);

    // Reset date picker and display
    const matchDatePicker = document.getElementById('match-date-picker');
    if (matchDatePicker) {
        matchDatePicker.value = '';
    }
    const matchDateDisplay = document.getElementById('match-date-display');
    if (matchDateDisplay) {
        matchDateDisplay.textContent = 'Datum wählen';
    }

    // Reset challenged player name
    const challengedName = document.getElementById('challenged-player-name');
    if (challengedName) {
        challengedName.textContent = 'xxx';
    }

    // Reset mobile challenge button
    const mobileBtn = document.getElementById('mobile-challenge-btn');
    if (mobileBtn) {
        mobileBtn.textContent = 'HERAUSFORDERN';
    }
}

function updateMatchDate(dateValue) {
    if (dateValue) {
        // Convert YYYY-MM-DD to DD.MM.YYYY
        const dateParts = dateValue.split('-');
        const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
        document.getElementById('match-date-display').textContent = formattedDate;
        
        // Automatically set challenger status to confirmed
        if (!isChallengerConfirmed) {
            setChallengerStatus(true);
        }
    }
}

function setChallengerStatus(confirmed) {
    isChallengerConfirmed = confirmed;
    const statusElement = document.getElementById('challenger-status');
    const arrowIcon = document.getElementById('challenger-icon-arrow');
    const xIcon = document.getElementById('challenger-icon-x');
    
    if (confirmed) {
        statusElement.textContent = 'Bestätigt';
        arrowIcon.style.display = 'none';
        xIcon.style.display = 'block';
    } else {
        statusElement.textContent = 'Offen';
        arrowIcon.style.display = 'block';
        xIcon.style.display = 'none';
    }
}

function toggleChallengerStatus() {
    setChallengerStatus(!isChallengerConfirmed);
}

function setCancelChallengerStatus(confirmed) {
    isCancelChallengerConfirmed = confirmed;
    const statusElement = document.getElementById('cancel-challenger-status');
    const arrowIcon = document.getElementById('cancel-challenger-icon-arrow');
    const xIcon = document.getElementById('cancel-challenger-icon-x');
    
    if (confirmed) {
        statusElement.textContent = 'abbrechen';
        arrowIcon.style.display = 'none';
        xIcon.style.display = 'block';
    } else {
        statusElement.textContent = 'nicht abbrechen';
        arrowIcon.style.display = 'block';
        xIcon.style.display = 'none';
    }
}

function toggleCancelChallengerStatus() {
    setCancelChallengerStatus(!isCancelChallengerConfirmed);
}

function setCancelChallengedStatus(confirmed) {
    isCancelChallengedConfirmed = confirmed;
    const statusElement = document.getElementById('cancel-challenged-status');
    const arrowIcon = document.getElementById('cancel-challenged-icon-arrow');
    const xIcon = document.getElementById('cancel-challenged-icon-x');
    
    if (confirmed) {
        statusElement.textContent = 'abbrechen';
        arrowIcon.style.display = 'none';
        xIcon.style.display = 'block';
    } else {
        statusElement.textContent = 'nicht abbrechen';
        arrowIcon.style.display = 'block';
        xIcon.style.display = 'none';
    }
}

function toggleCancelChallengedStatus() {
    setCancelChallengedStatus(!isCancelChallengedConfirmed);
}

function challengePlayer() {
    const buttonText = document.getElementById('challenge-button-text');
    const challengeButton = document.querySelector('.ball');
    
    if (!isChallengeConfirmed) {
        // First click: Check if player has existing challenges
        fetch('/get_my_challenges')
            .then(response => response.json())
            .then(data => {
                if (data.challenges && data.challenges.length > 0) {
                    // Player already has an active challenge - prevent further action
                    alert('Sie haben bereits eine aktive Herausforderung. Bitte schließen Sie diese zuerst ab.');
                    // Hide the challenge button
                    challengeButton.style.display = 'none';
                    // Show existing challenges
                    getMenu('challenges');
                    return;
                }
                
                // No active challenges, proceed with challenge creation
                // Open challenge menu (skip reset since we set state right after)
                getMenu('challenge', true);
                
                // Set confirmed state
                buttonText.textContent = 'BESTÄTIGEN';
                isChallengeConfirmed = true;
                
                // Also update mobile button
                const mobileBtn = document.getElementById('mobile-challenge-btn');
                if (mobileBtn) {
                    mobileBtn.textContent = 'BESTÄTIGEN';
                }
                
                // Trigger shake animation
                challengeButton.style.animation = 'none';
                setTimeout(() => {
                    challengeButton.style.animation = 'shake 0.5s';
                }, 10);
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ein Fehler ist aufgetreten.');
            });
    } else {
        // Second click: Submit challenge to backend
        if (!window.selectedPlayerData) {
            alert('Kein Spieler ausgewählt');
            return;
        }
        
        // Check if challenger confirmed
        if (!isChallengerConfirmed) {
            alert('Bitte bestätigen Sie die Herausforderung');
            return;
        }
        
        const matchDatePicker = document.getElementById('match-date-picker');
        const matchDate = matchDatePicker.value;
        
        if (!matchDate) {
            alert('Bitte wählen Sie ein Datum aus');
            return;
        }
        
        // Create challenge
        fetch('/create_challenge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                challenged_uid: window.selectedPlayerData.uid,
                match_date: matchDate
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
                location.reload();
            } else {
                alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ein Fehler ist aufgetreten.');
        });
    }
}

function loadMyChallenges() {
    fetch('/get_my_challenges')
        .then(response => response.json())
        .then(data => {
            if (data.challenges && data.challenges.length > 0) {
                // Show challenges icon if there are active challenges
                const challengesIcon = document.getElementById('challenges');
                if (challengesIcon) {
                    challengesIcon.style.display = 'block';
                }
                // Also show header nav challenges icon
                const navChallenges = document.querySelector('.header-nav .nav-challenges');
                if (navChallenges) {
                    navChallenges.style.display = '';
                }
                
                // Store challenges data
                window.myChallenges = data.challenges;
                
                // Update challenge display
                displayChallenges(data.challenges);
            } else {
                // Hide challenges icon if no active challenges
                const challengesIcon = document.getElementById('challenges');
                if (challengesIcon) {
                    challengesIcon.style.display = 'none';
                }
                // Also hide header nav challenges icon
                const navChallenges = document.querySelector('.header-nav .nav-challenges');
                if (navChallenges) {
                    navChallenges.style.display = 'none';
                }
                window.myChallenges = [];
                
                // Clear challenge display
                displayChallenges([]);
            }
        })
        .catch(error => {
            console.error('Error loading challenges:', error);
        });
}

function displayChallenges(challenges) {
    const challengeContainer = document.querySelector('#sm-challenge .challenge-container');
    const challengeMenuTitle = document.querySelector('#sm-challenge .headline-container h2');
    
    if (!challengeContainer) return;
    
    // Clear existing active challenges
    const existingChallenges = challengeContainer.querySelectorAll('.active-challenge');
    existingChallenges.forEach(el => el.remove());
    
    // Update menu title
    if (challengeMenuTitle) {
        challengeMenuTitle.textContent = challenges.length > 0 ? 'Ihre Herausforderungen' : 'Keine Herausforderungen';
    }
    
    // If no challenges, show a message
    if (challenges.length === 0) {
        const noChallengeMsgDiv = document.createElement('div');
        noChallengeMsgDiv.className = 'active-challenge challenge-headline-container';
        noChallengeMsgDiv.style.marginBottom = 'var(--space)';
        noChallengeMsgDiv.innerHTML = `
            <p style="color: var(--bg-color); font-style: italic;">Keine aktiven Herausforderungen</p>
        `;
        challengeContainer.insertBefore(noChallengeMsgDiv, challengeContainer.firstChild);
        return;
    }
    
    // Display each challenge
    challenges.forEach((challenge, index) => {
        const challengeDiv = document.createElement('div');
        challengeDiv.className = 'active-challenge challenge-headline-container';
        challengeDiv.style.marginBottom = 'var(--space)';
        if (index < challenges.length - 1) {
            challengeDiv.style.paddingBottom = 'var(--space)';
            challengeDiv.style.borderBottom = '2px solid var(--bg-color)';
        }
        
        const statusText = challenge.status === 'pending' ? 'Ausstehend' : 'Akzeptiert';
        const challengerRank = challenge.role === 'challenger' ? challenge.challenger_rank : challenge.opponent_rank;
        const challengedRank = challenge.role === 'challenged' ? challenge.challenged_rank : challenge.opponent_rank;
        
        const dateConfirmed = (challenge.role === 'challenger' && challenge.challenger_date_confirmed) ||
                            (challenge.role === 'challenged' && challenge.challenged_date_confirmed);
        const opponentDateConfirmed = (challenge.role === 'challenger' && challenge.challenged_date_confirmed) ||
                                     (challenge.role === 'challenged' && challenge.challenger_date_confirmed);
        
        const currentWantsCancel = (challenge.role === 'challenger' && challenge.challenger_wants_cancel) ||
                                  (challenge.role === 'challenged' && challenge.challenged_wants_cancel);
        const opponentWantsCancel = (challenge.role === 'challenger' && challenge.challenged_wants_cancel) ||
                                   (challenge.role === 'challenged' && challenge.challenger_wants_cancel);
        
        let challengeHTML = `
            <div class="challenge-headline-container">
                <div class="challenge-headline">
                    <h4>HERAUSFORDERER</h4>
                    <img src="/static/images/challenger.svg" alt="Challenger Image">
                </div>
                <p>${challenge.role === 'challenger' ? 'Sie' : challenge.opponent_name} (#${challengerRank})</p>
            </div>
            <div class="challenge-headline-container">
                <div class="challenge-headline">
                    <h4>HERAUSGEFORDERTER</h4>
                    <img src="/static/images/challenged.svg" alt="Challenged Image">
                </div>
                <p>${challenge.role === 'challenged' ? 'Sie' : challenge.opponent_name} (#${challengedRank})</p>
            </div>
            <div class="challenge-headline-container" style="margin-top: var(--space);">
                <div class="challenge-headline" style="position: relative;">
                    <h4>SPIELZEITPUNKT</h4>
                    ${challenge.status === 'pending' ? `<img style="cursor: pointer;" src="/static/images/calendar.svg" alt="Calendar Image"><input type="date" id="match-date-picker-${challenge.challenge_id}" class="date-picker-overlay" value="${challenge.match_date ? challenge.match_date.split('.').reverse().join('-') : ''}" onchange="updateChallengeDate(${challenge.challenge_id}, this.value)">` : ''}
                </div>
                <!-- Show Match Date as main date -->
                <p id="match-date-display-${challenge.challenge_id}">${challenge.match_date || 'Kein Datum'}</p>
                <!-- Show Deadline for info -->
                <p style="font-size: 0.8em; color: var(--hl2-color); margin-bottom: 5px;">Deadline: ${challenge.deadline_date || '-'}</p>
                <div class="approve-container" style="margin-top: calc(var(--space) / 2);">
                    <div class="approve-container-one">
                        <div class="approve-container-two">
                            <img src="${challenge.role === 'challenger' ? '/static/images/challenger.svg' : '/static/images/challenged.svg'}" alt="Image">
                            <p class="challenge-status">${dateConfirmed ? 'Bestätigt' : 'Nicht bestätigt'}</p>
                        </div>
                        ${!dateConfirmed && challenge.status === 'pending' ? `<div class="user-button" onclick="confirmChallengeDate(${challenge.challenge_id})">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9.22353 8L15.9059 8.09412M15.9059 8.09412L16 14.7765M15.9059 8.09412L8 16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>` : ''}
                    </div>
                    <div class="approve-container-one">
                        <div class="approve-container-two">
                            <img src="${challenge.role === 'challenged' ? '/static/images/challenged.svg' : '/static/images/challenger.svg'}" alt="Image">
                            <p class="challenge-status">${opponentDateConfirmed ? 'Bestätigt' : 'Nicht bestätigt'}</p>
                        </div>
                    </div>
                </div>
                <p style="margin-top: calc(var(--space) / 2);">Status: ${statusText}</p>
                ${(function(){
                    if (challenge.status === 'accepted' && challenge.challenge_date) {
                        const parts = challenge.match_date ? challenge.match_date.split('.') : null;
                        if (parts && parts.length === 3) {
                            const matchDate = new Date(parts[2], parts[1] - 1, parts[0]);
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            
                            if (today >= matchDate) {
                                const imChallenger = challenge.role === 'challenger';
                                const myConfirmed = imChallenger ? challenge.challenger_result_confirmed : challenge.challenged_result_confirmed;
                                const opponentConfirmed = imChallenger ? challenge.challenged_result_confirmed : challenge.challenger_result_confirmed;
                                const result = challenge.match_result;

                                let buttonText = "Ergebnis eintragen";
                                let buttonColor = "var(--bg-color)";
                                let textColor = "var(--fg-color)";
                                let additionalText = "";

                                if (result) {
                                    if (myConfirmed && !opponentConfirmed) {
                                        buttonText = "Warte auf Bestätigung";
                                        additionalText = `<p style="font-size: 0.8rem; margin-top: 5px;">Eingetragen: ${result}</p>`;
                                    } else if (!myConfirmed && opponentConfirmed) {
                                        buttonText = "Ergebnis bestätigen";
                                        buttonColor = "var(--hl3-color)"; // Highlight for action needed
                                    } else if (myConfirmed && opponentConfirmed) {
                                        return `<p style="margin-top: calc(var(--space) / 2);">Ergebnis: ${result}</p>`;
                                    }
                                }

                                return `<div class="user-button" onclick="openResultModal(${challenge.challenge_id}, '${challenge.role}', '${result || ''}')" style="margin-top: calc(var(--space) / 2); width: auto; padding: 5px 10px; justify-content: center; background-color: ${buttonColor}; border: 2px solid var(--fg-color);">
                                            <span style="margin-right: 5px; font-weight: bold; color: ${textColor};">${buttonText}</span>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 20h9" stroke="${textColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="${textColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                        </div>${additionalText}`;
                            }
                        }
                    }
                    return '';
                })()}
            </div>
        `;
        
        // Only show accept button if user is challenged AND status is pending AND both confirmed date
        if (challenge.role === 'challenged' && challenge.status === 'pending' && challenge.challenger_date_confirmed && challenge.challenged_date_confirmed) {
            challengeHTML += `
                <div class="approve-container" style="margin-top: var(--space);">
                    <div class="approve-container-one">
                        <div class="approve-container-two">
                            <img src="/static/images/challenged.svg" alt="Challenged Image">
                            <p class="challenge-status">Annehmen?</p>
                        </div>
                        <div class="user-button" onclick="acceptChallenge(${challenge.challenge_id})">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9.22353 8L15.9059 8.09412M15.9059 8.09412L16 14.7765M15.9059 8.09412L8 16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Add cancel section for pending and accepted challenges
        if (challenge.status === 'pending' || challenge.status === 'accepted') {
            const cancelMessage = challenge.status === 'accepted' 
                ? 'Sollte das Match nicht stattfinden können, besteht die Möglichkeit es einstimmig abzubrechen!'
                : 'Sollte kein gemeinsamer Termin ausgemacht werden können, besteht die Möglichkeit die Herausforderung einstimmig abzubrechen!';
            
            challengeHTML += `
                <div class="cancel-container">
                    <p>${cancelMessage}</p>
                    <div class="approve-container-one">
                        <div class="approve-container-two">
                            <img src="${challenge.role === 'challenger' ? '/static/images/cancel-challenger.svg' : '/static/images/cancel-challenged.svg'}" alt="Image">
                            <p class="challenge-status">${currentWantsCancel ? 'abbrechen' : 'nicht abbrechen'}</p>
                        </div>
                        <div id="cancel-button" class="user-button" onclick="toggleCancelChallenge(${challenge.challenge_id}, ${!currentWantsCancel})">
                            <svg style="display: ${currentWantsCancel ? 'none' : 'block'};" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9.22353 8L15.9059 8.09412M15.9059 8.09412L16 14.7765M15.9059 8.09412L8 16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <svg style="display: ${currentWantsCancel ? 'block' : 'none'};" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 8L8 16M16 16L8 8" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </div>
                    </div>
                    <div class="approve-container-one">
                        <div class="approve-container-two">
                            <img src="${challenge.role === 'challenged' ? '/static/images/cancel-challenged.svg' : '/static/images/cancel-challenger.svg'}" alt="Image">
                            <p class="challenge-status">${opponentWantsCancel ? 'abbrechen' : 'nicht abbrechen'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        challengeDiv.innerHTML = challengeHTML;
        challengeContainer.insertBefore(challengeDiv, challengeContainer.firstChild);
    });
}

function updateChallengeDate(challengeId, dateValue) {
    if (!dateValue) return;
    
    const dateParts = dateValue.split('-');
    const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
    
    // Optimistic UI update
    const displayElement = document.getElementById(`match-date-display-${challengeId}`);
    if (displayElement) {
        displayElement.textContent = formattedDate;
    }
    
    fetch('/update_challenge_date', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            challenge_id: challengeId,
            new_date: dateValue
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            loadMyChallenges();
        } else {
            alert('Fehler beim Aktualisieren des Datums: ' + (data.error || 'Unbekannter Fehler'));
            loadMyChallenges();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ein Fehler ist aufgetreten.');
        loadMyChallenges();
    });
}

function confirmChallengeDate(challengeId) {
    fetch('/confirm_challenge_date', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            challenge_id: challengeId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadMyChallenges();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ein Fehler ist aufgetreten.');
    });
}

function toggleCancelChallenge(challengeId, wantsCancel) {
    fetch('/toggle_cancel_challenge', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            challenge_id: challengeId,
            wants_cancel: wantsCancel
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.cancelled) {
                alert(data.message);
                location.reload();
            } else {
                loadMyChallenges();
            }
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ein Fehler ist aufgetreten.');
    });
}

function acceptChallenge(challengeId) {
    if (!confirm('Möchten Sie diese Herausforderung annehmen?')) {
        return;
    }
    
    fetch('/accept_challenge', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            challenge_id: challengeId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            loadMyChallenges();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ein Fehler ist aufgetreten.');
    });
}


function openResultModal(challengeId, role, currentResult) {
    document.getElementById('result-challenge-id').value = challengeId;
    document.getElementById('result-user-role').value = role;
    
    // Reset values
    let mySets = "0";
    let opponentSets = "0";

    if (currentResult && currentResult.includes(':')) {
        const parts = currentResult.split(':');
        // Result is always Challenger:Challenged
        if (role === 'challenger') {
            mySets = parts[0];
            opponentSets = parts[1];
        } else {
            mySets = parts[1];
            opponentSets = parts[0];
        }
    }

    document.getElementById('my-sets').value = mySets;
    document.getElementById('opponent-sets').value = opponentSets;
    
    // Show modal
    document.getElementById('result-modal').style.display = 'flex';
}

function closeResultModal() {
    document.getElementById('result-modal').style.display = 'none';
}

function submitResult() {
    const challengeId = document.getElementById('result-challenge-id').value;
    const role = document.getElementById('result-user-role').value;
    const mySets = document.getElementById('my-sets').value;
    const opponentSets = document.getElementById('opponent-sets').value;
    
    // Simple validation
    if (mySets === opponentSets) {
        alert("Unentschieden ist in diesem Modus nicht möglich.");
        return;
    }
    
    // Create result string "Challenger:Challenged"
    let resultString = "";
    if (role === 'challenger') {
        resultString = `${mySets}:${opponentSets}`;
    } else {
        resultString = `${opponentSets}:${mySets}`;
    }
    
    fetch('/submit_match_result', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            challenge_id: challengeId,
            result: resultString
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.confirmed) {
                alert('Ergebnis bestätigt und Match abgeschlossen!');
                location.reload();
            } else {
                alert('Ergebnis eingetragen. Der andere Spieler muss noch bestätigen.');
                closeResultModal();
                loadMyChallenges(); // Reload challenges to update view
            }
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ein Fehler ist aufgetreten.');
    });
}

// Load challenges on page load
document.addEventListener('DOMContentLoaded', function() {
    loadMyChallenges();
});
