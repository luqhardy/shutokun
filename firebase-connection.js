// Firebase configuration and initialization
const firebaseConfig = {
    apiKey: "AIzaSyB8D99bt_z2FtMeRDY-gdDYFMqqceZV_2s",
    authDomain: "shutokun.firebaseapp.com",
    projectId: "shutokun",
    storageBucket: "shutokun.appspot.com",
    messagingSenderId: "120770573657",
    appId: "1:120770573657:web:692c54b821b0a51c138848",
    measurementId: "G-GJG5NT05DH",
    databaseURL: "https://shutokun-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
let firebaseApp;
let database;

async function initializeFirebase() {
    try {
        // Only initialize if not already initialized
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            database = firebase.database();
            
            // Configure database settings
            await setupDatabase();
            
            // Monitor connection state
            setupConnectionMonitoring();
            
            // Initialize analytics if available
            if (firebase.analytics) {
                firebase.analytics();
            }
        }
        return firebase.apps[0];
    } catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}

async function setupDatabase() {
    try {
        // Enable offline persistence
        await database.setPersistenceEnabled(true);
        await database.goOnline();
        console.log('Database configured successfully');
    } catch (error) {
        console.warn('Error configuring database:', error);
        // Continue anyway as offline persistence is optional
    }
}

function setupConnectionMonitoring() {
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        const isConnected = snap.val() === true;
        console.log(isConnected ? 'Connected to Firebase' : 'Disconnected from Firebase');
        
        if (window.updateSyncStatus) {
            window.updateSyncStatus(
                isConnected ? 'synced' : 'error',
                isConnected ? 'Connected to Firebase' : 'Not connected to Firebase'
            );
        }

        if (!isConnected && navigator.onLine) {
            // If we're online but Firebase is disconnected, try to reconnect
            attemptReconnect();
        }
    });
}

// Reconnection logic with exponential backoff
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

async function attemptReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        return;
    }

    reconnectAttempts++;
    console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})`);
    
    try {
        await database.goOnline();
        reconnectAttempts = 0;
        console.log('Reconnected successfully');
    } catch (error) {
        console.warn('Reconnection failed:', error);
        
        // Calculate delay with exponential backoff and jitter
        const baseDelay = 1000;
        const maxDelay = 30000;
        const delay = Math.min(
            baseDelay * Math.pow(2, reconnectAttempts - 1) * (0.5 + Math.random()),
            maxDelay
        );
        
        setTimeout(attemptReconnect, delay);
    }
}

// Network status monitoring
window.addEventListener('online', () => {
    console.log('Browser went online');
    if (database) {
        database.goOnline();
    }
    if (window.updateSyncStatus) {
        window.updateSyncStatus('syncing', 'Reconnecting to Firebase...');
    }
});

window.addEventListener('offline', () => {
    console.log('Browser went offline');
    if (database) {
        database.goOffline();
    }
    if (window.updateSyncStatus) {
        window.updateSyncStatus('error', 'Offline - changes will be saved locally');
    }
});

// Initialize Firebase and export the database instance
initializeFirebase().catch(console.error);

// Make database instance available globally
window.firebaseDB = window.firebaseDB || {};
window.firebaseDB.getDB = () => database || firebase.database();
