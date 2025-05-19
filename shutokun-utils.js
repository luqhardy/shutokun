// shutokun-utils.js
// Shared utility functions for Shutokun

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

export function showError(message, duration = 5000) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, duration);
    } else {
        console.error(message);
    }
}

export function showLoading() {
    const loadingElement = document.getElementById('loading-overlay');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
}

export function hideLoading() {
    const loadingElement = document.getElementById('loading-overlay');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

export function updateSyncStatus(status, message) {
    const syncElement = document.getElementById('sync-status');
    if (syncElement) {
        syncElement.textContent = message;
        syncElement.className = `sync-status ${status}`;
        syncElement.style.display = 'block';
        setTimeout(() => {
            syncElement.style.display = 'none';
        }, 3000);
    }
}
