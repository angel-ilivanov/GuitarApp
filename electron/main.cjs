const { app, BrowserWindow, protocol, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Store = require('electron-store').default;

const store = new Store({
  name: 'takes-vault',
  schema: {
    songs: { type: 'object', default: {} },
    library: { type: 'array', default: [] }
  }
});

/** Sanitize a string for use as an OS folder name */
function sanitizeFolderName(name) {
  return (name || 'Unknown')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'Unknown';
}

function getSongEntry(songFilename) {
  const songs = store.get('songs', {});
  const entry = songs[songFilename] || { takes: [], nextTakeNumber: 1 };
  // Backfill nextTakeNumber for entries created before this field existed
  if (entry.nextTakeNumber == null) {
    entry.nextTakeNumber = (entry.takes?.length || 0) + 1;
  }
  return entry;
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
  {
    scheme: 'take-video',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
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
    show: false,
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
  win.maximize();
  win.show();

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

function setupTakeVideoProtocol() {
  protocol.handle('take-video', (request) => {
    // URL format: take-video://file/<encoded-absolute-path>
    // Parse the raw URL string to avoid new URL() mangling custom schemes
    const prefix = 'take-video://file/';
    const rawUrl = request.url;
    if (!rawUrl.startsWith(prefix)) {
      return new Response('Bad Request: invalid URL format', { status: 400 });
    }
    const encodedPath = rawUrl.slice(prefix.length);
    const filePath = decodeURIComponent(encodedPath);

    // Security: only allow .webm files from the takes directory
    const takesDir = path.join(app.getPath('videos'), 'GuitarApp Takes');
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(path.normalize(takesDir))) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!normalizedPath.endsWith('.webm')) {
      return new Response('Forbidden: only .webm files allowed', { status: 403 });
    }

    try {
      const stat = fs.statSync(normalizedPath);
      const rangeHeader = request.headers.get('range');

      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      };

      if (rangeHeader) {
        // Support range requests for video seeking
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(normalizedPath, { start, end });
        return new Response(stream, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Type': 'video/webm',
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Content-Length': String(chunkSize),
            'Accept-Ranges': 'bytes',
          },
        });
      }

      const fileBuffer = fs.readFileSync(normalizedPath);
      return new Response(fileBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'video/webm',
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
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

  ipcMain.handle('save-video-take', async (_event, { buffer, songFilename, songName }) => {
    try {
      const safeName = sanitizeFolderName(songName || songFilename);
      const takesDir = path.join(app.getPath('videos'), 'GuitarApp Takes', safeName);
      fs.mkdirSync(takesDir, { recursive: true });
      const timestamp = Date.now();
      // Kebab-case filename: lowercase, hyphens for spaces, no special chars
      const kebabName = safeName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const filename = `${kebabName || 'take'}-${timestamp}.webm`;
      const filePath = path.join(takesDir, filename);
      // Copy into a fresh Buffer to avoid IPC stream-backed buffer issues
      const data = Buffer.from(new Uint8Array(buffer));
      fs.writeFileSync(filePath, data);

      const entry = getSongEntry(songFilename);
      const takeNumber = entry.nextTakeNumber;
      entry.nextTakeNumber = takeNumber + 1;

      const take = {
        id: `take_${timestamp}`,
        takeNumber,
        date: new Date(timestamp).toLocaleString(),
        speed: 100,
        filePath,
        createdAt: new Date(timestamp).toISOString(),
      };

      entry.takes.push(take);
      entry.lastOpened = Date.now();
      setSongEntry(songFilename, entry);

      return { success: true, path: filePath, take };
    } catch {
      return { success: false };
    }
  });

  ipcMain.handle('get-takes-for-song', (_event, songFilename) => {
    const entry = getSongEntry(songFilename);
    const validTakes = entry.takes.filter(take => fs.existsSync(take.filePath));

    // Clean up ghost records if any files were missing
    if (validTakes.length !== entry.takes.length) {
      entry.takes = validTakes;
      // Reset counter to 1 if all takes have been deleted
      if (validTakes.length === 0) {
        entry.nextTakeNumber = 1;
      }
      setSongEntry(songFilename, entry);
    }

    return validTakes;
  });

  ipcMain.handle('delete-take', (_event, { songFilename, takeId }) => {
    const entry = getSongEntry(songFilename);
    const take = entry.takes.find(t => t.id === takeId);
    if (take) {
      try { fs.unlinkSync(take.filePath); } catch {}
      entry.takes = entry.takes.filter(t => t.id !== takeId);
      if (entry.takes.length === 0) {
        entry.nextTakeNumber = 1;
      }
      setSongEntry(songFilename, entry);
    }
    return { success: true };
  });

  ipcMain.handle('rename-take', (_event, { songFilename, takeId, name }) => {
    const entry = getSongEntry(songFilename);
    const take = entry.takes.find(t => t.id === takeId);
    if (take) {
      take.name = name;
      setSongEntry(songFilename, entry);
    }
  });

  ipcMain.handle('update-take-rating', (_event, { songFilename, takeId, rating }) => {
    const entry = getSongEntry(songFilename);
    const take = entry.takes.find(t => t.id === takeId);
    if (take) {
      take.rating = rating;
      setSongEntry(songFilename, entry);
    }
  });

  // ── Library handlers ──────────────────────────────────────

  ipcMain.handle('add-new-song', (_event, { filePath, title, artist, bpm }) => {
    const library = store.get('library', []);

    // Avoid duplicates — match by tab file path
    const existing = library.find(s => s.paths && s.paths.tabFile === filePath);
    if (existing) {
      // Update metadata in case it changed
      existing.title = title || existing.title;
      existing.artist = artist || existing.artist;
      existing.bpm = bpm || existing.bpm;
      store.set('library', library);
      return existing;
    }

    const id = crypto.randomUUID();
    const safeName = sanitizeFolderName(title || path.basename(filePath, path.extname(filePath)));
    const takesFolder = path.join(app.getPath('videos'), 'GuitarApp Takes', safeName);

    // Pre-create the empty takes folder on disk
    fs.mkdirSync(takesFolder, { recursive: true });

    const songObject = {
      id,
      title: title || '',
      artist: artist || '',
      bpm: bpm || 0,
      nextTakeNumber: 1,
      paths: {
        tabFile: filePath,
        takesFolder,
      },
      stats: {
        totalTakes: 0,
      },
    };

    library.push(songObject);
    store.set('library', library);

    return songObject;
  });

  ipcMain.handle('get-all-songs', () => {
    return store.get('library', []);
  });

  ipcMain.handle('clear-library', () => {
    store.set('library', []);
  });

  ipcMain.handle('update-song-album-art', (_event, { songId, albumArt }) => {
    const library = store.get('library', []);
    const song = library.find(s => s.id === songId);
    if (song) {
      song.albumArt = albumArt;
      store.set('library', library);
    }
  });
}

app.whenReady().then(() => {
  if (!isDev) {
    setupProtocolHandler();
  }

  setupTakeVideoProtocol();
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
