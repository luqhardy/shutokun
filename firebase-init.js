// Firebase Auth and Progress Sync Integration
// Place this at the end of your firebase-init.js file

// Make sure Firebase is initialized before this runs
// Assumes firebase and firebaseDB are available globally

firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    const userId = user.uid;
    // You may want to get the current level from your app's state or UI
    // For demonstration, we'll use a placeholder function
    const currentLevel = window.getCurrentLevel ? window.getCurrentLevel() : 'n5';

    try {
      // 1. Load progress from Firebase
      const cloudProgress = await firebaseDB.loadUserProgress(userId, currentLevel);
      // 2. Load local progress (if any)
      const localProgress = firebaseDB.loadFromLocalStorage(userId, currentLevel);
      // 3. Merge progress (resolve conflicts)
      const merged = firebaseDB.mergeProgressData(localProgress, cloudProgress);
      // 4. Save merged progress to Firebase
      await firebaseDB.saveUserProgress(userId, currentLevel, merged);
      // 5. Optionally, update UI or notify user
      window.dispatchEvent(new CustomEvent('progressSynced', { detail: merged }));
      console.log('Progress synced for user:', userId);
    } catch (err) {
      console.error('Error during progress sync:', err);
    }
  }
});

// Optionally, define window.getCurrentLevel if your app doesn't already have a way to get the current level
// window.getCurrentLevel = function() { return 'n5'; } // Replace with actual logic
