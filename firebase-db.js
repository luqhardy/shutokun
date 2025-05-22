// Firebase Database operations
const firebaseDB = {
    // Initialize database reference with connection monitoring
    getDB() {
        return window.firebaseDB.getDB();
    },

    // Enable offline persistence with retry logic and proper error handling
    async enableOfflinePersistence() {
        return withRetry(async () => {
            const db = this.getDB();
            await db.setPersistenceEnabled(true);
            await db.goOnline();
            console.log("Offline persistence enabled");
            return true;
        }, 3, 1000);
    },

    // Add database rules and indexes
    DB_RULES: {
        users: {
            $userId: {
                progress: {
                    $level: {
                        '.indexOn': ['lastModified', 'version'],
                        data: {
                            '.indexOn': ['srs.dueDate', 'srs.lastReviewed']
                        }
                    }
                },
                preferences: {
                    '.indexOn': ['lastModified']
                },
                customVocabulary: {
                    '.indexOn': ['lastModified', 'category']
                }
            }
        }
    },

    // Optimize data structure for better querying
    optimizeDataStructure(data) {
        if (!Array.isArray(data)) return data;
        
        return data.map(item => ({
            id: item.id || this.generateUniqueId(),
            word: item.word,
            reading: item.reading,
            meaning: item.meaning,
            srs: {
                easeFactor: item.srs?.easeFactor || 2.5,
                interval: item.srs?.interval || 1,
                repetitions: item.srs?.repetitions || 0,
                lastReviewed: item.srs?.lastReviewed || null,
                dueDate: item.srs?.dueDate || null,
                nextReview: this.calculateNextReview(item.srs)
            },
            metadata: {
                created: item.metadata?.created || Date.now(),
                modified: Date.now(),
                tags: item.metadata?.tags || [],
                difficulty: item.metadata?.difficulty || 'medium'
            }
        }));
    },

    // Generate unique ID for items
    generateUniqueId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // Calculate next review date based on SRS algorithm
    calculateNextReview(srs) {
        if (!srs) return null;
        if (!srs.lastReviewed) return Date.now();
        
        const interval = srs.interval * 24 * 60 * 60 * 1000; // Convert days to milliseconds
        return srs.lastReviewed + interval;
    },

    // Save user progress to Firebase with timestamp and conflict resolution
    async saveUserProgress(userId, level, data) {
        return withRetry(async () => {
            // Validate data before saving
            this.validateProgressData(data);
            
            const db = this.getDB();
            const timestamp = Date.now();
            const progressRef = db.ref(`users/${userId}/progress/${level}`);
            
            // Optimize data structure before saving
            const optimizedData = this.optimizeDataStructure(data);
            
            // Get current data to check for conflicts
            const snapshot = await progressRef.once('value');
            const currentData = snapshot.val();
            
            // Add metadata to the data
            const dataWithMeta = {
                data: optimizedData,
                lastModified: timestamp,
                deviceId: this.getDeviceId(),
                version: (currentData?.version || 0) + 1,
                stats: {
                    totalItems: optimizedData.length,
                    dueItems: optimizedData.filter(item => item.srs.dueDate <= timestamp).length,
                    masteredItems: optimizedData.filter(item => item.srs.repetitions >= 5).length
                }
            };

            // Use batch write for better performance
            const batch = {};
            batch[`users/${userId}/progress/${level}`] = dataWithMeta;
            batch[`users/${userId}/stats/${level}`] = dataWithMeta.stats;
            
            await db.ref().update(batch);
            
            // Save to local storage as backup
            this.saveToLocalStorage(userId, level, dataWithMeta);
            
            return dataWithMeta;
        });
    },

    // Load user progress from Firebase with offline fallback
    async loadUserProgress(userId, level) {
        return withRetry(async () => {
            const db = this.getDB();
            const progressRef = db.ref(`users/${userId}/progress/${level}`);
            
            // First try to get data from local storage
            const localData = this.loadFromLocalStorage(userId, level);
            
            try {
                const snapshot = await progressRef.once('value');
                const data = snapshot.val();
                if (data) {
                    // Update local storage when Firebase data changes
                    this.saveToLocalStorage(userId, level, data);
                    return data.data;
                }
            } catch (error) {
                console.warn('Error loading from Firebase, using local data:', error);
            }

            // If no Firebase data or error, return local data
            return localData;
        }, 3, 1000);
    },

    // Enhanced merge progress data with conflict resolution
    mergeProgressData(oldData, newData) {
        if (!Array.isArray(oldData) || !Array.isArray(newData)) {
            return newData;
        }

        const merged = [...oldData];
        
        newData.forEach((newItem, index) => {
            if (index < merged.length) {
                // If item exists, take the one with more repetitions or newer lastReviewed
                if (newItem.srs) {
                    const oldItem = merged[index];
                    if (oldItem.srs) {
                        if (newItem.srs.repetitions > oldItem.srs.repetitions ||
                            (newItem.srs.lastReviewed && 
                             (!oldItem.srs.lastReviewed || 
                              new Date(newItem.srs.lastReviewed) > new Date(oldItem.srs.lastReviewed)))) {
                            merged[index] = newItem;
                        }
                    } else {
                        merged[index] = newItem;
                    }
                }
            } else {
                // If new item, add it
                merged.push(newItem);
            }
        });

        return merged;
    },

    // Enhanced local storage operations with error handling
    saveToLocalStorage(userId, level, data) {
        try {
            const key = `shutokun_progress_${userId}_${level}`;
            const dataToSave = {
                ...data,
                lastSaved: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(dataToSave));
        } catch (error) {
            console.error("Error saving to local storage:", error);
            // Try to clear some space if storage is full
            if (error.name === 'QuotaExceededError') {
                this.clearOldLocalStorageData();
                try {
                    localStorage.setItem(key, JSON.stringify(data));
                } catch (retryError) {
                    console.error("Failed to save after clearing space:", retryError);
                }
            }
        }
    },

    // Enhanced local storage loading with data validation
    loadFromLocalStorage(userId, level) {
        try {
            const key = `shutokun_progress_${userId}_${level}`;
            const data = localStorage.getItem(key);
            if (!data) return [];

            const parsed = JSON.parse(data);
            // Validate data structure
            if (!parsed.data || !Array.isArray(parsed.data)) {
                console.error("Invalid data structure in localStorage");
                return [];
            }

            // Check if data is too old (more than 30 days)
            if (parsed.lastSaved && (Date.now() - parsed.lastSaved > 30 * 24 * 60 * 60 * 1000)) {
                console.warn("Local storage data is more than 30 days old");
            }

            return parsed.data;
        } catch (error) {
            console.error("Error loading from local storage:", error);
            return [];
        }
    },

    // Clear old local storage data
    clearOldLocalStorageData() {
        try {
            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('shutokun_progress_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data.lastSaved && data.lastSaved < thirtyDaysAgo) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        // If we can't parse the data, remove it
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (error) {
            console.error("Error clearing old local storage data:", error);
        }
    },

    // Get unique device ID with persistence
    getDeviceId() {
        try {
            let deviceId = localStorage.getItem('shutokun_device_id');
            if (!deviceId) {
                deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('shutokun_device_id', deviceId);
            }
            return deviceId;
        } catch (error) {
            console.error("Error getting device ID:", error);
            return 'device_' + Math.random().toString(36).substr(2, 9);
        }
    },

    // Get user's overall progress with error handling
    async getUserOverallProgress(userId) {
        try {
            const db = this.getDB();
            const snapshot = await Promise.race([
                db.ref(`users/${userId}/progress`).once('value'),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]);
            return snapshot.val() || {};
        } catch (error) {
            console.error("Error loading overall progress:", error);
            throw error;
        }
    },

    // Save user's custom vocabulary with validation
    async saveCustomVocabulary(userId, vocabulary) {
        try {
            if (!Array.isArray(vocabulary)) {
                throw new Error('Vocabulary must be an array');
            }

            const db = this.getDB();
            await db.ref(`users/${userId}/custom-vocabulary`).set({
                data: vocabulary,
                lastModified: Date.now(),
                version: 1
            });
            console.log('Custom vocabulary saved successfully');
        } catch (error) {
            console.error('Error saving custom vocabulary:', error);
            throw error;
        }
    },

    // Load user's custom vocabulary with error handling
    async loadCustomVocabulary(userId) {
        try {
            const db = this.getDB();
            const snapshot = await Promise.race([
                db.ref(`users/${userId}/custom-vocabulary`).once('value'),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]);
            const data = snapshot.val();
            return data?.data || [];
        } catch (error) {
            console.error('Error loading custom vocabulary:', error);
            throw error;
        }
    },

    // Save user preferences with validation
    async saveUserPreferences(userId, preferences) {
        try {
            if (typeof preferences !== 'object') {
                throw new Error('Preferences must be an object');
            }

            const db = this.getDB();
            await db.ref(`users/${userId}/preferences`).set({
                ...preferences,
                lastModified: Date.now()
            });
            console.log('Preferences saved successfully');
        } catch (error) {
            console.error('Error saving preferences:', error);
            throw error;
        }
    },

    // Load user preferences with error handling
    async loadUserPreferences(userId) {
        try {
            const db = this.getDB();
            const snapshot = await Promise.race([
                db.ref(`users/${userId}/preferences`).once('value'),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]);
            return snapshot.val() || {};
        } catch (error) {
            console.error('Error loading preferences:', error);
            throw error;
        }
    },

    // Data validation and error handling
    validateVocabularyItem(item) {
        const required = ['word', 'reading', 'meaning'];
        const missing = required.filter(field => !item[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        if (item.srs) {
            if (typeof item.srs.easeFactor !== 'number' || item.srs.easeFactor < 1.3 || item.srs.easeFactor > 2.5) {
                throw new Error('Invalid ease factor value');
            }
            if (typeof item.srs.interval !== 'number' || item.srs.interval < 0) {
                throw new Error('Invalid interval value');
            }
            if (typeof item.srs.repetitions !== 'number' || item.srs.repetitions < 0) {
                throw new Error('Invalid repetitions value');
            }
        }

        return true;
    },

    // Validate user progress data
    validateProgressData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Progress data must be an array');
        }

        data.forEach((item, index) => {
            try {
                this.validateVocabularyItem(item);
            } catch (error) {
                throw new Error(`Invalid item at index ${index}: ${error.message}`);
            }
        });

        return true;
    },

    // Enhanced error handling wrapper
    async withErrorHandling(operation, fallback = null) {
        try {
            return await operation();
        } catch (error) {
            console.error('Database operation failed:', error);
            
            // Log error to analytics if available
            if (window.gtag) {
                gtag('event', 'database_error', {
                    'error_message': error.message,
                    'error_code': error.code,
                    'operation': operation.name
                });
            }

            // Handle specific error types
            if (error.code === 'PERMISSION_DENIED') {
                showError('You do not have permission to perform this operation');
            } else if (error.code === 'NETWORK_ERROR') {
                showError('Network error. Please check your connection');
            } else if (error.code === 'QUOTA_EXCEEDED') {
                showError('Storage quota exceeded. Please contact support');
            } else {
                showError('An error occurred. Please try again');
            }

            return fallback;
        }
    }
};

// Enhanced error handling wrapper with retry logic
async function withRetry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
            
            // Check if we should retry based on error type
            if (error.code === 'PERMISSION_DENIED') {
                throw error; // Don't retry permission errors
            }
            
            if (attempt < maxRetries - 1) {
                // Exponential backoff with jitter
                const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random());
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

// Optimized query functions
const queryOptimizations = {
    // Get due items with pagination
    async getDueItems(userId, level, limit = 20, lastKey = null) {
        const db = this.getDB();
        const now = Date.now();
        let query = db.ref(`users/${userId}/progress/${level}/data`)
            .orderByChild('srs/dueDate')
            .endAt(now)
            .limitToFirst(limit);

        if (lastKey) {
            query = query.startAfter(lastKey);
        }

        const snapshot = await query.once('value');
        const items = [];
        snapshot.forEach(child => {
            items.push({
                key: child.key,
                ...child.val()
            });
        });

        return {
            items,
            lastKey: items.length > 0 ? items[items.length - 1].key : null,
            hasMore: items.length === limit
        };
    },

    // Get items by difficulty with caching
    async getItemsByDifficulty(userId, level, difficulty, useCache = true) {
        const cacheKey = `difficulty_${userId}_${level}_${difficulty}`;
        
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;
        }

        const db = this.getDB();
        const query = db.ref(`users/${userId}/progress/${level}/data`)
            .orderByChild('metadata/difficulty')
            .equalTo(difficulty);

        const snapshot = await query.once('value');
        const items = [];
        snapshot.forEach(child => {
            items.push(child.val());
        });

        if (useCache) {
            this.setCache(cacheKey, items, 5 * 60 * 1000); // Cache for 5 minutes
        }

        return items;
    },

    // Get user statistics with aggregation
    async getUserStats(userId) {
        const db = this.getDB();
        const statsRef = db.ref(`users/${userId}/stats`);
        
        const snapshot = await statsRef.once('value');
        const stats = snapshot.val() || {};
        
        // Aggregate stats across all levels
        const aggregated = Object.values(stats).reduce((acc, levelStats) => {
            acc.totalItems += levelStats.totalItems || 0;
            acc.dueItems += levelStats.dueItems || 0;
            acc.masteredItems += levelStats.masteredItems || 0;
            return acc;
        }, {
            totalItems: 0,
            dueItems: 0,
            masteredItems: 0
        });

        return {
            byLevel: stats,
            aggregated
        };
    },

    // Cache management
    cache: new Map(),
    
    setCache(key, value, ttl) {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttl
        });
    },
    
    getFromCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    },
    
    clearCache() {
        this.cache.clear();
    }
};

// Add the query optimizations to the firebaseDB object
Object.assign(firebaseDB, queryOptimizations);

// Make firebaseDB available globally
window.firebaseDB = firebaseDB;