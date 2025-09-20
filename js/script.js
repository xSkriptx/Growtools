// Visitor count API with monthly tracking
async function updateVisitorCount() {
    try {
        // Get current month and year for monthly tracking
        const now = new Date();
        const monthYear = `${now.getMonth()}-${now.getFullYear()}`;
        
        // Check if we have a monthly count stored
        let monthlyCount = localStorage.getItem(`visits-${monthYear}`);
        if (!monthlyCount) {
            monthlyCount = 0;
        } else {
            monthlyCount = parseInt(monthlyCount);
        }
        
        // Increment monthly count
        monthlyCount++;
        localStorage.setItem(`visits-${monthYear}`, monthlyCount);
        
        // Update display with monthly count
        document.getElementById('visitorCount').textContent = monthlyCount.toLocaleString();
        
        // Also update the global count using the API (optional)
        const response = await fetch('https://api.countapi.xyz/hit/growtools/visits');
        const data = await response.json();
        
    } catch (error) {
        console.error('Error handling visitor count:', error);
        // Fallback to localStorage data only
        const monthlyCount = localStorage.getItem(`visits-${monthYear}`) || "1,000+";
        document.getElementById('visitorCount').textContent = monthlyCount;
    }
}

// Set active navigation link based on current page
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    updateVisitorCount();
    setActiveNavLink();
    
    // Add any other initialization code here
});

// Set active navigation link based on current page
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setActiveNavLink();
    
    // Add any other initialization code here
});
