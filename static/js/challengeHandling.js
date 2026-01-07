let isChallengerConfirmed = false;
let isChallengeConfirmed = false;
let isCancelChallengerConfirmed = false;
let isCancelChallengedConfirmed = false;

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
                buttonText.textContent = 'BESTÄTIGEN';
                isChallengeConfirmed = true;
                
                // Trigger shake animation
                challengeButton.style.animation = 'none';
                setTimeout(() => {
                    challengeButton.style.animation = 'shake 0.5s';
                }, 10);
                
                // Open challenge menu
                getMenu('challenge');
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
                
                // Show challenges menu icon
                const challengesIcon = document.getElementById('challenges');
                if (challengesIcon) {
                    challengesIcon.style.display = 'block';
                }
                
                // Reset challenge button
                buttonText.textContent = 'HERAUS FORDERN';
                isChallengeConfirmed = false;
                isChallengerConfirmed = false;
                challengeButton.style.display = 'none';
                
                // Reset form
                matchDatePicker.value = '';
                document.getElementById('match-date-display').textContent = 'Datum wählen';
                setChallengerStatus(false);
                
                // Load challenges and show challenges menu
                loadMyChallenges();
                getMenu('challenges');
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
    challenges.forEach(challenge => {
        const challengeDiv = document.createElement('div');
        challengeDiv.className = 'active-challenge challenge-headline-container';
        challengeDiv.style.marginBottom = 'var(--space)';
        challengeDiv.style.paddingBottom = 'var(--space)';
        challengeDiv.style.borderBottom = '2px solid var(--bg-color)';
        
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
                <div class="challenge-headline">
                    <h4>SPIELZEITPUNKT</h4>
                    ${challenge.status === 'pending' ? `<img onclick="document.getElementById('match-date-picker-${challenge.challenge_id}').showPicker()" style="cursor: pointer;" src="/static/images/calendar.svg" alt="Calendar Image">` : ''}
                </div>
                <p id="match-date-display-${challenge.challenge_id}">${challenge.deadline_date || 'Kein Datum'}</p>
                ${challenge.status === 'pending' ? `<input type="date" id="match-date-picker-${challenge.challenge_id}" style="display: none;" value="${challenge.deadline_date ? challenge.deadline_date.split('.').reverse().join('-') : ''}" onchange="updateChallengeDate(${challenge.challenge_id}, this.value)">` : ''}
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
            }
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

// Load challenges on page load
document.addEventListener('DOMContentLoaded', function() {
    loadMyChallenges();
});
