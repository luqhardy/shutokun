const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://shutokun-default-rtdb.asia-southeast1.firebasedatabase.app/"
});

const db = admin.database();

async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function buildVocabularyDatabase() {
  try {
    // Read all JLPT level files
    const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
    const vocabularyRef = db.ref('vocabulary');

    for (const level of jlptLevels) {
      const filePath = path.join(__dirname, `../jlpt-db/goi/${level.toLowerCase()}-goi.json`);
      const words = await readJsonFile(filePath);
      
      // Create a batch update
      const updates = {};
      
      // Process each word
      words.forEach(word => {
        // Use kana as the key for uniqueness
        const wordKey = word.kana;
        
        // Structure the word data
        updates[`${level}/words/${wordKey}`] = {
          word: word.word,
          kana: word.kana,
          romaji: word.romaji,
          meaning: word.meaning,
          pos: word.pos,
          jlpt: level,
          usage_notes: word.usage_notes || null,
          related_words: word.related_words || null,
          examples: word.examples || null
        };
      });

      // Add metadata
      updates[`${level}/metadata`] = {
        total_words: words.length,
        last_updated: new Date().toISOString()
      };

      // Update the database
      await vocabularyRef.update(updates);
      console.log(`Successfully imported ${words.length} words for ${level}`);
    }

    console.log('Database build completed successfully!');
  } catch (error) {
    console.error('Error building database:', error);
    throw error;
  }
}

// Function to create user progress structure
async function createUserProgressStructure(uid) {
  try {
    const userRef = db.ref(`users/${uid}`);
    
    // Create initial progress structure
    const progressStructure = {
      progress: {
        vocabulary: {
          N5: {},
          N4: {},
          N3: {},
          N2: {},
          N1: {}
        }
      },
      settings: {
        dailyGoal: 20,
        notifications: true,
        darkMode: false
      },
      stats: {
        totalWordsLearned: 0,
        streak: 0,
        lastStudyDate: null
      }
    };

    await userRef.set(progressStructure);
    console.log(`Created progress structure for user ${uid}`);
  } catch (error) {
    console.error('Error creating user progress structure:', error);
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