// Firebase Database operations
const firebaseDB = {
    // Initialize database reference
    getDB() {
        return firebase.database();
    },

    // Enable offline persistence
    enableOfflinePersistence() {
        const db = this.getDB();
        db.setPersistenceEnabled(true)
            .then(() => {
                console.log("Offline persistence enabled");
            })
            .catch((error) => {
                console.error("Error enabling offline persistence:", error);
            });
    },

    // Save user progress to Firebase with timestamp and conflict resolution
    async saveUserProgress(userId, level, data) {
        try {
            const db = this.getDB();
            const timestamp = Date.now();
            const progressRef = db.ref(`users/${userId}/progress/${level}`);
            
            // Get current data to check for conflicts
            const snapshot = await progressRef.once('value');
            const currentData = snapshot.val();
            
            // Add metadata to the data
            const dataWithMeta = {
                data: data,
                lastModified: timestamp,
                deviceId: this.getDeviceId()
            };

            // If there's existing data, merge it with the new data
            if (currentData) {
                const mergedData = this.mergeProgressData(currentData.data, data);
                dataWithMeta.data = mergedData;
            }

            // Save to Firebase
            await progressRef.set(dataWithMeta);
            
            // Also save to local storage as backup
            this.saveToLocalStorage(userId, level, dataWithMeta);
            
            console.log("Progress saved to Firebase successfully");
            return dataWithMeta;
        } catch (error) {
            console.error("Error saving to Firebase:", error);
            // Save to local storage as fallback
            this.saveToLocalStorage(userId, level, {
                data: data,
                lastModified: Date.now(),
                deviceId: this.getDeviceId()
            });
            throw error;
        }
    },

    // Load user progress from Firebase with offline fallback
    async loadUserProgress(userId, level) {
        try {
            const db = this.getDB();
            const progressRef = db.ref(`users/${userId}/progress/${level}`);
            
            // Set up real-time listener
            progressRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    // Update local storage when Firebase data changes
                    this.saveToLocalStorage(userId, level, data);
                    // Dispatch event for UI update
                    window.dispatchEvent(new CustomEvent('progressUpdated', { detail: data }));
                }
            });

            // Get initial data
            const snapshot = await progressRef.once('value');
            const data = snapshot.val();
            
            if (data) {
                return data.data;
            }

            // If no Firebase data, try local storage
            return this.loadFromLocalStorage(userId, level);
        } catch (error) {
            console.error("Error loading from Firebase:", error);
            // Fallback to local storage
            return this.loadFromLocalStorage(userId, level);
        }
    },

    // Merge progress data from different sources
    mergeProgressData(oldData, newData) {
        const merged = [...oldData];
        
        newData.forEach((newItem, index) => {
            if (index < merged.length) {
                // If item exists, take the one with more repetitions
                if (newItem.srs.repetitions > merged[index].srs.repetitions) {
                    merged[index] = newItem;
                }
            } else {
                // If new item, add it
                merged.push(newItem);
            }
        });

        return merged;
    },

    // Save to local storage
    saveToLocalStorage(userId, level, data) {
        try {
            const key = `shutokun_progress_${userId}_${level}`;
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error("Error saving to local storage:", error);
        }
    },

    // Load from local storage
    loadFromLocalStorage(userId, level) {
        try {
            const key = `shutokun_progress_${userId}_${level}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data).data : [];
        } catch (error) {
            console.error("Error loading from local storage:", error);
            return [];
        }
    },

    // Get unique device ID
    getDeviceId() {
        let deviceId = localStorage.getItem('shutokun_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('shutokun_device_id', deviceId);
        }
        return deviceId;
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

// Initialize offline persistence when the script loads
firebaseDB.enableOfflinePersistence();

// Make firebaseDB available globally
window.firebaseDB = firebaseDB; 