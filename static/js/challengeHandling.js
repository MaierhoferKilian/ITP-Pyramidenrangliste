// ============================================================
// Challenge Handling - New Flow
// ============================================================
// States:
//   pending  -> Challenger: Bild4, Challenged: Bild3
//   accepted -> Both: Bild5 (enter result) / Bild6 (result entered)
// ============================================================

let selectedChallengeDate = null; // YYYY-MM-DD
let challengeDatePickerOpenedAt = 0;

function getTodayIsoDate() {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
}

function syncChallengeDateInputs(options) {
    var opts = options || {};
    var clearValue = !!opts.clearValue;
    var minDate = getTodayIsoDate();
    var inputs = document.querySelectorAll('.challenge-date-input');

    inputs.forEach(function(input) {
        input.min = minDate;
        if (clearValue) input.value = '';
    });
}

// ----------------------------------------------------------
// Reset challenge creation UI back to initial state
// ----------------------------------------------------------
function resetChallengeState() {
    selectedChallengeDate = null;
    const step1 = document.getElementById('challenge-step1');
    const step2 = document.getElementById('challenge-step2');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';

    syncChallengeDateInputs({ clearValue: true });



    const name1 = document.getElementById('challenged-player-name');
    if (name1) name1.textContent = 'xxx';
    const name2 = document.getElementById('challenged-player-name-2');
    if (name2) name2.textContent = 'xxx';
}

// ----------------------------------------------------------
// Open the challenge menu when clicking the ball / mobile btn
// ----------------------------------------------------------
function challengePlayer() {
    // Check for existing challenges first
    fetch('/get_my_challenges')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.challenges && data.challenges.length > 0) {
                alert('Sie haben bereits eine aktive Herausforderung. Bitte schliessen Sie diese zuerst ab.');
                var ball = document.querySelector('.ball');
                if (ball) ball.style.display = 'none';
                getMenu('challenges');
                return;
            }
            // No active challenge -> open creation flow
            getMenu('challenge', true);
            showStep1();
        })
        .catch(function(err) {
            console.error('Error:', err);
            alert('Ein Fehler ist aufgetreten.');
        });
}

function showStep1() {
    var step1 = document.getElementById('challenge-step1');
    var step2 = document.getElementById('challenge-step2');
    var activeDisplay = document.getElementById('challenge-active-display');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (activeDisplay) activeDisplay.innerHTML = '';
    syncChallengeDateInputs({ clearValue: true });

    // Set challenged player name from selection
    if (window.selectedPlayerData) {
        var name = window.selectedPlayerData.firstname + ' ' + window.selectedPlayerData.lastname;
        var el1 = document.getElementById('challenged-player-name');
        var el2 = document.getElementById('challenged-player-name-2');
        if (el1) el1.textContent = name;
        if (el2) el2.textContent = name;
    }

    document.getElementById('challenge-menu-title').textContent = 'Spieler Herausfordern';
}

function openNativeDatePicker(input) {
    if (!input) return;

    // iOS Safari often blocks programmatic clicks on fully hidden date inputs.
    // Temporarily place the input on-screen (nearly invisible), then restore.
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var restoreStyles = null;
    var restored = false;

    if (isIOS) {
        var previous = {
            position: input.style.position,
            left: input.style.left,
            bottom: input.style.bottom,
            width: input.style.width,
            height: input.style.height,
            opacity: input.style.opacity,
            pointerEvents: input.style.pointerEvents,
            zIndex: input.style.zIndex
        };

        input.style.position = 'fixed';
        input.style.left = '0';
        input.style.bottom = '0';
        input.style.width = '100vw';
        input.style.height = '44px';
        input.style.opacity = '0.01';
        input.style.pointerEvents = 'auto';
        input.style.zIndex = '2147483647';

        restoreStyles = function() {
            if (restored) return;
            restored = true;
            input.style.position = previous.position;
            input.style.left = previous.left;
            input.style.bottom = previous.bottom;
            input.style.width = previous.width;
            input.style.height = previous.height;
            input.style.opacity = previous.opacity;
            input.style.pointerEvents = previous.pointerEvents;
            input.style.zIndex = previous.zIndex;
        };
    }

    try {
        if (typeof input.showPicker === 'function') {
            input.showPicker();
        } else {
            input.focus();
            input.click();
        }
    } catch (e) {
        input.focus();
        input.click();
    }

    if (restoreStyles) {
        input.addEventListener('change', restoreStyles, { once: true });
        input.addEventListener('blur', restoreStyles, { once: true });
        setTimeout(restoreStyles, 1200);
    }
}

