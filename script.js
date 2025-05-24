let vocab = [];
let currentIndex = 0;
let showAnswerBtn;
let srsButtons;
let currentUser = null;

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB8D99bt_z2FtMeRDY-gdDYFMqqceZV_2s",
  authDomain: "shutokun.firebaseapp.com",
  databaseURL: "https://shutokun-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "shutokun",
  storageBucket: "shutokun.firebasestorage.app",
  messagingSenderId: "120770573657",
  appId: "1:120770573657:web:692c54b821b0a51c138848",
  measurementId: "G-GJG5NT05DH"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// --- FIX: Remove offline persistence for Realtime Database ---
// Realtime Database does not require enablePersistence (Firestore only)
// if (window.firebaseDB && typeof window.firebaseDB.enableOfflinePersistence === 'function') {
//     window.firebaseDB.enableOfflinePersistence().catch(error => {
//         console.error("Failed to enable offline persistence:", error);
//     });
// }

// --- FIX: Add mergeProgressData utility ---
// Merge two vocab arrays (with srs) by index (or id if available)
function mergeProgressData(serverData, localData) {
    // If items have unique IDs, use them for matching; otherwise, fallback to index
    return serverData.map((item, i) => {
        const localItem = localData[i] || {};
        return {
            ...item,
            srs: {
                ...item.srs,
                ...localItem.srs // Local progress takes precedence
            }
        };
    });
}

// Auth state observer
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
        console.log("User is signed in:", user.displayName);
        
        // Load user's progress if we're on the SRS page
        if (window.location.pathname.includes('srs-ui.html')) {
            await loadProgress();
        }
    } else {
        // User is signed out
        currentUser = null;
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'none';
        console.log("User is signed out");
    }
});

function updateReviewQueueCounts() {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Count cards in different states
    const counts = vocab.reduce((acc, item) => {
        if (!item.srs.dueDate) {
            return acc;
        }
        
        const daysUntilDue = Math.ceil((item.srs.dueDate - now) / oneDayMs);
        
        if (daysUntilDue < 0) {
            acc.overdue++;
        } else if (daysUntilDue === 0) {
            acc.dueToday++;
        } else if (daysUntilDue <= 7) { // Show upcoming reviews for next 7 days
            acc.upcoming++;
        }
        
        return acc;
    }, { overdue: 0, dueToday: 0, upcoming: 0 });
    
    // Update the display
    document.getElementById('overdue-count').textContent = counts.overdue;
    document.getElementById('due-today-count').textContent = counts.dueToday;
    document.getElementById('upcoming-count').textContent = counts.upcoming;
    
    // Update the document title to show number of cards due
    const totalDue = counts.overdue + counts.dueToday;
    if (totalDue > 0) {
        document.title = `(${totalDue}) Shutokun - SRS Study`;
    } else {
        document.title = 'Shutokun - SRS Study';
    }
}

// Performance optimization: Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Performance optimization: Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Error handling utility
function showError(message, duration = 5000) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, duration);
    } else {
        console.error(message);
    }
}

// Loading state management
function showLoading() {
    const loadingElement = document.getElementById('loading-overlay');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingElement = document.getElementById('loading-overlay');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Sync status management
function updateSyncStatus(status, message) {
    const syncElement = document.getElementById('sync-status');
    if (syncElement) {
        syncElement.textContent = message;
        syncElement.className = `sync-status ${status}`;
        syncElement.style.display = 'block';
        setTimeout(() => {
            syncElement.style.display = 'none';
        }, 3000);
    }
}

// Sync queue management
const syncQueue = {
    queue: [],
    isProcessing: false,
    
    add: function(data) {
        this.queue.push({
            data,
            timestamp: Date.now(),
            retries: 0
        });
        this.process();
    },
    
    process: async function() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        const item = this.queue[0];
        
        try {
            await saveProgress(item.data);
            this.queue.shift(); // Remove processed item
            updateSyncStatus('synced', 'Progress saved');
        } catch (error) {
            const errMsg = error && (error.stack || error.message || JSON.stringify(error));
            console.error('Sync error:', errMsg);
            item.retries++;
            
            if (item.retries < 3) {
                // Retry after exponential backoff
                setTimeout(() => {
                    this.isProcessing = false;
                    this.process();
                }, Math.pow(2, item.retries) * 1000);
            } else {
                // Move to failed queue after max retries
                this.queue.shift();
                updateSyncStatus('error', 'Failed to sync after multiple attempts');
                showError('Failed to sync. Changes will be saved locally.');
            }
        }
        
        this.isProcessing = false;
        if (this.queue.length > 0) {
            this.process();
        }
    }
};

