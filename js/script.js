
async function updateVisitorCount() {
    try {

        const now = new Date();
        const monthYear = `${now.getMonth()}-${now.getFullYear()}`;
        
        let monthlyCount = localStorage.getItem(`visits-${monthYear}`);
        if (!monthlyCount) {
            monthlyCount = 0;
        } else {
            monthlyCount = parseInt(monthlyCount);
        }
        
   
        monthlyCount++;
        localStorage.setItem(`visits-${monthYear}`, monthlyCount);
        

        document.getElementById('visitorCount').textContent = monthlyCount.toLocaleString();
        

        const response = await fetch('https://api.countapi.xyz/hit/growtools/visits');
        const data = await response.json();
        
    } catch (error) {
        console.error('Error handling visitor count:', error);

        const monthlyCount = localStorage.getItem(`visits-${monthYear}`) || "1,000+";
        document.getElementById('visitorCount').textContent = monthlyCount;
    }
}

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

document.addEventListener('DOMContentLoaded', function() {
    updateVisitorCount();
    setActiveNavLink();
    
});

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

document.addEventListener('DOMContentLoaded', function() {
    setActiveNavLink();
    
    // Add any other initialization code here
});