// ----------------------------------------------------------
// Date picker - cross-browser
// ----------------------------------------------------------
function openChallengeDatePicker() {
    var input = document.getElementById('challenge-date-input');
    if (!input) return;

    input.min = getTodayIsoDate();
    input.value = selectedChallengeDate || '';
    challengeDatePickerOpenedAt = Date.now();

    openNativeDatePicker(input);
}

function changeChallengeDatePicker() {
    openChallengeDatePicker();
}

function onChallengeDateSelected(value) {
    if (!value) return;

    var openedAgo = Date.now() - challengeDatePickerOpenedAt;
    // iOS Safari can auto-commit today's date immediately on first open.
    // Ignore this very fast auto-change and keep the user on step 1.
    if (selectedChallengeDate === null && value === getTodayIsoDate() && openedAgo >= 0 && openedAgo < 800) {
        var firstInput = document.getElementById('challenge-date-input');
        if (firstInput) firstInput.value = '';
        return;
    }

    selectedChallengeDate = value;

    // Format DD.MM.YYYY
    var parts = value.split('-');
    var formatted = parts[2] + '.' + parts[1] + '.' + parts[0];

    document.getElementById('challenge-selected-date').textContent = formatted;

    // Switch to step 2
    document.getElementById('challenge-step1').style.display = 'none';
    document.getElementById('challenge-step2').style.display = '';
}

// ----------------------------------------------------------
// Cancel creation flow
// ----------------------------------------------------------
function cancelChallenge() {
    resetChallengeState();
    if (typeof window.deselectAll === 'function') window.deselectAll();
    if (typeof closeMenu === 'function') closeMenu();
}

// ----------------------------------------------------------
// Submit new challenge (Bild2 -> "HERAUSFORDERUNG ERSTELLEN")
// ----------------------------------------------------------
function submitNewChallenge() {
    if (!window.selectedPlayerData) {
        alert('Kein Spieler ausgewaehlt');
        return;
    }
    if (!selectedChallengeDate) {
        alert('Bitte waehlen Sie ein Datum aus');
        return;
    }

    fetch('/create_challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            challenged_uid: window.selectedPlayerData.uid,
            match_date: selectedChallengeDate
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(function(err) {
        console.error('Error:', err);
        alert('Ein Fehler ist aufgetreten.');
    });
}

// ==============================================================
// Load & display active challenges
// ==============================================================
function loadMyChallenges() {
    fetch('/get_my_challenges')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var challenges = (data.challenges || []);
            window.myChallenges = challenges;

            // Show/hide challenge nav icons
            toggleChallengeIcons(challenges.length > 0);

            displayChallenges(challenges);
        })
        .catch(function(err) { console.error('Error loading challenges:', err); });
}

function toggleChallengeIcons(show) {
    var el = document.getElementById('challenges');
    if (el) el.style.display = show ? 'block' : 'none';
    var navCh = document.querySelector('.header-nav .nav-challenges');
    if (navCh) navCh.style.display = show ? '' : 'none';
    var mobNav = document.querySelector('.mobile-nav-challenges');
    if (mobNav) mobNav.style.display = show ? 'flex' : 'none';
}

// ----------------------------------------------------------
// Build challenge views based on status & role (Bild3-6)
// ----------------------------------------------------------
function displayChallenges(challenges) {
    var container = document.getElementById('challenge-active-display');
    var title = document.getElementById('challenge-menu-title');
    if (!container) return;
    container.innerHTML = '';

    // Hide creation steps when viewing existing challenges
    var step1 = document.getElementById('challenge-step1');
    var step2 = document.getElementById('challenge-step2');

    if (challenges.length === 0) {
        if (title) title.textContent = 'Keine Herausforderungen';
        // Keep creation steps visible if needed
        return;
    }

    // Hide creation UI when we have an active challenge
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'none';
    if (title) title.textContent = 'Ihre Herausforderung';

    challenges.forEach(function(ch) {
        var div = document.createElement('div');
        div.className = 'challenge-active-card';
        div.innerHTML = buildChallengeHTML(ch);
        container.appendChild(div);
    });
}

