// Firebase initialization and configuration
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

// Initialize Firebase with enhanced error handling
function initializeFirebase() {
    // Prevent multiple initializations
    if (firebase.apps.length) {
        return firebase.app();
    }

    // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // Configure database settings
    db.goOnline();

    // Monitor connection state
    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            console.log('Connected to Firebase Database');
            if (window.updateSyncStatus) {
                window.updateSyncStatus('synced', 'Connected to Firebase');
            }
        } else {
            console.log('Lost connection to Firebase Database');
            if (window.updateSyncStatus) {
                window.updateSyncStatus('error', 'Connection lost - retrying...');
            }
        }
    });

    // Enable offline persistence
    db.setPersistenceEnabled(true)
        .then(() => {
            console.log('Offline persistence enabled');
        })
        .catch(error => {
            console.warn('Could not enable offline persistence:', error);
            // Continue anyway as this is optional
        });

    // Initialize analytics if available
    if (firebase.analytics) {
        firebase.analytics();
    }

    return app;
}

// Initialize Firebase and export the database instance
const app = initializeFirebase();
const db = firebase.database();

// Set up connection status monitoring
let isOnline = navigator.onLine;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

async function attemptReconnect() {
    if (!isOnline && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        if (window.updateSyncStatus) {
            window.updateSyncStatus('syncing', `Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
        }
        
        try {
            await db.goOnline();
            console.log('Reconnection successful');
            isOnline = true;
            reconnectAttempts = 0;
            if (window.updateSyncStatus) {
                window.updateSyncStatus('synced', 'Connected to Firebase');
            }
        } catch (error) {
            console.warn('Reconnection attempt failed:', error);
            if (reconnectAttempts < maxReconnectAttempts) {
                // Exponential backoff for retry
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
                setTimeout(attemptReconnect, delay);
            } else {
                if (window.updateSyncStatus) {
                    window.updateSyncStatus('error', 'Could not reconnect to server');
                }
            }
        }
    }
}

// Network status event listeners
window.addEventListener('online', () => {
    isOnline = true;
    reconnectAttempts = 0;
    if (window.updateSyncStatus) {
        window.updateSyncStatus('syncing', 'Back online. Syncing...');
    }
    attemptReconnect();
});

window.addEventListener('offline', () => {
    isOnline = false;
    if (window.updateSyncStatus) {
        window.updateSyncStatus('error', 'Offline mode - changes saved locally');
    }
});

// Make database instance available globally
window.firebaseDB = window.firebaseDB || {};
window.firebaseDB.getDB = () => db;
