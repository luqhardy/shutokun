// script.js

let srsData = {};
let words = [];
let currentIndex = 0;

function loadSRSData() {
  const saved = localStorage.getItem("srs-data");
  srsData = saved ? JSON.parse(saved) : {};
}

function saveSRSData() {
  localStorage.setItem("srs-data", JSON.stringify(srsData));
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function initCard(wordObj) {
  const id = wordObj.word;
  if (!srsData[id]) {
    srsData[id] = {
      interval: 0,
      due: getToday(),
      lastReviewed: null,
    };
  }
}

function isDue(id) {
  return new Date(srsData[id].due) <= new Date(getToday());
}

function scheduleReview(id, result) {
  const today = new Date();
  let interval = srsData[id].interval;

  if (result === "know") {
    interval = interval === 0 ? 1 : Math.round(interval * 2);
  } else if (result === "dontknow") {
    interval = 1;
  }

  const nextDue = new Date(today.getTime());
  nextDue.setDate(today.getDate() + interval);

  srsData[id] = {
    interval,
    due: nextDue.toISOString().split("T")[0],
    lastReviewed: getToday(),
  };

  saveSRSData();
}

function showNextWord() {
  if (currentIndex >= words.length) {
    document.getElementById("quiz-container").innerHTML = "<p>All done for now!</p>";
    return;
  }

  const word = words[currentIndex];
  initCard(word);

  if (!isDue(word.word)) {
    currentIndex++;
    showNextWord();
    return;
  }

  document.getElementById("question").textContent = word.meaning;
  document.getElementById("answer").textContent = word.word;
  document.getElementById("answer").style.display = "none";
  document.getElementById("srs-buttons").style.display = "none";
  document.getElementById("show-answer").style.display = "block";
}

function revealAnswer() {
  document.getElementById("answer").style.display = "block";
  document.getElementById("show-answer").style.display = "none";
  document.getElementById("srs-buttons").style.display = "flex";
}

function handleAnswer(result) {
  const word = words[currentIndex];
  scheduleReview(word.word, result);
  currentIndex++;
  showNextWord();
}

function startQuiz(level) {
  fetch(`goi/level${level}.json`)
    .then((res) => res.json())
    .then((data) => {
      words = data;
      currentIndex = 0;
      loadSRSData();
      showNextWord();
    });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".level-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = btn.getAttribute("data-level");
      document.getElementById("level-select").style.display = "none";
      document.getElementById("quiz-container").style.display = "block";
      startQuiz(level);
    });
  });

  document.getElementById("show-answer").addEventListener("click", revealAnswer);
  document.getElementById("know-button").addEventListener("click", () => handleAnswer("know"));
  document.getElementById("dontknow-button").addEventListener("click", () => handleAnswer("dontknow"));
});