// Optimized progress saving with debounce
const debouncedSaveProgress = debounce(async () => {
    try {
        updateSyncStatus('syncing', 'Saving progress...');
        await saveProgress();
        updateSyncStatus('synced', 'Progress saved');
    } catch (error) {
        console.error('Error saving progress:', error);
        updateSyncStatus('error', 'Failed to save progress');
        showError('Failed to save progress. Changes will be saved locally.');
    }
}, 1000);

// Optimized UI updates with throttle
const throttledUpdateUI = throttle(() => {
    updateProgressDisplay();
    updateReviewQueueCounts();
}, 100);

// Enhanced error handling for Firebase operations
async function fetchVocab() {
    showLoading();
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get("mode");
        if (mode === "free") {
            // Free Mode: Load vocab from localStorage
            const localVocab = localStorage.getItem('vocabulary');
            if (!localVocab) {
                showError('No vocabulary found. Please import and save vocabulary first.');
                setTimeout(() => window.location.href = 'free-mode-import.html', 2000);
                return;
            }
            vocab = JSON.parse(localVocab);
            // Load SRS progress for Free Mode
            const srsProgress = localStorage.getItem('srsData_free');
            if (srsProgress) {
                const progressArr = JSON.parse(srsProgress);
                vocab = vocab.map((item, i) => ({
                    ...item,
                    srs: progressArr[i]?.srs || {
                        easeFactor: 2.5,
                        interval: 1,
                        repetitions: 0,
                        lastReviewed: null,
                        dueDate: null
                    }
                }));
            } else {
                vocab = vocab.map(item => ({
                    ...item,
                    srs: {
                        easeFactor: item.srs?.easeFactor ?? 2.5,
                        interval: item.srs?.interval ?? 1,
                        repetitions: item.srs?.repetitions ?? 0,
                        lastReviewed: item.srs?.lastReviewed ?? null,
                        dueDate: item.srs?.dueDate ?? null
                    }
                }));
            }
            throttledUpdateUI();
            showWord();
            hideLoading();
            return;
        }
        const level = urlParams.get("level");
        const category = urlParams.get("category") || "goi";
        if (!level) {
            throw new Error("Level parameter is missing in the URL.");
        }

        // Fetch vocabulary data
        const response = await fetch(`jlpt-db/${category}/${level}-${category}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Initialize SRS data
        vocab = data.map(item => ({
            ...item,
            srs: {
                easeFactor: 2.5,
                interval: 1,
                repetitions: 0,
                lastReviewed: null,
                dueDate: null,
                ...(item.srs || {})
            }
        }));

        await loadProgress();
        throttledUpdateUI();
        showWord();
    } catch (error) {
        console.error("Failed to fetch vocabulary:", error);
        showError("Failed to load vocabulary. Please try again.");
    } finally {
        hideLoading();
    }
}

// Network status monitoring
let isOnline = navigator.onLine;
window.addEventListener('online', () => {
    isOnline = true;
    updateSyncStatus('syncing', 'Back online. Syncing...');
    debouncedSaveProgress();
});
window.addEventListener('offline', () => {
    isOnline = false;
    updateSyncStatus('error', 'Offline mode');
    showError('You are offline. Changes will be saved locally.');
});

// Enhanced progress saving with sync queue
async function saveProgress(data = null) {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get("mode");
    // --- FIX: Always save vocab (with srs) for server/local ---
   // const dataToSave = data || vocab;
   const dataToSave = (data || vocab).map(item => ({
    ...item,
    reading: item.readings && item.readings.hiragana ? item.readings.hiragana.join(', ') : '',
    meaning: item.meanings && item.meanings.en ? item.meanings.en.join(', ') : '',
}));
    if (mode === "free") {
        // Save SRS progress for Free Mode
        try {
            localStorage.setItem("srsData_free", JSON.stringify(vocab));
            return true;
        } catch (error) {
            console.error("Error saving Free Mode progress to localStorage:", error);
            showError("Failed to save Free Mode progress locally.");
            return false;
        }
    }
    
    if (currentUser && isOnline) {
        try {
            const level = new URLSearchParams(window.location.search).get("level");
            const category = new URLSearchParams(window.location.search).get("category") || "goi";
            
            // Get current server version
            const currentData = await window.firebaseDB.loadUserProgress(currentUser.uid, `${level}-${category}`);
            
            // Merge with server data if it exists
            if (currentData) {
                const mergedData = mergeProgressData(currentData, dataToSave);
                await window.firebaseDB.saveUserProgress(currentUser.uid, `${level}-${category}`, mergedData);
            } else {
                await window.firebaseDB.saveUserProgress(currentUser.uid, `${level}-${category}`, dataToSave);
            }
            
            // Update local storage as backup
            localStorage.setItem("srsData", JSON.stringify(dataToSave));
            localStorage.setItem("lastSync", Date.now().toString());
            
            return true;
        } catch (error) {
            console.error("Error saving to Firebase:", error);
            // Add to sync queue for retry
            syncQueue.add(dataToSave);
            throw error;
        }
    }

    // Fallback to localStorage
    try {
        localStorage.setItem("srsData", JSON.stringify(dataToSave));
        localStorage.setItem("lastSync", Date.now().toString());
        return true;
    } catch (error) {
        console.error("Error saving to localStorage:", error);
        showError("Failed to save progress locally.");
        return false;
    }
}

// Enhanced progress loading with sync status
async function loadProgress() {
    if (!currentUser) {
        try {
            const saved = localStorage.getItem("srsData");
            if (saved) {
                const savedData = JSON.parse(saved);
                if (Array.isArray(savedData)) {
                    savedData.forEach((item, i) => {
                        if (vocab[i] && item && item.srs) vocab[i].srs = item.srs;
                    });
                }
            }
        } catch (error) {
            console.error("Error loading from localStorage:", error);
            showError("Failed to load local progress data.");
        }
        return;
    }

    showLoading();
    try {
        const level = new URLSearchParams(window.location.search).get("level");
        const category = new URLSearchParams(window.location.search).get("category") || "goi";
        // Check if we need to sync
        const lastSync = localStorage.getItem("lastSync");
        const needsSync = !lastSync || (Date.now() - parseInt(lastSync)) > 5 * 60 * 1000; // 5 minutes
        if (needsSync && isOnline) {
            updateSyncStatus('syncing', 'Syncing with server...');
            const savedData = await window.firebaseDB.loadUserProgress(currentUser.uid, `${level}-${category}`);
            if (Array.isArray(savedData)) {
                // Merge with local data
                const localData = JSON.parse(localStorage.getItem("srsData") || "[]");
                const mergedData = mergeProgressData(savedData, localData);
                if (Array.isArray(mergedData)) {
                    mergedData.forEach((item, i) => {
                        if (vocab[i] && item && item.srs) vocab[i].srs = item.srs;
                    });
                }
                // Save merged data back to server
                await saveProgress(mergedData);
            }
        } else {
            // Load from local storage
            const saved = localStorage.getItem("srsData");
            if (saved) {
                const savedData = JSON.parse(saved);
                if (Array.isArray(savedData)) {
                    savedData.forEach((item, i) => {
                        if (vocab[i] && item && item.srs) vocab[i].srs = item.srs;
                    });
                }
            }
        }
        
        // Listen for real-time updates
        window.addEventListener('progressUpdated', (event) => {
            const updatedData = event.detail.data;
            if (Array.isArray(updatedData)) {
                updatedData.forEach((item, i) => {
                    if (vocab[i] && item && item.srs) vocab[i].srs = item.srs;
                });
            }
            throttledUpdateUI();
        });
        
        throttledUpdateUI();
    } catch (error) {
        console.error("Error loading progress:", error);
        showError("Failed to load progress from server. Using local data.");
        // Fallback to localStorage
        const saved = localStorage.getItem("srsData");
        if (saved) {
            try {
                const savedData = JSON.parse(saved);
                if (Array.isArray(savedData)) {
                    savedData.forEach((item, i) => {
                        if (vocab[i] && item && item.srs) vocab[i].srs = item.srs;
                    });
                }
            } catch (parseError) {
                console.error("Error parsing localStorage data:", parseError);
            }
        }
    } finally {
        hideLoading();
    }
}

// Keyboard shortcuts
const keyboardShortcuts = {
    init() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case ' ': // Space bar to show answer
                    if (showAnswerBtn && showAnswerBtn.style.display !== 'none') {
                        showAnswerBtn.click();
                    }
                    break;
                case '1': // 1 for "Don't Know"
                    if (srsButtons && srsButtons.style.display !== 'none') {
                        document.getElementById('dont-know-btn').click();
                    }
                    break;
                case '2': // 2 for "Know"
                    if (srsButtons && srsButtons.style.display !== 'none') {
                        document.getElementById('know-btn').click();
                    }
                    break;
                case 'd': // Toggle dark mode
                    toggleDarkMode();
                    break;
            }
        });
    }
};

// Dark mode support
const darkMode = {
    init() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        }
        
        // Add theme toggle button
        const themeToggle = document.createElement('button');
        themeToggle.id = 'theme-toggle';
        themeToggle.innerHTML = '🌙';
        themeToggle.title = 'Toggle dark mode';
        themeToggle.onclick = toggleDarkMode;
        document.body.appendChild(themeToggle);
    }
};

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-toggle').innerHTML = isDark ? '☀️' : '🌙';
}

// Sound effects
const soundEffects = {
    correct: new Audio('assets/sounds/correct.mp3'),
    incorrect: new Audio('assets/sounds/incorrect.mp3'),
    showAnswer: new Audio('assets/sounds/show-answer.mp3'),
    
    play(sound) {
        if (this[sound]) {
            this[sound].currentTime = 0;
            this[sound].play().catch(e => console.log('Audio play failed:', e));
        }
    }
};

// Enhanced review result with sound effects
function reviewResult(isCorrect) {
    const item = vocab[currentIndex];
    const srs = item.srs;
    const now = Date.now();

    // Play sound effect
    soundEffects.play(isCorrect ? 'correct' : 'incorrect');

    // 上限値の設定
    const MAX_REPETITIONS = 10;
    const MAX_INTERVAL = 365; // 1年
    const MIN_EASE = 1.3;
    const MAX_EASE = 2.5;

    if (isCorrect) {
        srs.repetitions = Math.min(srs.repetitions + 1, MAX_REPETITIONS);
        srs.easeFactor = Math.min(MAX_EASE, Math.max(MIN_EASE, srs.easeFactor - 0.15 + 0.1 * srs.repetitions));
        if (srs.repetitions === 1) {
            srs.interval = 1;
        } else if (srs.repetitions === 2) {
            srs.interval = 3;
        } else {
            srs.interval = Math.round(srs.interval * srs.easeFactor);
        }
    } else {
        srs.repetitions = Math.max(0, srs.repetitions - 1);
        srs.easeFactor = Math.max(MIN_EASE, srs.easeFactor - 0.2);
        srs.interval = 1;
    }

    // intervalの上限
    srs.interval = Math.min(srs.interval, MAX_INTERVAL);

    srs.lastReviewed = now;
    srs.dueDate = now + (srs.interval * 24 * 60 * 60 * 1000);

    saveProgress();
    findNextDueCard();
    updateReviewQueueCounts();
    showWord();
    updateProgressDisplay();
}

// Enhanced show word with sound effect
function showWord() {
    const word = vocab[currentIndex];
    const cardContainer = document.querySelector(".card-container");
    cardContainer.innerHTML = '';

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <center>
        <h2>${word.word}</h2>
        </center>
        <p class="hidden-on-start"><strong>Reading:</strong> ${word.readings && word.readings.hiragana ? word.readings.hiragana.join(', ') : ''}</p>
        <p class="hidden-on-start"><strong>Meaning:</strong> ${word.meanings && word.meanings.en ? word.meanings.en.join(', ') : ''}</p>
        <p class="hidden-on-start"><strong>Romaji:</strong> ${word.romaji || ''}</p>
        <p class="hidden-on-start"><strong>Example:</strong><br>${word.examples && word.examples[0] ? word.examples[0].jp : ''}<br>${word.examples && word.examples[0] ? word.examples[0].en : ''}</p>
    `;
    cardContainer.appendChild(card);

    // Reset button states
    const showAnswerBtn = document.getElementById("show-answer-btn");
    const srsButtons = document.querySelector(".srs-button-container");
    const meaningElements = document.querySelectorAll(".card .hidden-on-start");

    showAnswerBtn.style.display = "block";
    srsButtons.style.display = "none";
    meaningElements.forEach(el => {
        el.classList.remove("visible");
        el.style.display = "none";
    });

    // Update progress display with animation
    updateProgressDisplay();
}

function updateProgressDisplay() {
    const item = vocab[currentIndex];
    const srs = item.srs;
    
    // Update repetitions display with animation
    const repetitionsEl = document.getElementById('srs-repetitions');
    repetitionsEl.style.opacity = '0';
    setTimeout(() => {
        repetitionsEl.textContent = `Repetitions: ${srs.repetitions ?? 0}`;
        repetitionsEl.style.opacity = '1';
    }, 200);
    
    // Update interval display with animation
    const intervalEl = document.getElementById('srs-interval');
    intervalEl.style.opacity = '0';
    setTimeout(() => {
        const intervalText = !srs.interval || srs.interval === 1 ? '1 day' : `${srs.interval} days`;
        intervalEl.textContent = `Next interval: ${intervalText}`;
        intervalEl.style.opacity = '1';
    }, 200);

    // Update due date display
    const dueDateEl = document.getElementById('srs-due-date');
    if (dueDateEl) {
        dueDateEl.style.opacity = '0';
        setTimeout(() => {
            let dueText = '';
            if (!srs.dueDate) {
                dueText = 'Not reviewed yet';
            } else {
                const daysUntilDue = Math.ceil((srs.dueDate - Date.now()) / (24 * 60 * 60 * 1000));
                if (daysUntilDue < 0) {
                    dueText = `Overdue by ${Math.abs(daysUntilDue)} days`;
                } else if (daysUntilDue === 0) {
                    dueText = 'Due today';
                } else {
                    dueText = `Due in ${daysUntilDue} days`;
                }
            }
            dueDateEl.textContent = dueText;
            dueDateEl.style.opacity = '1';
        }, 200);
    }
    
    // Update progress bar with animation
    const progress = (srs.repetitions / 10) * 100; // Assuming 10 is max repetitions
    const progressBar = document.getElementById('srs-progress');
    progressBar.value = Math.min(progress, 100);
}

// Google sign-in setup
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account'
});

