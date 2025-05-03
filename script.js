let vocab = [];
let currentIndex = 0;
let showAnswerBtn;
let srsButtons;

async function fetchVocab() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const level = urlParams.get("level"); // URLのparameterからlevel確認
        if (!level) {
            throw new Error("Level parameter is missing in the URL.");
        }

        // URLのparameterを確認、適宜なJSONをfetch
        const response = await fetch(`jlpt-db/goi/${level}-goi.json`);
        const data = await response.json();

        //　間隔反復におけるデータ追加
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

        loadProgress();
        showWord();
    } catch (error) {
        console.error("Failed to fetch json:", error);
    }
}

function loadProgress() {
    const saved = localStorage.getItem("srsData");
    if (saved) {
        const savedData = JSON.parse(saved);
        savedData.forEach((item, i) => {
            if (vocab[i]) vocab[i].srs = item.srs;
        });
    }
}

function saveProgress() {
    const dataToSave = vocab.map(({ srs }) => ({ srs }));
    localStorage.setItem("srsData", JSON.stringify(dataToSave));
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
    document.querySelector(".card")?.remove(); // 以前表示されたカードを一時削除

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <h2>${word.word} (${word.kana})</h2>
        <p><strong>Meaning:</strong> ${word.meaning}</p>
        <p><strong>Romaji:</strong> ${word.romaji}</p>
        <p><strong>Example:</strong><br>${word.examples[0].jp}<br>${word.examples[0].en}</p>
    `;
    document.body.insertBefore(card, document.querySelector(".srs-button-container"));
}

// eventの存在を常に確認
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
    if (window.location.pathname.includes('level-select.html')) {
        fetchVocab();
    }
});

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB8D99bt_z2FtMeRDY-gdDYFMqqceZV_2s",
    authDomain: "shutokun.firebaseapp.com",
    projectId: "shutokun",
    storageBucket: "shutokun.firebasestorage.app",
    messagingSenderId: "120770573657",
    appId: "1:120770573657:web:692c54b821b0a51c138848",
    measurementId: "G-GJG5NT05DH"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Auth state observer
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
        console.log("User is signed in:", user.displayName);
    } else {
        // User is signed out
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'none';
        console.log("User is signed out");
    }
});

// Google sign-in setup
const provider = new firebase.auth.GoogleAuthProvider();
function signInWithGoogle() {
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log("Signed in as:", user.displayName);
            // Here you can update UI or save progress
        })
        .catch((error) => {
            console.error("Error during sign-in:", error);
            alert("Sign-in failed. Please try again.");
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

