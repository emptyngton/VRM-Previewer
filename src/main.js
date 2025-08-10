const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let pendingOpenPath = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, 'assets', 'vrm-viewer-logo.ico'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenPath) {
      mainWindow.webContents.send('open-file', pendingOpenPath);
      pendingOpenPath = null;
    }
  });
}

// Ensure single instance and handle second-instance argv (Windows)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = extractVrmPathFromArgv(argv);
    if (filePath) {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send('open-file', filePath);
      } else {
        pendingOpenPath = filePath;
      }
    }
  });
}

// Windows/Linux: get file to open from process.argv
function extractVrmPathFromArgv(argv) {
  if (!Array.isArray(argv)) return null;
  // argv on Windows includes executable and app path; a .vrm path will end with .vrm
  const candidate = argv.find((arg) => typeof arg === 'string' && /\.vrm$/i.test(arg));
  return candidate || null;
}

// macOS: handle file open events
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('open-file', filePath);
  } else {
    pendingOpenPath = filePath;
  }
});

app.whenReady().then(() => {
  createMainWindow();

  // Initial file path from argv (Windows/Linux)
  const initialPath = extractVrmPathFromArgv(process.argv);
  if (initialPath) {
    pendingOpenPath = initialPath;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Renderer asks for initial file path explicitly
ipcMain.handle('get-initial-open-path', () => pendingOpenPath);
ipcMain.handle('read-file-buffer', async (_event, filePath) => {
  const data = await fs.promises.readFile(filePath);
  // Return as Node Buffer (transferable)
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
});


