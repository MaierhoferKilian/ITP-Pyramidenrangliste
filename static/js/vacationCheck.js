function isVacationPeriod(date) {
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const day = date.getDate();
    
    // Summer vacation: July and August
    if (month === 7 || month === 8) {
        return true;
    }
    
    // Winter holidays: December 24 to January 6
    if ((month === 12 && day >= 10) || (month === 1 && day <= 6)) {
        return true;
    }
    
    return false;
}

function getNextAvailableDate(startDate) {
    let currentDate = new Date(startDate);
    let maxAttempts = 365;
    let attempts = 0;
    
    while (isVacationPeriod(currentDate) && attempts < maxAttempts) {
        currentDate.setDate(currentDate.getDate() + 1);
        attempts++;
    }
    
    return currentDate;
}

function showVacationWarning() {
    const today = new Date();
    
    if (isVacationPeriod(today)) {
        const nextAvailable = getNextAvailableDate(today);
        const formattedDate = nextAvailable.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        
        // Show vacation warning in side menu
        const vacationContainer = document.getElementById('vacation-warning-sidemenu');
        const nextDateElement = document.getElementById('next-available-date-sidemenu');
        
        if (vacationContainer && nextDateElement) {
            nextDateElement.textContent = `Nächster verfügbarer Termin: ${formattedDate}`;
            vacationContainer.style.display = 'block';
        }
        
        return true;
    }
    
    return false;
}


// Add click handler to challenge button
document.addEventListener('DOMContentLoaded', function() {
    const challengeButton = document.querySelector('.ball');
    if (challengeButton) {
        challengeButton.addEventListener('click', function(e) {
            if (isVacationPeriod(new Date())) {
                e.preventDefault();
                e.stopPropagation();
                // Use the existing menu switch function, then show vacation warning
                getMenu('player');
                showVacationWarning();
            }
        });
    }
});

// Export functions for use in other scripts
window.isVacationPeriod = isVacationPeriod;
window.showVacationWarning = showVacationWarning;
window.hideVacationWarning = hideVacationWarning;