// Enhanced authentication with error handling
function signInWithGoogle() {
    showLoading();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log("Signed in as:", user.displayName);
            updateSyncStatus('synced', 'Signed in successfully');
        })
        .catch((error) => {
            console.error("Error during sign-in:", error);
            if (error.code === 'auth/popup-blocked') {
                showError('Please allow popups for this website to sign in.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.log('Sign-in popup was cancelled');
            } else {
                showError("Sign-in failed. Please try again.");
            }
        })
        .finally(() => {
            hideLoading();
        });
}

function signOut() {
    firebase.auth().signOut()
        .then(() => {
            console.log("Signed out successfully");
        })
        .catch((error) => {
            console.error("Error during sign-out:", error);
            alert("Sign-out failed. Please try again.");
        });
}

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
    try {
        // Hamburger menu functionality
        const hamburgerMenu = document.getElementById('hamburger-menu');
        const navMenu = document.getElementById('nav-menu');
        let menuOverlay;

        if (hamburgerMenu && navMenu) {
            // Create overlay element
            menuOverlay = document.createElement('div');
            menuOverlay.className = 'menu-overlay';
            document.body.appendChild(menuOverlay);

            // Toggle menu function
            function toggleMenu() {
                hamburgerMenu.classList.toggle('active');
                navMenu.classList.toggle('active');
                menuOverlay.classList.toggle('active');
                document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
            }

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

        // Existing initialization code
        showAnswerBtn = document.getElementById("show-answer-btn");
        srsButtons = document.querySelector(".srs-button-container");

        if (showAnswerBtn) {
            showAnswerBtn.addEventListener("click", () => {
                const meaningElements = document.querySelectorAll(".card .hidden-on-start");
                meaningElements.forEach(el => {
                    el.style.display = "block";
                    el.offsetHeight; // Trigger reflow
                    el.classList.add("visible");
                });

                showAnswerBtn.style.display = "none";
                srsButtons.style.display = "flex";
                srsButtons.offsetHeight; // Trigger reflow
                srsButtons.classList.add("visible");
            });
        }

        const dontKnowBtn = document.getElementById("dont-know-btn");
        const knowBtn = document.getElementById("know-btn");
        if (dontKnowBtn) dontKnowBtn.addEventListener("click", () => reviewResult(false));
        if (knowBtn) knowBtn.addEventListener("click", () => reviewResult(true));

        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', signInWithGoogle);
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', signOut);
        }

        const loginBtnHeader = document.getElementById('loginBtnHeader');
        const logoutBtnHeader = document.getElementById('logoutBtnHeader');
        const loginBtnNav = document.getElementById('loginBtnNav');
        const logoutBtnNav = document.getElementById('logoutBtnNav');
        if (loginBtnHeader) loginBtnHeader.addEventListener('click', signInWithGoogle);
        if (logoutBtnHeader) logoutBtnHeader.addEventListener('click', signOut);
        if (loginBtnNav) loginBtnNav.addEventListener('click', signInWithGoogle);
        if (logoutBtnNav) logoutBtnNav.addEventListener('click', signOut);

        // Set up network status indicator
        if (navigator.onLine) {
            updateSyncStatus('synced', 'Online');
        } else {
            updateSyncStatus('error', 'Offline mode');
        }

        // Only fetch vocab if we're on the SRS page
        if (window.location.pathname.includes('srs-ui.html')) {
            fetchVocab();
        }

        // Initialize keyboard shortcuts
        keyboardShortcuts.init();
        
        // Initialize dark mode
        darkMode.init();

        // Reset All Progress button
        const resetAllBtn = document.getElementById('resetAllProgressBtn');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset ALL SRS progress for this level? This cannot be undone.')) {
                    // Reset all vocab SRS progress to defaults
                    vocab.forEach(item => {
                        item.srs = {
                            easeFactor: 2.5,
                            interval: 1,
                            repetitions: 0,
                            lastReviewed: null,
                            dueDate: null
                        };
                    });
                    saveProgress();
                    showWord();
                    updateReviewQueueCounts();
                    updateProgressDisplay();
                    showError('All SRS progress has been reset.', 3000);
                }
            });
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to initialize the app. Please refresh the page.');
    }
});