function buildChallengeHTML(ch) {
    var isChallenger = ch.role === 'challenger';
    var opponentName = ch.opponent_name;
    var opponentEmail = ch.opponent_email || '';
    var adminEmail = typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL : 'admin@example.com';

    // Description text
    var descText = isChallenger
        ? 'Sie haben ' + opponentName + ' zu einem Spiel herausgefordert.'
        : opponentName + ' hat Sie zu einem Spiel herausgefordert!';

    // Date display
    var dateStr = ch.match_date || 'Kein Datum';

    if (ch.status === 'pending') {
        if (isChallenger) {
            // === Bild4: Challenger view (pending) ===
            return '<p class="challenge-description">' + descText + '</p>' +
                '<div class="challenge-date-display">' +
                    '<span>' + dateStr + '</span>' +
                    '<img src="/static/images/calendar.svg" alt="Kalender" class="challenge-btn-icon">' +
                '</div>' +
                '<button class="challenge-btn challenge-btn-light" onclick="changePendingDate(' + ch.challenge_id + ')">DATUM \u00c4NDERN</button>' +
                '<input type="date" id="pending-date-input-' + ch.challenge_id + '" class="hidden-date-input" onchange="onPendingDateChanged(' + ch.challenge_id + ', this.value)">' +
                '<button class="challenge-btn challenge-btn-cancel" onclick="withdrawChallenge(' + ch.challenge_id + ')">HERAUSFORDERUNG ZUR\u00dcCKZIEHEN</button>' +
                '<div class="challenge-info-block">' +
                    '<div class="challenge-info-row">' +
                        '<img src="/static/images/alert-triangle.svg" class="challenge-info-icon" alt="Warnung">' +
                        '<p>Wenn dein Gegner die Herausforderung annimmt, kannst du sie nicht mehr zur\u00fcckziehen.</p>' +
                    '</div>' +
                '</div>' +
                '<div class="challenge-info-block">' +
                    '<div class="challenge-info-row">' +
                        '<img src="/static/images/alert-square.svg" class="challenge-info-icon" alt="Info">' +
                        '<p>Bei weiteren Problemen, melden Sie sich beim Administrator.</p>' +
                    '</div>' +
                    '<a href="javascript:void(0)" class="challenge-copy-email" onclick="copyEmailInline(this, \'' + adminEmail + '\')">Email-Adresse kopieren</a>' +
                '</div>';
        } else {
            // === Bild3: Challenged view (pending) ===
            return '<p class="challenge-description">' + descText + '</p>' +
                '<div class="challenge-date-display">' +
                    '<span>' + dateStr + '</span>' +
                    '<img src="/static/images/calendar.svg" alt="Kalender" class="challenge-btn-icon">' +
                '</div>' +
                '<button class="challenge-btn challenge-btn-light" onclick="acceptChallengeNew(' + ch.challenge_id + ')">HERAUSFORDERUNG ANNEHMEN</button>' +
                '<div class="challenge-info-block">' +
                    '<div class="challenge-info-row">' +
                        '<img src="/static/images/alert-square.svg" class="challenge-info-icon" alt="Info">' +
                        '<p>Wenn Sie mit dem vereinbarten Termin nicht einverstanden sind, melden Sie sich beim Herausforderer.</p>' +
                    '</div>' +
                    '<a href="javascript:void(0)" class="challenge-copy-email" onclick="copyEmailInline(this, \'' + opponentEmail + '\')">Email-Adresse kopieren</a>' +
                '</div>' +
                '<div class="challenge-info-block">' +
                    '<div class="challenge-info-row">' +
                        '<img src="/static/images/alert-square.svg" class="challenge-info-icon" alt="Info">' +
                        '<p>Bei weiteren Problemen, melden Sie sich beim Administrator.</p>' +
                    '</div>' +
                    '<a href="javascript:void(0)" class="challenge-copy-email" onclick="copyEmailInline(this, \'' + adminEmail + '\')">Email-Adresse kopieren</a>' +
                '</div>';
        }
    }

    if (ch.status === 'accepted') {
        var matchResult = ch.match_result;
        var myResultConfirmed = isChallenger ? ch.challenger_result_confirmed : ch.challenged_result_confirmed;
        var opponentResultConfirmed = isChallenger ? ch.challenged_result_confirmed : ch.challenger_result_confirmed;

        if (matchResult) {
            // Result has been entered
            if (myResultConfirmed && !opponentResultConfirmed) {
                // I entered the result, waiting for opponent -> Bild6
                return '<p class="challenge-description">' + descText + '</p>' +
                    '<div class="challenge-date-display">' +
                        '<span>' + dateStr + '</span>' +
                        '<img src="/static/images/calendar.svg" alt="Kalender" class="challenge-btn-icon">' +
                    '</div>' +
                    '<div class="challenge-date-display challenge-score-display">' +
                        '<span>' + formatResultForUser(matchResult, ch.role) + '</span>' +
                    '</div>' +
                    '<button class="challenge-btn challenge-btn-light" onclick="openResultModal(' + ch.challenge_id + ', \'' + ch.role + '\', \'' + matchResult + '\')">Spielergebnis \u00e4ndern</button>' +
                    '<div class="challenge-info-block">' +
                        '<div class="challenge-info-row">' +
                            '<img src="/static/images/alert-square.svg" class="challenge-info-icon" alt="Info">' +
                            '<p>Bei Problemen, melden Sie sich beim Administrator.</p>' +
                        '</div>' +
                        '<a href="javascript:void(0)" class="challenge-copy-email" onclick="copyEmailInline(this, \'' + adminEmail + '\')">Email-Adresse kopieren</a>' +
                    '</div>';
            } else if (!myResultConfirmed && opponentResultConfirmed) {
                // Opponent entered result, I need to confirm
                return '<p class="challenge-description">' + descText + '</p>' +
                    '<div class="challenge-date-display">' +
                        '<span>' + dateStr + '</span>' +
                        '<img src="/static/images/calendar.svg" alt="Kalender" class="challenge-btn-icon">' +
                    '</div>' +
                    '<div class="challenge-date-display challenge-score-display">' +
                        '<span>' + formatResultForUser(matchResult, ch.role) + '</span>' +
                    '</div>' +
                    '<button class="challenge-btn challenge-btn-light" onclick="confirmMatchResult(' + ch.challenge_id + ', \'' + ch.role + '\', \'' + matchResult + '\')">Spielergebnis best\u00e4tigen</button>' +
                    '<button class="challenge-btn challenge-btn-light" onclick="openResultModal(' + ch.challenge_id + ', \'' + ch.role + '\', \'' + matchResult + '\')">Spielergebnis \u00e4ndern</button>' +
                    '<div class="challenge-info-block">' +
                        '<div class="challenge-info-row">' +
                            '<img src="/static/images/alert-square.svg" class="challenge-info-icon" alt="Info">' +
                            '<p>Bei Problemen, melden Sie sich beim Administrator.</p>' +
                        '</div>' +
                        '<a href="javascript:void(0)" class="challenge-copy-email" onclick="copyEmailInline(this, \'' + adminEmail + '\')">Email-Adresse kopieren</a>' +
                    '</div>';
            }
        }

        // No result yet -> Bild5 (enter result)
        return '<p class="challenge-description">' + descText + '</p>' +
            '<div class="challenge-date-display">' +
                '<span>' + dateStr + '</span>' +
                '<img src="/static/images/calendar.svg" alt="Kalender" class="challenge-btn-icon">' +
            '</div>' +
            '<button class="challenge-btn challenge-btn-light" onclick="openResultModal(' + ch.challenge_id + ', \'' + ch.role + '\', \'\')">Spielergebnis eintragen</button>' +
            '<div class="challenge-info-block">' +
                '<div class="challenge-info-row">' +
                    '<img src="/static/images/alert-square.svg" class="challenge-info-icon" alt="Info">' +
                    '<p>Bei Problemen, melden Sie sich beim Administrator.</p>' +
                '</div>' +
                '<a href="javascript:void(0)" class="challenge-copy-email" onclick="copyEmailInline(this, \'' + adminEmail + '\')">Email-Adresse kopieren</a>' +
            '</div>';
    }

    return '';
}

