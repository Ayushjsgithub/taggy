# taggy

[![taggy UI](public/images/screenshot.png)](https://lossless-taggy.vercel.app/)

> **Lossless editing. Zero encoding loss. 100% Local Processing.**

## 📖 Overview

Most web-based audio tools compromise your music library by quietly re-encoding files during the tagging process, leading to a permanent loss of audio fidelity, or by forcing you to upload large audio files to their servers.

**taggy** is built differently. It's a high-performance web application designed from the ground up for byte-for-byte lossless audio metadata editing directly in your browser. Under the hood, **taggy** utilizes a WebAssembly-powered FFmpeg engine (`ffmpeg.wasm`) and `music-metadata` to surgically inject metadata, high-resolution album art, and ReplayGain loudness data directly into your audio containers.

Your actual audio streams are never touched, re-compressed, or uploaded. You get the convenience of a modern, OLED-first web interface with the uncompromising file integrity and privacy of professional offline desktop software.

---

## ✨ Features

- **100% Local Processing**: Files are processed entirely in your browser's memory using WebAssembly. Zero uploads, zero server storage, and zero bandwidth limits. Total privacy.
- **Lossless Tagging**: Updates metadata directly inside the audio container (MP3, FLAC, M4A/ALAC, WAV) using stream copying (`-c copy`) via `ffmpeg.wasm`.
- **Smart Autofill**: Fuzzy search integration with MusicBrainz and Cover Art Archive to auto-populate artist, album, title, year, track number, and high-res cover art. Includes a Magic Wand button for on-demand suggestions.
- **ReplayGain Loudness Tagging**: Built-in peak and track gain calculation via FFmpeg.
- **Drag & Drop Album Art**: Drop any image onto the album art card to instantly swap and embed artwork.
- **WebAssembly FFmpeg**: Cross-platform FFmpeg engine running directly in your browser — no backend processing or external tools required.

---

## 🎵 Supported Formats

| Format         | Container      | Writing Engine               | Stream Integrity                  |
| :------------- | :------------- | :--------------------------- | :-------------------------------- |
| **MP3**        | `.mp3`         | `ffmpeg.wasm` (`-c copy`)    | 100% Lossless (ID3v2.4)           |
| **FLAC**       | `.flac`        | `ffmpeg.wasm` (`-c copy`)    | 100% Lossless (Vorbis Comments)   |
| **M4A / ALAC** | `.m4a`, `.mp4` | `ffmpeg.wasm` (`-c copy`)    | 100% Lossless Stream Copy         |
| **WAV**        | `.wav`         | `ffmpeg.wasm` (`-c copy`)    | 100% Lossless Stream Copy         |

---

## 🚀 How to Setup

### Prerequisites

- **Node.js** 18.x, 20.x, or 22.x

### Installation & Local Run

1. Clone the repository:

   ```bash
   git clone https://github.com/ayushjsgithub/taggy.git
   cd taggy
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Architecture

```text
├── app/                        # Next.js App Router UI & API routes
│   ├── api/                    # Autofill & background-art endpoints (MusicBrainz/CoverArt)
│   └── page.jsx                # Interactive MusicCard editor component
├── lib/                        # Audio engines and external services
│   ├── audio-engine-client.js  # Client-side WASM orchestrator for reading and writing tags
│   └── musicbrainz.js          # Search & Cover Art Archive integration
├── public/                     # Static assets and fallback background art
└── next.config.mjs             # Next.js configuration (with Cross-Origin headers for WASM)
```

---

## 📄 License

MIT License. Free and open source.
