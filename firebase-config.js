// Firebase configuration and initialization
const firebaseConfig = {
    apiKey: "AIzaSyB8D99bt_z2FtMeRDY-gdDYFMqqceZV_2s",
    authDomain: "shutokun.firebaseapp.com",
    projectId: "shutokun",
    storageBucket: "shutokun.appspot.com",
    messagingSenderId: "120770573657",
    appId: "1:120770573657:web:692c54b821b0a51c138848",
    measurementId: "G-GJG5NT05DH",
    databaseURL: "https://shutokun-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase only if it hasn't been initialized yet
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    
    // Configure database settings
    const database = firebase.database();
    
    // Monitor connectivity state
    const connectedRef = database.ref('.info/connected');
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
    
    // Configure database persistence
    database.setPersistenceEnabled(true)
        .then(() => {
            console.log('Offline persistence enabled');
            database.goOnline(); // Ensure we're online after enabling persistence
        })
        .catch(error => {
            console.warn('Could not enable offline persistence:', error);
            // Continue anyway as this is optional
        });
        
    // Initialize analytics if available
    if (firebase.analytics) {
        firebase.analytics();
    }
}

// Export the initialized database instance
const db = firebase.database();
window.firebaseDB = window.firebaseDB || {};
window.firebaseDB.getDB = () => db;
