// main.js
// Electronメインプロセス
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { oauth2 } = require('electron-oauth2');

// Google OAuth2 設定
const oauthConfig = {
  clientId: 'YOUR_GOOGLE_CLIENT_ID', // ←Google Cloud Consoleで取得したクライアントIDに置き換えてください
  clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET', // ←同上
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  useBasicAuthorizationHeader: false,
  redirectUri: 'http://localhost'
};

const windowParams = {
  alwaysOnTop: true,
  autoHideMenuBar: true,
  webPreferences: {
    nodeIntegration: false
  }
};

const options = {
  scope: 'profile email openid',
  accessType: 'offline'
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('google-sign-in', async () => {
  const myOAuth2 = oauth2(oauthConfig, windowParams);
  try {
    const token = await myOAuth2.getAccessToken(options);
    return token;
  } catch (err) {
    console.error('Google OAuth2 error:', err);
    return null;
  }
});