// Show friendly empty state if all cards are reviewed (Free Mode)
function findNextDueCard() {
    const now = Date.now();
    // dueDateがnullまたは今日以前のカードを探す（未学習も含む）
    const dueCards = vocab
        .map((item, idx) => ({ ...item, idx }))
        .filter(item => !item.srs.dueDate || item.srs.dueDate <= now);

    if (dueCards.length > 0) {
        // 今のカードの次から順にdueカードを探す
        const startIdx = currentIndex;
        let found = false;
        for (let i = 1; i <= vocab.length; i++) {
            const nextIdx = (startIdx + i) % vocab.length;
            const nextDue = dueCards.find(item => item.idx === nextIdx);
            if (nextDue) {
                currentIndex = nextDue.idx;
                found = true;
                break;
            }
        }
        if (!found) {
            // すべて終わった場合はフレンドリーな空状態を表示
            const urlParams = new URLSearchParams(window.location.search);
            const mode = urlParams.get("mode");
            if (mode === "free") {
                const cardContainer = document.querySelector(".card-container");
                cardContainer.innerHTML = `<div class='card' style='text-align:center;padding:2rem;'>
                    <h2>All done!</h2>
                    <p>You've reviewed all your imported vocabulary.</p>
                    <button onclick=\"window.location.href='free-mode-import.html'\" class='action-button'>Import or Edit More Vocab</button>
                    <button onclick=\"resetFreeModeProgress()\" class='action-button' style='margin-top:1rem;'>Reset Progress</button>
                </div>`;
                if (showAnswerBtn) showAnswerBtn.style.display = "none";
                if (srsButtons) srsButtons.style.display = "none";
            }
        }
    } else {
        // dueカードがない場合
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get("mode");
        if (mode === "free") {
            const cardContainer = document.querySelector(".card-container");
            cardContainer.innerHTML = `<div class='card' style='text-align:center;padding:2rem;'>
                <h2>All done!</h2>
                <p>You've reviewed all your imported vocabulary.</p>
                <button onclick=\"window.location.href='free-mode-import.html'\" class='action-button'>Import or Edit More Vocab</button>
                <button onclick=\"resetFreeModeProgress()\" class='action-button' style='margin-top:1rem;'>Reset Progress</button>
            </div>`;
            if (showAnswerBtn) showAnswerBtn.style.display = "none";
            if (srsButtons) srsButtons.style.display = "none";
        }
    }
}

// Reset Free Mode SRS progress
function resetFreeModeProgress() {
    localStorage.removeItem('srsData_free');
    window.location.reload();
}

