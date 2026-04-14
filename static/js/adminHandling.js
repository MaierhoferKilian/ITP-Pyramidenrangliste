function renderAdminChallenges(challenges) {
    var container = document.getElementById('admin-challenges-container');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!challenges || challenges.length === 0) {
        container.innerHTML = '<p>Keine aktiven Herausforderungen gefunden.</p>';
        return;
    }

    challenges.forEach(function(ch) {
        var card = document.createElement('div');
        card.className = 'challenge-active-card admin-card';

        card.innerHTML =
            '<div class="challenge-headline-container">' +
                '<div class="challenge-headline">' +
                    '<h4>HERAUSFORDERUNG #' + ch.challenge_id + '</h4>' +
                    '<span class="admin-status-tag">' + ch.status.toUpperCase() + '</span>' +
                '</div>' +
                '<p><strong>Challenger:</strong> ' + ch.challenger_name + ' (' + ch.challenger_email + ')</p>' +
                '<p><strong>Challenged:</strong> ' + ch.challenged_name + ' (' + ch.challenged_email + ')</p>' +
                '<p><strong>Erstellt:</strong> ' + (ch.challenge_date || '-') + ' | <strong>Deadline:</strong> ' + (ch.deadline_date || '-') + '</p>' +
                '<p><strong>Spieltermin:</strong> ' + (ch.match_date || '-') + '</p>' +
            '</div>' +
            '<button class="challenge-btn challenge-btn-cancel" onclick="adminDeleteChallenge(' + ch.challenge_id + ')">AKTIVE HERAUSFORDERUNG LÖSCHEN</button>';

        container.appendChild(card);
    });
}

function renderAdminBlockedPlayers(blockedPlayers) {
    var blockedList = document.getElementById('admin-blocked-list');
    if (!blockedList) {
        return;
    }

    blockedList.innerHTML = '';

    if (!blockedPlayers || blockedPlayers.length === 0) {
        blockedList.innerHTML = '<p>Keine aktiven Sperren.</p>';
        return;
    }

    blockedPlayers.forEach(function(player) {
        var row = document.createElement('div');
        row.className = 'admin-block-row';
        row.innerHTML =
            '<div>' +
                '<h4>' + player.name + '</h4>' +
                '<p>' + player.email + '</p>' +
                '<p>Gesperrt bis: ' + player.blocked_until + '</p>' +
            '</div>' +
            '<button class="challenge-btn challenge-btn-light admin-inline-btn" onclick="adminUnblockPlayer(\'' + player.uid + '\')">SPERRE AUFHEBEN</button>';
        blockedList.appendChild(row);
    });
}

function renderAdminPlayerSelect(players) {
    var select = document.getElementById('admin-player-select');
    if (!select) {
        return;
    }

    select.innerHTML = '';

    if (!players || players.length === 0) {
        var emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = 'Keine Spieler verfügbar';
        select.appendChild(emptyOpt);
        return;
    }

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Spieler auswählen';
    select.appendChild(placeholder);

    players.forEach(function(player) {
        var opt = document.createElement('option');
        opt.value = player.uid;
        opt.textContent = player.name + ' (' + player.email + ')';
        select.appendChild(opt);
    });
}

function loadAdminChallenges() {
    fetch('/admin/active_challenges')
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.error) {
                alert(data.error);
                return;
            }
            renderAdminChallenges(data.challenges || []);
        })
        .catch(function(error) {
            console.error('Error loading admin challenges:', error);
            var container = document.getElementById('admin-challenges-container');
            if (container) {
                container.innerHTML = '<p>Fehler beim Laden der Herausforderungen.</p>';
            }
        });
}

function loadAdminBlocks() {
    fetch('/admin/blocked_players')
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.error) {
                alert(data.error);
                return;
            }
            renderAdminBlockedPlayers(data.blocked_players || []);
            renderAdminPlayerSelect(data.players || []);
        })
        .catch(function(error) {
            console.error('Error loading blocked players:', error);
        });
}

function adminDeleteChallenge(challengeId) {
    if (!confirm('Moechten Sie diese aktive Herausforderung wirklich loeschen?')) {
        return;
    }

    fetch('/admin/delete_challenge', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ challenge_id: challengeId })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data.success) {
            loadAdminChallenges();
            return;
        }
        alert(data.error || 'Fehler beim Loeschen der Herausforderung.');
    })
    .catch(function(error) {
        console.error('Error deleting challenge:', error);
        alert('Fehler beim Loeschen der Herausforderung.');
    });
}

function adminUnblockPlayer(playerUid) {
    fetch('/admin/unblock_player', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ player_uid: playerUid })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data.success) {
            loadAdminBlocks();
            return;
        }
        alert(data.error || 'Fehler beim Aufheben der Sperre.');
    })
    .catch(function(error) {
        console.error('Error unblocking player:', error);
        alert('Fehler beim Aufheben der Sperre.');
    });
}

function adminBlockPlayer() {
    var playerSelect = document.getElementById('admin-player-select');
    var blockUntilInput = document.getElementById('admin-block-until');

    if (!playerSelect || !blockUntilInput) {
        return;
    }

    if (!playerSelect.value) {
        alert('Bitte zuerst einen Spieler auswaehlen.');
        return;
    }

    if (!blockUntilInput.value) {
        alert('Bitte ein Sperrdatum auswaehlen.');
        return;
    }

    fetch('/admin/block_player', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            player_uid: playerSelect.value,
            blocked_until: blockUntilInput.value
        })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data.success) {
            loadAdminBlocks();
            return;
        }
        alert(data.error || 'Fehler beim Sperren des Spielers.');
    })
    .catch(function(error) {
        console.error('Error blocking player:', error);
        alert('Fehler beim Sperren des Spielers.');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    var blockUntilInput = document.getElementById('admin-block-until');
    if (blockUntilInput) {
        var today = new Date();
        var yyyy = today.getFullYear();
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var dd = String(today.getDate()).padStart(2, '0');
        blockUntilInput.min = yyyy + '-' + mm + '-' + dd;
    }

    loadAdminChallenges();
    loadAdminBlocks();
});
