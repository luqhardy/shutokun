let vocab = [];
let currentIndex = 0;
let showAnswerBtn;
let srsButtons;
let currentUser = null;

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB8D99bt_z2FtMeRDY-gdDYFMqqceZV_2s",
    authDomain: "shutokun.firebaseapp.com",
    projectId: "shutokun",
    storageBucket: "shutokun.appspot.com",
    messagingSenderId: "120770573657",
    appId: "1:120770573657:web:692c54b821b0a51c138848",
    measurementId: "G-GJG5NT05DH"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Auth state observer
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
        console.log("User is signed in:", user.displayName);
        
        // Load user's progress if we're on a level page
        if (window.location.pathname.includes('level-select.html')) {
            const level = new URLSearchParams(window.location.search).get("level");
            if (level) {
                await loadProgress();
            }
        }
    } else {
        // User is signed out
        currentUser = null;
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'none';
        console.log("User is signed out");
    }
});

async function fetchVocab() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const level = urlParams.get("level");
        const category = urlParams.get("category") || "goi";
        
        if (!level) {
            throw new Error("Level parameter is missing in the URL.");
        }

        // Fetch vocabulary data
        const response = await fetch(`jlpt-db/${category}/${level}-${category}.json`);
        const data = await response.json();

        // Initialize SRS data
        vocab = data.map(item => ({
            ...item,
            srs: {
                easeFactor: 2.5,
                interval: 1,
                repetitions: 0,
                lastReviewed: null,
                ...(item.srs || {})
            }
        }));

        await loadProgress();
        showWord();
    } catch (error) {
        console.error("Failed to fetch json:", error);
    }
}

async function loadProgress() {
    if (!currentUser) {
        // Fallback to localStorage if not logged in
        const saved = localStorage.getItem("srsData");
        if (saved) {
            const savedData = JSON.parse(saved);
            savedData.forEach((item, i) => {
                if (vocab[i]) vocab[i].srs = item.srs;
            });
        }
        return;
    }

    try {
        const level = new URLSearchParams(window.location.search).get("level");
        const category = new URLSearchParams(window.location.search).get("category") || "goi";
        const savedData = await window.firebaseDB.loadUserProgress(currentUser.uid, `${level}-${category}`);
        if (savedData) {
            savedData.forEach((item, i) => {
                if (vocab[i]) vocab[i].srs = item.srs;
            });
        }
    } catch (error) {
        console.error("Error loading progress:", error);
        // Fallback to localStorage
        const saved = localStorage.getItem("srsData");
        if (saved) {
            const savedData = JSON.parse(saved);
            savedData.forEach((item, i) => {
                if (vocab[i]) vocab[i].srs = item.srs;
            });
        }
    }
}

async function saveProgress() {
    const dataToSave = vocab.map(({ srs }) => ({ srs }));
    
    if (currentUser) {
        try {
            const level = new URLSearchParams(window.location.search).get("level");
            const category = new URLSearchParams(window.location.search).get("category") || "goi";
            await window.firebaseDB.saveUserProgress(currentUser.uid, `${level}-${category}`, dataToSave);
        } catch (error) {
            console.error("Error saving progress to Firebase:", error);
            // Fallback to localStorage
            localStorage.setItem("srsData", JSON.stringify(dataToSave));
        }
    } else {
        // Save to localStorage if not logged in
        localStorage.setItem("srsData", JSON.stringify(dataToSave));
    }
}

function reviewResult(isCorrect) {
    const item = vocab[currentIndex];
    const srs = item.srs;
    const now = Date.now();

    if (isCorrect) {
        srs.repetitions += 1;
        srs.easeFactor = Math.max(1.3, srs.easeFactor - 0.15 + 0.1 * srs.repetitions);
        srs.interval = Math.round(srs.interval * srs.easeFactor);
    } else {
        srs.repetitions = 0;
        srs.easeFactor = Math.max(1.3, srs.easeFactor - 0.2);
        srs.interval = 1;
    }

    srs.lastReviewed = now;

    saveProgress();
    currentIndex = (currentIndex + 1) % vocab.length;
    showWord();
}

function showWord() {
    const word = vocab[currentIndex];
    document.querySelector(".card")?.remove();

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <h2>${word.word} (${word.kana})</h2>
        <p class="hidden-on-start"><strong>Meaning:</strong> ${word.meaning}</p>
        <p class="hidden-on-start"><strong>Romaji:</strong> ${word.romaji}</p>
        <p class="hidden-on-start"><strong>Example:</strong><br>${word.examples[0].jp}<br>${word.examples[0].en}</p>
    `;
    document.body.insertBefore(card, document.querySelector(".srs-button-container"));
}

// Google sign-in setup
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account'
});

function signInWithGoogle() {
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log("Signed in as:", user.displayName);
        })
        .catch((error) => {
            console.error("Error during sign-in:", error);
            // Log more detailed error information
            if (error.code === 'auth/popup-blocked') {
                alert('Please allow popups for this website to sign in.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.log('Sign-in popup was cancelled');
            } else {
                alert("Sign-in failed. Please try again. Error: " + error.message);
            }
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
    showAnswerBtn = document.getElementById("show-answer-btn");
    srsButtons = document.querySelector(".srs-button-container");

    if (showAnswerBtn) {
        showAnswerBtn.addEventListener("click", () => {
            const meaningElements = document.querySelectorAll(".card .hidden-on-start");
            meaningElements.forEach(el => el.style.display = "block");

            showAnswerBtn.style.display = "none";
            srsButtons.style.display = "flex";
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

    // Only fetch vocab if we're on a page that needs it
    if (window.location.pathname.includes('srs-ui.html')) {
        fetchVocab();
    }
});

