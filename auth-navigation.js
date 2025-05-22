// Navigation and Authentication Module
window.shutokun = window.shutokun || {};
shutokun.nav = {
    init() {
        this.initNavigation();
        this.initAuthButtons();
    },

    initNavigation() {
        const hamburgerMenu = document.getElementById('hamburger-menu');
        const navMenu = document.getElementById('nav-menu');
        
        if (hamburgerMenu && navMenu) {
            // Create overlay element if it doesn't exist
            let menuOverlay = document.querySelector('.menu-overlay');
            if (!menuOverlay) {
                menuOverlay = document.createElement('div');
                menuOverlay.className = 'menu-overlay';
                document.body.appendChild(menuOverlay);
            }

            // Toggle menu function
            const toggleMenu = () => {
                hamburgerMenu.classList.toggle('active');
                navMenu.classList.toggle('active');
                menuOverlay.classList.toggle('active');
                document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
            };

            // Event listeners
            hamburgerMenu.addEventListener('click', toggleMenu);
            menuOverlay.addEventListener('click', toggleMenu);

            // Close menu when clicking a link
            const navLinks = navMenu.querySelectorAll('a');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    if (navMenu.classList.contains('active')) {
                        toggleMenu();
                    }
                });
            });
        }
    },

    initAuthButtons() {
        // Initialize auth buttons
        ['loginBtn', 'loginBtnHeader', 'loginBtnNav'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => window.signInWithGoogle?.());
        });
        
        ['logoutBtn', 'logoutBtnHeader', 'logoutBtnNav'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => window.signOut?.());
        });
    }
};

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    shutokun.nav.init();
});
