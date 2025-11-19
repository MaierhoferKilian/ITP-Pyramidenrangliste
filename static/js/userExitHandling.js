function Logout() {
    window.location.href = '/logout';
}

function LeaveRanking() {
    if (confirm('Möchten Sie die Rangliste wirklich verlassen? Sie werden für 1 Woche blockiert.')) {
        fetch('/leave_ranking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
                window.location.href = '/logout';
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
