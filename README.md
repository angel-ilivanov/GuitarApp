# GuitarApp

A desktop app for recording guitar takes over Guitar Pro tablature. Load a `.gp` file, see the tab scroll in real-time, and record yourself playing along with synced video.

## Features

- **Guitar Pro playback** -- Load `.gp`, `.gp3`, `.gp4`, `.gp5`, and `.gpx` files via AlphaTab. Auto-detects the guitar track. Tab-only display by default.
- **Video recording** -- Records camera + audio with MediaRecorder while the tab plays back. Takes are auto-saved to `~/Videos/GuitarApp Takes/`.
- **Takes Vault** -- Each recorded take is persisted in a local store, mapped to its source song. Tracks song title, artist, playback speed, and file path.
- **Recent files** -- Quickly reopen recently played songs from the home screen. Shows song title, artist, and take count.
- **BPM-accurate count-in** -- Count-in respects the song's tempo and time signature with an audible tick.
- **Metronome** -- Toggle the built-in AlphaTab metronome during playback.

## Tech Stack

- **Electron** -- Desktop shell with native file dialogs and filesystem access
- **React 19** + **TypeScript** -- Frontend UI
- **Vite** -- Dev server and build tooling
- **AlphaTab** -- Guitar Pro file parsing, tab rendering, and audio synthesis
- **Tailwind CSS** -- Styling
- **electron-store** -- Local JSON persistence for takes and recent files

## Development

```bash
npm install
npm run electron:dev
```

## Build

```bash
npm run electron:build:win   # Windows (NSIS installer)
npm run electron:build:mac   # macOS (DMG)
```
