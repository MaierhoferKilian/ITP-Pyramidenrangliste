function loadMatchHistory() {
    console.log("Loading match history...");
    const container = document.getElementById('match-history-content');
    container.innerHTML = '<p>Lade Daten...</p>';
    
    fetch('/get_match_history')
        .then(response => response.json())
        .then(data => {
            container.innerHTML = '';
            
            if (!data.history || data.history.length === 0) {
                container.innerHTML = '<p>Keine vergangenen Spiele gefunden.</p>';
            } else {
                // Same styling as in other side menus
                
                data.history.forEach(match => {
                    const matchDiv = document.createElement('div');
                    matchDiv.style.marginBottom = '20px';
                    matchDiv.style.paddingBottom = '20px';
                    matchDiv.style.borderBottom = '1px solid #ddd';
                    
                    matchDiv.innerHTML = `
                        <div style="font-size: 0.9em; color: #666; margin-bottom: 5px;">${match.date}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1; text-align: left;">
                                <div style="font-weight: bold; font-size: 0.9em;">CHALLENGER</div>
                                <div>${match.challenger}</div>
                            </div>
                            <div style="font-weight: 900; font-size: 1.5em; padding: 0 15px; letter-spacing: 2px;">
                                ${match.result}
                            </div>
                            <div style="flex: 1; text-align: right;">
                                <div style="font-weight: bold; font-size: 0.9em;">CHALLENGED</div>
                                <div>${match.challenged}</div>
                            </div>
                        </div>
                    `;
                    container.appendChild(matchDiv);
                });
            }
        })
        .catch(error => {
            console.error('Error fetching match history:', error);
            container.innerHTML = '<p>Fehler beim Laden des Spielberichts.</p>';
        });
}
