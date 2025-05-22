// shutokun-utils.js
// 共通ユーティリティ関数（debounce, throttle, showError, showLoading, hideLoading, updateSyncStatus）

// debounce: 一定時間内の連続呼び出しをまとめる
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

// throttle: 一定間隔でしか呼び出されないようにする
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

// showError: エラーメッセージを表示
export function showError(message, duration = 5000) {
    const errorElement = document.getElementById('error-message');
    if (!errorElement) return;
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, duration);
}

// showLoading: ローディングオーバーレイを表示
export function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}

// hideLoading: ローディングオーバーレイを非表示
export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// updateSyncStatus: 同期状態を表示
export function updateSyncStatus(status, message) {
    const syncElement = document.getElementById('sync-status');
    if (!syncElement) return;
    syncElement.textContent = message;
    syncElement.className = `sync-status ${status}`;
    syncElement.style.display = 'block';
    setTimeout(() => {
        syncElement.style.display = 'none';
    }, 3000);
}
