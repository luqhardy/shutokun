let score = 0
function initWord(word) {
    return {
      ...word,
      interval: 1,
      ease: 2.5,
      repetitions: 0,
      nextReview: Date.now()
    };
  }

function getDueWords(words) {
    const now = Date.now();
    return words.filter(word => word.nextReview <= now);
  }
function updateWord(word, grade) {
    // grade: 0 (forgot), 3 (good), 5 (easy)
    if (grade < 3) {
      word.repetitions = 0;
      word.interval = 1;
    } else {
      word.repetitions += 1;
      word.ease = Math.max(1.3, word.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
      if (word.repetitions === 1) word.interval = 1;
      else if (word.repetitions === 2) word.interval = 6;
      else word.interval = Math.round(word.interval * word.ease);
    }
  
    // Set next review
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + word.interval);
    word.nextReview = nextReviewDate.getTime();
  
    return word;
  }
    
function saveWords(words) {
    localStorage.setItem("jlptN4Words", JSON.stringify(words));
  }
  
function loadWords() {
    const saved = localStorage.getItem("jlptN4Words");
    return saved ? JSON.parse(saved) : null;
  }
  fetch('./jlpt-db/n5-goi.json')
  .then(res => res.json())
  .then(data => {
    let words = loadWords();
    if (!words) {
      words = data.map(initializeWord);
      saveWords(words);
    }
    const dueWords = getDueWords(words);
    console.log("Words to review today:", dueWords);
  });
  