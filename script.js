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

    showAnswerBtn.addEventListener("click", () => {
        const meaningElements = document.querySelectorAll(".card .hidden-on-start");
        meaningElements.forEach(el => el.style.display = "block");

        showAnswerBtn.style.display = "none";
        srsButtons.style.display = "flex";
    });
    document.getElementById("dont-know-btn").addEventListener("click", () => reviewResult(false));
    document.getElementById("know-btn").addEventListener("click", () => reviewResult(true));

    fetchVocab(); // 語彙読み込み
});


