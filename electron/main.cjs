const { app, BrowserWindow, protocol, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store').default;

const store = new Store({
  name: 'takes-vault',
  schema: {
    songs: { type: 'object', default: {} }
  }
});

function getSongEntry(songFilename) {
  const songs = store.get('songs', {});
  return songs[songFilename] || { takes: [] };
}

function setSongEntry(songFilename, entry) {
  const songs = store.get('songs', {});
  songs[songFilename] = entry;
  store.set('songs', songs);
}

// Bypass Chromium's permission UI for media streams entirely
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');

// Register custom protocol scheme BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: false,
    },
  },
]);

const isDev = !app.isPackaged;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.sf2': 'application/octet-stream',
  '.sf3': 'application/octet-stream',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
};

function getDistPath() {
  return path.join(__dirname, '..', 'dist');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'GuitarApp',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Remove default menu bar
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadURL('app://localhost/index.html');
  }

  return win;
}

function setupMediaPermissions() {
  const mediaPermissions = new Set([
    'media',
    'mediaKeySystem',
    'mediaProfile',
    'videoCapture',
    'audioCapture',
  ]);

  // Auto-grant all media permission requests — no origin checks (app:// would fail them)
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (mediaPermissions.has(permission)) {
      return callback(true);
    }
    callback(true);
  });

  // Return true for all media permission checks — no origin checks
  session.defaultSession.setPermissionCheckHandler(() => true);

  // Allow device enumeration so getUserMedia can discover cameras/mics
  session.defaultSession.setDevicePermissionHandler(() => true);
}

function setupProtocolHandler() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);

    // Default to index.html for root
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    const distPath = getDistPath();
    const filePath = path.join(distPath, pathname);

    // Security: prevent path traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(path.normalize(distPath))) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const fileBuffer = fs.readFileSync(normalizedPath);
      const ext = path.extname(normalizedPath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      return new Response(fileBuffer, {
        headers: { 'Content-Type': mimeType },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

function setupIPC() {
  ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
      title: 'Open Guitar Pro File',
      filters: [{ name: 'Guitar Pro', extensions: ['gp', 'gp3', 'gp4', 'gp5', 'gpx'] }],
      properties: ['openFile'],
    });

    if (canceled || filePaths.length === 0) {
      return { cancelled: true };
    }

    const filePath = filePaths[0];
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const entry = getSongEntry(fileName);
    entry.gpFilePath = filePath;
    entry.lastOpened = Date.now();
    setSongEntry(fileName, entry);

    return { cancelled: false, buffer: new Uint8Array(fileBuffer), fileName, filePath };
  });

  ipcMain.handle('get-recent-songs', () => {
    const songs = store.get('songs', {});
    return Object.entries(songs)
      .filter(([, entry]) => entry.gpFilePath)
      .sort(([, a], [, b]) => (b.lastOpened || 0) - (a.lastOpened || 0))
      .slice(0, 10)
      .map(([songFilename, entry]) => ({
        songFilename,
        gpFilePath: entry.gpFilePath,
        lastOpened: entry.lastOpened,
        takesCount: (entry.takes || []).length,
        title: entry.title || '',
        artist: entry.artist || '',
      }));
  });

  ipcMain.handle('load-recent-file', (_event, { filePath, songFilename }) => {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const entry = getSongEntry(songFilename);
      entry.lastOpened = Date.now();
      setSongEntry(songFilename, entry);
      return { buffer: new Uint8Array(fileBuffer), fileName: songFilename };
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { error: 'file_not_found' };
      }
      return { error: 'read_failed' };
    }
  });

  ipcMain.handle('update-song-meta', (_event, { songFilename, title, artist }) => {
    const entry = getSongEntry(songFilename);
    entry.title = title;
    entry.artist = artist;
    setSongEntry(songFilename, entry);
  });

  ipcMain.handle('save-video-take', async (_event, { buffer, songFilename }) => {
    try {
      const takesDir = path.join(app.getPath('videos'), 'GuitarApp Takes');
      fs.mkdirSync(takesDir, { recursive: true });
      const timestamp = Date.now();
      const filename = `guitar-take-${timestamp}.webm`;
      const filePath = path.join(takesDir, filename);
      fs.writeFileSync(filePath, Buffer.from(buffer));

      const take = {
        id: `take_${timestamp}`,
        date: new Date(timestamp).toLocaleString(),
        speed: 100,
        filePath
      };

      const entry = getSongEntry(songFilename);
      entry.takes.push(take);
      entry.lastOpened = Date.now();
      setSongEntry(songFilename, entry);

      return { success: true, path: filePath, take };
    } catch {
      return { success: false };
    }
  });

  ipcMain.handle('get-takes-for-song', (_event, songFilename) => {
    return getSongEntry(songFilename).takes;
  });
}

app.whenReady().then(() => {
  if (!isDev) {
    setupProtocolHandler();
  }

  setupMediaPermissions();
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
