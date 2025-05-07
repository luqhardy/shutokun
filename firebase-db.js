// Firebase Database operations
const firebaseDB = {
    // Initialize database reference
    getDB() {
        return firebase.database();
    },

    // Save user progress to Firebase
    async saveUserProgress(userId, level, data) {
        try {
            const db = this.getDB();
            await db.ref(`users/${userId}/progress/${level}`).set(data);
            console.log("Progress saved to Firebase successfully");
        } catch (error) {
            console.error("Error saving to Firebase:", error);
            throw error;
        }
    },

    // Load user progress from Firebase
    async loadUserProgress(userId, level) {
        try {
            const db = this.getDB();
            const snapshot = await db.ref(`users/${userId}/progress/${level}`).once('value');
            return snapshot.val() || [];
        } catch (error) {
            console.error("Error loading from Firebase:", error);
            throw error;
        }
    },

    // Get user's overall progress across all levels
    async getUserOverallProgress(userId) {
        try {
            const db = this.getDB();
            const snapshot = await db.ref(`users/${userId}/progress`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error("Error loading overall progress:", error);
            throw error;
        }
    },

    // Save user's custom vocabulary
    async saveCustomVocabulary(userId, vocabulary) {
        try {
            const db = this.getDB();
            await db.ref(`users/${userId}/custom-vocabulary`).set(vocabulary);
            console.log('Custom vocabulary saved successfully');
        } catch (error) {
            console.error('Error saving custom vocabulary:', error);
            throw error;
        }
    },

    // Load user's custom vocabulary
    async loadCustomVocabulary(userId) {
        try {
            const db = this.getDB();
            const snapshot = await db.ref(`users/${userId}/custom-vocabulary`).once('value');
            return snapshot.val() || [];
        } catch (error) {
            console.error('Error loading custom vocabulary:', error);
            throw error;
        }
    },

    // Save user preferences
    async saveUserPreferences(userId, preferences) {
        try {
            const db = this.getDB();
            await db.ref(`users/${userId}/preferences`).set(preferences);
            console.log('Preferences saved successfully');
        } catch (error) {
            console.error('Error saving preferences:', error);
            throw error;
        }
    },

    // Load user preferences
    async loadUserPreferences(userId) {
        try {
            const db = this.getDB();
            const snapshot = await db.ref(`users/${userId}/preferences`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('Error loading preferences:', error);
            throw error;
        }
    }
};

// Make firebaseDB available globally
window.firebaseDB = firebaseDB; 