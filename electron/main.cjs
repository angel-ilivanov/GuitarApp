const { app, BrowserWindow, protocol, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Store = require('electron-store').default;

const store = new Store({
  name: 'takes-vault',
  schema: {
    songs: { type: 'object', default: {} },
    _schemaVersion: { type: 'number', default: 0 }
  }
});

// ── Data migration ─────────────────────────────────────────
// Migrate from the old dual-store (songs-by-filename + library array)
// to a single songs-by-UUID store.
function migrateToV1() {
  if (store.get('_schemaVersion', 0) >= 1) return;

  const oldSongs = store.get('songs', {});       // keyed by GP filename
  const oldLibrary = store.get('library', []);    // array of SongObjects
  const unified = {};

  // Index old song entries by basename for matching
  const oldSongsByBasename = {};
  for (const [filename, entry] of Object.entries(oldSongs)) {
    oldSongsByBasename[filename] = entry;
  }

  const matchedFilenames = new Set();

  // Merge library entries with their matching song entries
  for (const lib of oldLibrary) {
    const basename = lib.paths?.tabFile ? path.basename(lib.paths.tabFile) : '';
    const oldEntry = oldSongsByBasename[basename];
    if (oldEntry) matchedFilenames.add(basename);

    unified[lib.id] = {
      id: lib.id,
      title: lib.title || oldEntry?.title || '',
      artist: lib.artist || oldEntry?.artist || '',
      bpm: lib.bpm || oldEntry?.bpm || 0,
      tuning: lib.tuning || '',
      albumArt: lib.albumArt || undefined,
      paths: {
        tabFile: lib.paths?.tabFile || oldEntry?.gpFilePath || '',
        takesFolder: lib.paths?.takesFolder || '',
      },
      takes: oldEntry?.takes || [],
      nextTakeNumber: oldEntry?.nextTakeNumber ?? (oldEntry?.takes?.length || 0) + 1,
      lastOpened: oldEntry?.lastOpened || Date.now(),
      createdAt: oldEntry?.takes?.[0]?.createdAt || new Date().toISOString(),
    };
  }

  // Handle orphaned song entries (takes with no library entry)
  for (const [filename, entry] of Object.entries(oldSongs)) {
    if (matchedFilenames.has(filename)) continue;
    if (!entry.takes?.length && !entry.gpFilePath) continue; // skip empty entries

    const id = crypto.randomUUID();
    const title = entry.title || path.basename(filename, path.extname(filename));
    const safeName = sanitizeFolderName(title);

    unified[id] = {
      id,
      title,
      artist: entry.artist || '',
      bpm: entry.bpm || 0,
      tuning: '',
      paths: {
        tabFile: entry.gpFilePath || '',
        takesFolder: path.join(app.getPath('videos'), 'GuitarApp Takes', safeName),
      },
      takes: entry.takes || [],
      nextTakeNumber: entry.nextTakeNumber ?? (entry.takes?.length || 0) + 1,
      lastOpened: entry.lastOpened || Date.now(),
      createdAt: entry.takes?.[0]?.createdAt || new Date().toISOString(),
    };
  }

  store.set('songs', unified);
  store.delete('library');
  store.set('_schemaVersion', 1);
  console.log(`Migration complete: ${Object.keys(unified).length} songs unified`);
}

// ── Helpers ────────────────────────────────────────────────

/** Sanitize a string for use as an OS folder name */
function sanitizeFolderName(name) {
  return (name || 'Unknown')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'Unknown';
}

function getSong(songId) {
  return store.get(`songs.${songId}`, null);
}

function setSong(songId, song) {
  store.set(`songs.${songId}`, song);
}

function findSongByTabFile(filePath) {
  const songs = store.get('songs', {});
  return Object.values(songs).find(s => s.paths?.tabFile === filePath) || null;
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
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        // Use a buffer slice instead of a stream — Electron's protocol.handle
        // can throw ERR_INVALID_STATE when a Node ReadableStream closes.
        const fd = fs.openSync(normalizedPath, 'r');
        const chunk = Buffer.alloc(chunkSize);
        fs.readSync(fd, chunk, 0, chunkSize, start);
        fs.closeSync(fd);

        return new Response(chunk, {
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

    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    const distPath = getDistPath();
    const filePath = path.join(distPath, pathname);

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

// ── IPC Handlers ───────────────────────────────────────────

function setupIPC() {

  // Open a GP file — creates or finds an existing song, returns buffer + songId
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
    const fileBuffer = fs.readFileSync(filePath);

    // Find existing song by tab file path
    const existing = findSongByTabFile(filePath);
    if (existing) {
      existing.lastOpened = Date.now();
      setSong(existing.id, existing);
      return { cancelled: false, buffer: new Uint8Array(fileBuffer), songId: existing.id, filePath };
    }

    // Create new song
    const id = crypto.randomUUID();
    const fileName = path.basename(filePath, path.extname(filePath));
    const safeName = sanitizeFolderName(fileName);
    const takesFolder = path.join(app.getPath('videos'), 'GuitarApp Takes', safeName);
    fs.mkdirSync(takesFolder, { recursive: true });

    const song = {
      id,
      title: '',
      artist: '',
      bpm: 0,
      tuning: '',
      paths: { tabFile: filePath, takesFolder },
      takes: [],
      nextTakeNumber: 1,
      lastOpened: Date.now(),
      createdAt: new Date().toISOString(),
    };

    setSong(id, song);
    return { cancelled: false, buffer: new Uint8Array(fileBuffer), songId: id, filePath };
  });

  // Load a song's GP file by songId
  ipcMain.handle('load-song-file', (_event, songId) => {
    const song = getSong(songId);
    if (!song) return { error: 'not_found' };

    try {
      const fileBuffer = fs.readFileSync(song.paths.tabFile);
      song.lastOpened = Date.now();
      setSong(songId, song);
      return { buffer: new Uint8Array(fileBuffer), fileName: path.basename(song.paths.tabFile) };
    } catch (err) {
      if (err.code === 'ENOENT') return { error: 'file_not_found' };
      return { error: 'read_failed' };
    }
  });

  // Partial-update song metadata
  ipcMain.handle('update-song', (_event, { songId, fields }) => {
    const song = getSong(songId);
    if (!song) return;

    const allowed = ['title', 'artist', 'bpm', 'tuning', 'albumArt'];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        song[key] = fields[key];
      }
    }
    setSong(songId, song);
  });

  // Save a recorded video take
  ipcMain.handle('save-video-take', async (_event, { buffer, songId, speed }) => {
    try {
      const song = getSong(songId);
      if (!song) return { success: false };

      const takesDir = song.paths.takesFolder;
      fs.mkdirSync(takesDir, { recursive: true });

      const takeNumber = song.nextTakeNumber;
      song.nextTakeNumber = takeNumber + 1;

      const timestamp = Date.now();
      const filename = `take-${takeNumber}-${timestamp}.webm`;
      const filePath = path.join(takesDir, filename);

      const data = Buffer.from(new Uint8Array(buffer));
      fs.writeFileSync(filePath, data);

      const take = {
        id: `take_${timestamp}`,
        takeNumber,
        speed: speed ?? 100,
        filePath,
        createdAt: new Date(timestamp).toISOString(),
      };

      song.takes.push(take);
      song.lastOpened = Date.now();
      setSong(songId, song);

      return { success: true, path: filePath, take };
    } catch {
      return { success: false };
    }
  });

  // Get takes for a song (validates files still exist on disk)
  ipcMain.handle('get-takes-for-song', (_event, songId) => {
    const song = getSong(songId);
    if (!song) return [];

    const validTakes = song.takes.filter(take => fs.existsSync(take.filePath));

    if (validTakes.length !== song.takes.length) {
      song.takes = validTakes;
      if (validTakes.length === 0) {
        song.nextTakeNumber = 1;
      }
      setSong(songId, song);
    }

    return validTakes;
  });

  // Delete a take
  ipcMain.handle('delete-take', (_event, { songId, takeId }) => {
    const song = getSong(songId);
    if (!song) return { success: false };

    const take = song.takes.find(t => t.id === takeId);
    if (take) {
      try { fs.unlinkSync(take.filePath); } catch {}
      song.takes = song.takes.filter(t => t.id !== takeId);
      if (song.takes.length === 0) {
        song.nextTakeNumber = 1;
      }
      setSong(songId, song);
    }
    return { success: true };
  });

  // Rename a take
  ipcMain.handle('rename-take', (_event, { songId, takeId, name }) => {
    const song = getSong(songId);
    if (!song) return;

    const take = song.takes.find(t => t.id === takeId);
    if (take) {
      take.name = name;
      setSong(songId, song);
    }
  });

  // Update take rating
  ipcMain.handle('update-take-rating', (_event, { songId, takeId, rating }) => {
    const song = getSong(songId);
    if (!song) return;

    const take = song.takes.find(t => t.id === takeId);
    if (take) {
      take.rating = rating;
      setSong(songId, song);
    }
  });

  // Get all songs
  ipcMain.handle('get-all-songs', () => {
    return Object.values(store.get('songs', {}));
  });

  // Clear entire library
  ipcMain.handle('clear-library', () => {
    store.set('songs', {});
  });
}

app.whenReady().then(() => {
  migrateToV1();

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
