let vocab = [];
let currentIndex = 0;

async function fetchVocab() {
    try {
        const response = await fetch("jlpt-db/goi/n1-goi.json"); // <-- make sure this file exists
        const data = await response.json();

        // Add default SRS fields if not present
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
    document.querySelector(".card")?.remove(); // Remove previous card

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

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".jlpt-button")[0].addEventListener("click", () => reviewResult(false));
    document.querySelectorAll(".jlpt-button")[1].addEventListener("click", () => reviewResult(true));
    fetchVocab(); // Start app
});