// Format result for the user's perspective (always show "my : opponent")
function formatResultForUser(result, role) {
    if (!result || result.indexOf(':') === -1) return result;
    var parts = result.split(':');
    // Result is stored as challenger:challenged
    if (role === 'challenger') {
        return parts[0] + ' : ' + parts[1];
    } else {
        return parts[1] + ' : ' + parts[0];
    }
}

// ----------------------------------------------------------
// Actions
// ----------------------------------------------------------

// Bild4 -> Change date for pending challenge
function changePendingDate(challengeId) {
    var input = document.getElementById('pending-date-input-' + challengeId);
    if (!input) return;
    input.min = getTodayIsoDate();
    openNativeDatePicker(input);
}

function onPendingDateChanged(challengeId, value) {
    if (!value) return;
    fetch('/update_challenge_date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, new_date: value })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            loadMyChallenges();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(function(err) { console.error(err); alert('Ein Fehler ist aufgetreten.'); });
}

// Bild4 -> Withdraw (challenger only, pending only)
function withdrawChallenge(challengeId) {
    if (!confirm('Moechten Sie diese Herausforderung wirklich zurueckziehen?')) return;

    fetch('/withdraw_challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(function(err) { console.error(err); alert('Ein Fehler ist aufgetreten.'); });
}

// Bild3 -> Accept challenge (challenged only)
function acceptChallengeNew(challengeId) {
    fetch('/accept_challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            alert(data.message);
            loadMyChallenges();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(function(err) { console.error(err); alert('Ein Fehler ist aufgetreten.'); });
}

// Bild5/6 -> Confirm existing result
function confirmMatchResult(challengeId, role, result) {
    fetch('/submit_match_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, result: result })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            if (data.confirmed) {
                alert('Ergebnis bestaetigt und Match abgeschlossen!');
                location.reload();
            } else {
                alert('Ergebnis bestaetigt. Warten auf den anderen Spieler.');
                loadMyChallenges();
            }
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(function(err) { console.error(err); alert('Ein Fehler ist aufgetreten.'); });
}

// Result modal
function openResultModal(challengeId, role, currentResult) {
    document.getElementById('result-challenge-id').value = challengeId;
    document.getElementById('result-user-role').value = role;

    var mySets = '0', opponentSets = '0';
    if (currentResult && currentResult.indexOf(':') !== -1) {
        var parts = currentResult.split(':');
        if (role === 'challenger') {
            mySets = parts[0]; opponentSets = parts[1];
        } else {
            mySets = parts[1]; opponentSets = parts[0];
        }
    }
    document.getElementById('my-sets').value = mySets;
    document.getElementById('opponent-sets').value = opponentSets;
    document.getElementById('result-modal').style.display = 'flex';
}

function closeResultModal() {
    document.getElementById('result-modal').style.display = 'none';
}

function submitResult() {
    var challengeId = document.getElementById('result-challenge-id').value;
    var role = document.getElementById('result-user-role').value;
    var mySets = document.getElementById('my-sets').value;
    var opponentSets = document.getElementById('opponent-sets').value;

    if (mySets === opponentSets) {
        alert('Unentschieden ist in diesem Modus nicht moeglich.');
        return;
    }

    // Result stored as challenger:challenged
    var resultString = role === 'challenger'
        ? mySets + ':' + opponentSets
        : opponentSets + ':' + mySets;

    fetch('/submit_match_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, result: resultString })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            if (data.confirmed) {
                alert('Ergebnis bestaetigt und Match abgeschlossen!');
                location.reload();
            } else {
                alert('Ergebnis eingetragen. Der andere Spieler muss noch bestaetigen.');
                closeResultModal();
                loadMyChallenges();
            }
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(function(err) { console.error(err); alert('Ein Fehler ist aufgetreten.'); });
}

// ----------------------------------------------------------
// Utility: copy email to clipboard
// ----------------------------------------------------------
function copyEmailInline(linkElement, email) {
    if (!email) return;
    var originalText = linkElement.textContent;
    if (originalText === 'Kopiert!') return;

    function showCopied() {
        linkElement.textContent = 'Kopiert!';
        setTimeout(function() {
            linkElement.textContent = originalText;
        }, 1500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(showCopied).catch(function() {
            fallbackCopyInline(email, showCopied);
        });
    } else {
        fallbackCopyInline(email, showCopied);
    }
}

function fallbackCopyInline(email, onSuccess) {
    var ta = document.createElement('textarea');
    ta.value = email;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); onSuccess(); }
    catch(e) { /* silent */ }
    document.body.removeChild(ta);
}

// ----------------------------------------------------------
// Init
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    syncChallengeDateInputs({ clearValue: true });
    loadMyChallenges();
});
