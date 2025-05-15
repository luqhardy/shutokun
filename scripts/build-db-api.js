const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { convertToRomaji } = require('./kana-to-romaji');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://shutokun.firebaseio.com"
});

const db = admin.database();

// Rate limiting configuration
const RATE_LIMIT = 1000; // 1 second between requests
const BATCH_SIZE = 50; // Number of words to process in parallel

// JLPT level word lists
const JLPT_WORDS = {
  N5: [
    '学生', '水', '人', '本', '車', '時', '友達', '天気', '食べる', '飲む',
    '行く', '来る', '見る', '聞く', '話す', '書く', '読む', '買う', '売る', '住む'
    // Add more N5 words here
  ],
  N4: [
    '準備', '予定', '予約', '確認', '説明', '紹介', '案内', '相談', '連絡', '報告'
    // Add more N4 words here
  ],
  N3: [
    '改善', '向上', '発展', '進歩', '成長', '変化', '影響', '関係', '状況', '環境'
    // Add more N3 words here
  ],
  N2: [
    '実現', '達成', '成功', '失敗', '挑戦', '努力', '経験', '知識', '技術', '能力'
    // Add more N2 words here
  ],
  N1: [
    '抽象', '具体', '理論', '実践', '分析', '総合', '批判', '評価', '判断', '決定'
    // Add more N1 words here
  ]
};

// Sleep function for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch word data from Jisho API
async function fetchWordData(word) {
  try {
    const response = await axios.get(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`);
    const data = response.data.data[0]; // Get first result
    
    if (!data) {
      console.warn(`No data found for word: ${word}`);
      return null;
    }

    // Extract relevant information
    const japanese = data.japanese[0];
    const senses = data.senses[0];
    const kana = japanese.reading || '';

    return {
      word: japanese.word || word,
      kana: kana,
      romaji: convertToRomaji(kana),
      meaning: senses.english_definitions.join(', '),
      pos: senses.parts_of_speech.join(', '),
      usage_notes: senses.info ? senses.info.join(', ') : null,
      related_words: senses.see_also ? senses.see_also.map(word => ({
        word,
        meaning: '' // We'll need to fetch these separately if needed
      })) : null,
      examples: data.jlpt ? [{
        jp: japanese.word,
        en: senses.english_definitions[0],
        context: 'Basic usage'
      }] : null
    };
  } catch (error) {
    console.error(`Error fetching data for word ${word}:`, error.message);
    return null;
  }
}

// Process words in batches
async function processWordBatch(words, level) {
  const results = [];
  for (const word of words) {
    try {
      const wordData = await fetchWordData(word);
      if (wordData) {
        results.push({
          ...wordData,
          jlpt: level
        });
      }
      await sleep(RATE_LIMIT); // Rate limiting
    } catch (error) {
      console.error(`Error processing word ${word}:`, error.message);
    }
  }
  return results;
}

// Build vocabulary database from API
async function buildVocabularyDatabase() {
  try {
    const vocabularyRef = db.ref('vocabulary');
    const updates = {};

    for (const [level, words] of Object.entries(JLPT_WORDS)) {
      console.log(`Processing ${level} words...`);
      
      // Process words in batches
      for (let i = 0; i < words.length; i += BATCH_SIZE) {
        const batch = words.slice(i, i + BATCH_SIZE);
        const batchResults = await processWordBatch(batch, level);
        
        // Add to updates
        batchResults.forEach(word => {
          if (word.kana) {
            updates[`${level}/words/${word.kana}`] = word;
          }
        });

        console.log(`Processed ${i + batch.length}/${words.length} words for ${level}`);
      }

      // Add metadata
      updates[`${level}/metadata`] = {
        total_words: words.length,
        last_updated: new Date().toISOString(),
        source: 'Jisho API'
      };
    }

    // Update database
    await vocabularyRef.update(updates);
    console.log('Database build completed successfully!');
  } catch (error) {
    console.error('Error building database:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await buildVocabularyDatabase();
    console.log('Database build completed!');
  } catch (error) {
    console.error('Failed to build database:', error);
    process.exit(1);
  }
}

main(); 