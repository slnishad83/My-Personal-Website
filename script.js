// ========================================
// NISHADSL.COM - Interactive Features
// ========================================

// Theme Toggle (Dark/Light Mode)
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (body.classList.contains('dark')) {
        body.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if (themeToggle) themeToggle.textContent = '🌙';
    } else {
        body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if (themeToggle) themeToggle.textContent = '☀️';
    }
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        if (themeToggle) themeToggle.textContent = '☀️';
    } else {
        document.body.classList.remove('dark');
        if (themeToggle) themeToggle.textContent = '🌙';
    }
}

// Mobile Menu Toggle
function toggleMenu() {
    const navMenu = document.getElementById('navMenu');
    if (navMenu) navMenu.classList.toggle('active');
}

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        const navMenu = document.getElementById('navMenu');
        if (navMenu) navMenu.classList.remove('active');
    });
});

// Copy Contact Information
function copyContact() {
    const contactText = "Nishad S L\nSenior Digital Marketing Specialist\n\nPhone: +91 9846310043\nEmail: sl.nishad@gmail.com\nLocation: Thrissur, Kerala, India\nLinkedIn: https://www.linkedin.com/in/nishadsl/";
    
    navigator.clipboard.writeText(contactText).then(() => {
        alert("✓ Contact information copied to clipboard!");
    }).catch(() => {
        alert("Please manually copy the contact details.");
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href !== '') {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

// ========================================
// MODERN BACK TO TOP BUTTON (2026)
// ========================================

const backToTopBtn = document.getElementById('modernBackToTop');

function handleBackToTopVisibility() {
    if (backToTopBtn) {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

if (backToTopBtn) {
    window.addEventListener('scroll', handleBackToTopVisibility);
    backToTopBtn.addEventListener('click', scrollToTop);
    handleBackToTopVisibility();
}

// ========================================
// AUTO UPDATE CURRENT YEAR IN FOOTER
// ========================================

const yearElement = document.getElementById('currentYear');
if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}

// ========================================
// LOAD THEME ON PAGE LOAD
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    loadTheme();
});