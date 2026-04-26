'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Download, Image as ImageIcon, CheckCircle, Loader2, Edit2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { getColor } from 'colorthief';

const REMOTE_RANDOM_ARTS = [
  'https://coverartarchive.org/release/fed37cfc-293e-43aa-9391-582845667119/front',
  'https://coverartarchive.org/release/389335f6-79ef-4796-932d-9659080c3541/front',
  'https://coverartarchive.org/release/a1ad4d66-7006-4516-834c-2231575c633c/front',
  'https://coverartarchive.org/release/9338547a-2975-4330-8913-c35930b80989/front',
  'https://coverartarchive.org/release/061d4b6b-4e89-497b-9c6a-685a53676c8c/front',
  'https://coverartarchive.org/release/a784693a-86c0-4284-8893-6c7e2c94318d/front',
  'https://coverartarchive.org/release/99268800-478a-406b-b272-4d7a8d56a31c/front',
];

const pickRandomArt = (artPool, currentArt = null) => {
  if (!artPool.length) return null;
  if (artPool.length === 1) return artPool[0];

  const nextOptions = currentArt
    ? artPool.filter((art) => art !== currentArt)
    : artPool;

  return nextOptions[Math.floor(Math.random() * nextOptions.length)];
};

const GithubIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

export default function Home() {
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [originalMetadata, setOriginalMetadata] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [extension, setExtension] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [accentColor, setAccentColor] = useState('#22c55e');
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState({ artist: '', title: '' });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [fallbackPool, setFallbackPool] = useState([]);
  const [fallbackArt, setFallbackArt] = useState('/bg-art/album-art-01.jpg');
  const [idleRemoteArt, setIdleRemoteArt] = useState(null);
  const [musicBrainzArt, setMusicBrainzArt] = useState(null);
  const [idleRetryNonce, setIdleRetryNonce] = useState(0);
  const [applyReplayGain, setApplyReplayGain] = useState(false);

  useEffect(() => {
    if (metadata?.picture || !suggestions.length) return;

    const primarySuggestionArt = suggestions.find((suggestion) => suggestion.coverArt)?.coverArt;
    if (!primarySuggestionArt) return;

    let isActive = true;
    const preloader = new Image();

    preloader.onload = () => {
      if (isActive) {
        setMusicBrainzArt(primarySuggestionArt);
      }
    };

    preloader.onerror = () => {
      if (isActive) {
        setMusicBrainzArt(null);
      }
    };

    preloader.src = primarySuggestionArt;

    return () => {
      isActive = false;
      preloader.onload = null;
      preloader.onerror = null;
    };
  }, [metadata?.picture, suggestions]);

  useEffect(() => {
    let isActive = true;

    const loadBackgroundPool = async () => {
      try {
        const response = await fetch('/api/background-art');
        const data = await response.json();

        if (!isActive || !data.success || !Array.isArray(data.images) || data.images.length === 0) return;

        setFallbackPool(data.images);
        // Pick a random one from the pool as soon as it's available
        setFallbackArt(pickRandomArt(data.images));
      } catch (error) {
        console.error('Background art load failed', error);
      }
    };

    loadBackgroundPool();

    return () => {
      isActive = false;
    };
  }, []);

  const pickFallbackArt = useCallback(
    (currentArt = fallbackArt) =>
      pickRandomArt(fallbackPool, fallbackPool.includes(currentArt) ? currentArt : null),
    [fallbackArt, fallbackPool]
  );

  useEffect(() => {
    // Only load remote art if we don't have metadata art or musicBrainz specific art
    // AND only if we haven't loaded one yet (or we're retrying)
    if (metadata?.picture || musicBrainzArt || (idleRemoteArt && idleRetryNonce === 0)) return;

    let isActive = true;

    const fetchAndPreloadRandomArt = async () => {
      let remoteArtUrl = null;
      
      try {
        const response = await fetch('/api/random-art');
        const data = await response.json();
        if (data.success && data.url) {
          remoteArtUrl = data.url;
        }
      } catch (err) {
        console.error('Failed to fetch random MB art, falling back to static list', err);
      }

      if (!remoteArtUrl) {
        remoteArtUrl = pickRandomArt(REMOTE_RANDOM_ARTS);
      }

      if (!remoteArtUrl || !isActive) return;

      const preloader = new Image();
      preloader.onload = () => {
        if (isActive) {
          setIdleRemoteArt(remoteArtUrl);
        }
      };
      preloader.onerror = () => {
        if (isActive) {
          // If it fails, we could retry or just stick with fallback
          console.warn('Failed to preload remote art:', remoteArtUrl);
        }
      };
      preloader.src = remoteArtUrl;
    };

    fetchAndPreloadRandomArt();

    return () => {
      isActive = false;
    };
  }, [metadata?.picture, musicBrainzArt, idleRemoteArt, idleRetryNonce]);

  const handleBackgroundArtError = () => {
    if (metadata?.picture) return;

    if (musicBrainzArt) {
      setMusicBrainzArt(null);
      return;
    }

    if (idleRemoteArt) {
      setIdleRemoteArt(null);
      setIdleRetryNonce((key) => key + 1);
      return;
    }

    if (fallbackPool.length > 1) {
      setFallbackArt((currentArt) => pickFallbackArt(currentArt));
    }
  };

  const resetEditor = () => {
    setFile(null);
    setMetadata(null);
    setOriginalMetadata(null);
    setFileId(null);
    setExtension(null);
    setSuggestions([]);
    setMusicBrainzArt(null);
    setIdleRemoteArt(null);
    setIdleRetryNonce((key) => key + 1);
    setSearchQuery({ artist: '', title: '' });
    setAccentColor('#22c55e');
    setFallbackArt((currentArt) => pickFallbackArt(currentArt));
    setApplyReplayGain(false);
  };

  const handleUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data.success) {
        setFile(uploadedFile);
        setMetadata(data.metadata);
        setOriginalMetadata(JSON.parse(JSON.stringify(data.metadata)));
        setFileId(data.fileId);
        setExtension(data.extension);
        
        if (data.metadata.picture) {
          extractColor(data.metadata.picture.data, data.metadata.picture.format);
        }

        handleAutofill(data.metadata.artist, data.metadata.title);
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  const extractColor = (base64, format) => {
    const img = new Image();
    img.onload = () => {
      try {
        const color = getColor(img);
        setAccentColor(`rgb(${color[0]}, ${color[1]}, ${color[2]})`);
      } catch (err) {
        setAccentColor('#22c55e');
      }
    };
    img.src = `data:${format || 'image/png'};base64,${base64}`;
  };

  const handleAutofill = async (overrideArtist, overrideTitle) => {
    setIsAutofilling(true);
    setSuggestions([]);
    setMusicBrainzArt(null);
    setShowSearchDialog(false);
    
    const artist = overrideArtist ?? searchQuery.artist ?? metadata?.artist;
    const title = overrideTitle ?? searchQuery.title ?? metadata?.title;

    try {
      const response = await fetch('/api/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title, filename: file?.name }),
      });
      const data = await response.json();
      if (data.success) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Autofill failed', err);
    } finally {
      setIsAutofilling(false);
    }
  };

  const applySuggestion = async (suggestion) => {
    if (!suggestion) return;
    
    const newMetadata = {
      ...metadata,
      title: suggestion.title,
      artist: suggestion.artist,
      album: suggestion.album,
      year: suggestion.year,
      track: suggestion.track || metadata.track,
      genre: suggestion.genre || metadata.genre,
    };

    if (suggestion.coverArt) {
      try {
        const res = await fetch(suggestion.coverArt);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result.split(',')[1];
          setMetadata({
            ...newMetadata,
            picture: { format: blob.type, data: base64data }
          });
          setMusicBrainzArt(null);
          extractColor(base64data, blob.type);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        setMetadata(newMetadata);
      }
    } else {
      setMetadata(newMetadata);
    }
    setSuggestions([]);
    setMusicBrainzArt(null);
  };

  const handleArtDrop = (e) => {
    e.preventDefault();
    const artFile = e.dataTransfer.files[0];
    if (!artFile || !artFile.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      setMetadata({
        ...metadata,
        picture: { format: artFile.type, data: base64data }
      });
      setMusicBrainzArt(null);
      extractColor(base64data, artFile.type);
    };
    reader.readAsDataURL(artFile);
  };

  const handleArtReplace = async (e) => {
    const artFile = e.target.files[0];
    if (!artFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      setMetadata({
        ...metadata,
        picture: { format: artFile.type, data: base64data }
      });
      setMusicBrainzArt(null);
      extractColor(base64data, artFile.type);
    };
    reader.readAsDataURL(artFile);
  };

  const handleUpdate = async () => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('fileId', fileId);
      formData.append('extension', extension);
      formData.append('format', extension.replace('.', ''));

      // Clone metadata and remove picture from the JSON part to keep it small
      const tags = { ...metadata };
      
      // If we have a picture, and it's changed (or always for safety, but as a Blob)
      if (metadata.picture?.data) {
        // Convert base64 back to Blob to send via FormData
        const byteCharacters = atob(metadata.picture.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: metadata.picture.format });
        formData.append('picture', blob, 'cover' + (metadata.picture.format === 'image/jpeg' ? '.jpg' : '.png'));
        
        // Remove data from tags to avoid double sending and hitting limits
        delete tags.picture;
      }

      formData.append('tags', JSON.stringify(tags));
      formData.append('applyReplayGain', applyReplayGain);

      const response = await fetch('/api/update', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let newName = file.name;
        if (metadata.artist && metadata.title) {
          const sArtist = metadata.artist.replace(/[\\/:*?"<>|]/g, '');
          const sTitle = metadata.title.replace(/[\\/:*?"<>|]/g, '');
          newName = `${sArtist} - ${sTitle}${extension}`;
        }
        
        a.download = newName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 3000);
      } else {
        const errData = await response.json();
        console.error('Update failed:', errData.error, errData.details);
        alert(`Failed to save: ${errData.error}${errData.details ? ' (' + errData.details + ')' : ''}`);
      }
    } catch (err) {
      console.error('Update failed', err);
      alert('Update failed. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between p-8 overflow-y-auto text-white custom-scrollbar">
      {/* Background Layer */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <AnimatePresence>
          {(metadata?.picture || musicBrainzArt || idleRemoteArt || fallbackArt) && (
            <motion.div
              key={metadata?.picture?.data || musicBrainzArt || idleRemoteArt || fallbackArt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 scale-105"
            >
              <img 
                src={metadata?.picture ? `data:${metadata.picture.format || 'image/png'};base64,${metadata.picture.data}` : (musicBrainzArt || idleRemoteArt || fallbackArt)}
                onError={handleBackgroundArtError}
                className="w-full h-full object-cover blur-[20px] saturate-150 brightness-75"
                alt=""
              />
              <div className="absolute inset-0 bg-black/20" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Header */}
      <header className="w-full max-w-7xl flex justify-between items-center z-50 mb-12 drop-shadow-2xl backdrop-blur-[2px] py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-tighter italic drop-shadow-md">taggy</h1>
        </div>
        <div className="flex items-center gap-2">
          {file && (
            <Tooltip content="Close Track" position="bottom" align="right">
              <button 
                onClick={resetEditor}
                aria-label="Close Track"
                className="p-2 hover:bg-white/10 rounded-full transition-colors backdrop-blur-md"
              >
                <X className="w-5 h-5 text-white/50 drop-shadow-md" />
              </button>
            </Tooltip>
          )}
          <Tooltip content="View on GitHub" position="bottom" align="right">
            <a
              href="https://github.com/Ayushjsgithub/taggy"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-white/10 rounded-full transition-colors backdrop-blur-md"
              aria-label="GitHub Repository"
            >
              <GithubIcon className="w-5 h-5 text-white/50 hover:text-white transition-colors drop-shadow-md" />
            </a>
          </Tooltip>
        </div>
      </header>

      <div className="flex-1 w-full flex items-center justify-center my-12">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xl"
            >
              <label 
                onDragEnter={() => setIsDraggingOver(true)}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  handleUpload({ target: { files: e.dataTransfer.files } });
                }}
                onDragOver={(e) => e.preventDefault()}
                className={`flex flex-col items-center justify-center w-full h-80 glass-card cursor-pointer hover:bg-white/5 transition-all border-2 border-dashed ${isDraggingOver ? 'border-accent bg-white/10' : 'border-white/5'}`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    {isUploading ? <Loader2 className="animate-spin text-white" /> : <Upload className="text-white" />}
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold tracking-tight">Drop your music here</p>
                    <p className="text-sm text-gray-500">Editing starts with a drag.</p>
                  </div>
                </div>
                <input type="file" className="hidden" accept="audio/*" onChange={handleUpload} />
              </label>
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl relative"
            >
              {/* THE MUSIC CARD */}
              <div className="glass-card ticket-cut overflow-hidden border-white/5 shadow-2xl relative">
                <div className="grid grid-cols-1 md:grid-cols-12 items-center min-h-[500px]">
                  
                  {/* Left: Album Art */}
                  <div className="md:col-span-6 p-8 flex flex-col items-center justify-center">
                    <div className="relative group aspect-square w-full max-w-[440px] rounded-2xl overflow-hidden shadow-2xl">
                      {metadata?.picture ? (
                        <img 
                          src={`data:${metadata.picture.format || 'image/png'};base64,${metadata.picture.data}`} 
                          className="w-full h-full object-cover"
                          alt="Art"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-4 text-center p-8">
                          <ImageIcon className="w-12 h-12 text-white/10" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-white/30">No Art Found</p>
                            <p className="text-[10px] font-black tracking-[0.2em] text-white/10 uppercase">Drop cover here</p>
                          </div>
                        </div>
                      )}
                      <label 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleArtDrop}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm rounded-2xl"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <ImageIcon className="w-6 h-6 text-white/50" />
                          <div className="text-center">
                            <p className="text-xs font-bold uppercase tracking-widest text-white">Replace Art</p>
                            <p className="text-[10px] font-medium text-white/40 mt-1">Drop image to swap</p>
                          </div>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleArtReplace} />
                      </label>
                    </div>
                  </div>

                  {/* Right: Metadata Display */}
                  <div className="md:col-span-6 p-8 flex flex-col justify-center gap-6 min-w-0">
                    <div className="space-y-6 min-w-0">
                      <div className="min-w-0">
                        <EditableField 
                          value={metadata?.title}
                          onChange={(v) => setMetadata(prev => ({...prev, title: v}))}
                          className="text-4xl font-black tracking-tight leading-tight pb-1 pr-1"
                          placeholder="Song Title"
                        />
                        <div className="flex flex-col gap-1 mt-2 min-w-0">
                          <EditableField 
                            value={metadata?.artist}
                            onChange={(v) => setMetadata(prev => ({...prev, artist: v}))}
                            className="text-xl font-bold text-gray-400 pr-1"
                            placeholder="Artist Name"
                          />
                          <EditableField 
                            value={metadata?.album}
                            onChange={(v) => setMetadata(prev => ({...prev, album: v}))}
                            className="text-lg font-medium text-gray-500 pr-1"
                            placeholder="Album"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-8 pt-6 border-t border-white/5">
                        <EditableField label="Genre" value={metadata?.genre} onChange={(v) => setMetadata(prev => ({...prev, genre: v}))} />
                        <EditableField label="Year" value={metadata?.year} onChange={(v) => setMetadata(prev => ({...prev, year: v}))} />
                        <EditableField label="Track" value={metadata?.track} onChange={(v) => setMetadata(prev => ({...prev, track: v}))} />
                      </div>
                      <div className="pt-6 border-t border-white/5">
                        <EditableField label="Lyrics" value={metadata?.lyrics} onChange={(v) => setMetadata(prev => ({...prev, lyrics: v}))} placeholder="No lyrics found" multiline={true} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="flex justify-between items-end">
                        <div className="flex gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                          <span>{extension?.replace('.', '')}</span>
                          <span>{Math.round(metadata?.bitrate / 1000)}<span className="hidden sm:inline">kbps</span></span>
                        </div>
                        <div className="flex gap-0.5 h-4 items-end overflow-hidden mb-0.5">
                          <VisualizerBars color={accentColor} />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleUpdate}
                          disabled={isProcessing}
                          className="flex-1 h-14 rounded-3xl bg-white text-black font-black uppercase tracking-tight flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="animate-spin" /> : isSuccess ? <CheckCircle /> : <Download />}
                          <span className="hidden md:inline">
                            {isSuccess ? 'Updated' : 'Download'}
                          </span>
                        </button>
                        
                        <Tooltip content={applyReplayGain ? "ReplayGain Active" : "Apply ReplayGain"}>
                          <button 
                            type="button"
                            onClick={() => setApplyReplayGain(prev => !prev)}
                            aria-label="Toggle ReplayGain"
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${
                              applyReplayGain 
                                ? 'bg-[#22c55e]/20 border-[#22c55e]/50 text-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.25)]' 
                                : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <SlidersHorizontal className="w-5 h-5" />
                          </button>
                        </Tooltip>

                        <Tooltip content="Restore Metadata" align="right">
                          <button 
                            type="button"
                            onClick={() => setMetadata({...originalMetadata})}
                            aria-label="Restore Original Metadata"
                            className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/5 text-white/50 hover:text-white"
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MusicBrainz Suggestions Panel - Seamless Sidebar */}
                <AnimatePresence>
                  {suggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, x: 300 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 300 }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="absolute right-0 top-0 bottom-0 w-80 z-[60] flex flex-col backdrop-blur-3xl border-l border-white/10 overflow-hidden rounded-r-[24px] ticket-cut-right"
                    >
                      <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Smart Suggestions</span>
                        <Tooltip content="Dismiss" position="bottom" align="right">
                          <button onClick={() => setSuggestions([])} aria-label="Dismiss Suggestions" className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white">
                            <X className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-3">
                        {suggestions.map((s, idx) => (
                          <button 
                            key={idx}
                            onClick={() => applySuggestion(s)}
                            className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 group text-left"
                          >
                            <img 
                              src={s.coverArt || (metadata?.picture ? `data:${metadata.picture.format || 'image/png'};base64,${metadata.picture.data}` : '/placeholder-art.png')} 
                              className="w-14 h-14 rounded-xl object-cover shadow-2xl" 
                              alt=""
                            />
                            <div className="text-left overflow-hidden">
                              <p className="font-black text-xs truncate group-hover:text-accent transition-colors">{s.title}</p>
                              <p className="text-[10px] font-bold text-gray-400 truncate mt-0.5">{s.artist}</p>
                              <p className="text-[9px] font-medium text-gray-500 truncate mt-0.5 italic">{s.album}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="w-full text-center py-8 text-[10px] font-black uppercase tracking-[0.3em] text-white/40 drop-shadow-md backdrop-blur-[2px]">
         lossless Editing • Zero Encoding Loss
      </footer>
    </main>
  );
}

function EditableField({ label, value, onChange, className = "text-sm font-medium", placeholder, multiline = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  return (
    <div className="group/field relative min-w-0">
      {label && <p className="text-[10px] font-black tracking-[0.2em] text-gray-600 mb-1">{label}</p>}
      <div 
        onClick={() => setIsEditing(true)}
        className={`cursor-pointer min-h-[1.2em] relative flex items-start gap-2 ${isEditing ? '' : 'hover:text-accent transition-colors'}`}
      >
        {isEditing ? (
          multiline ? (
            <textarea
              ref={inputRef}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              className={`w-full bg-transparent outline-none border-none p-0 m-0 resize-none overflow-hidden leading-normal ${className}`}
              placeholder={placeholder}
              rows={4}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
              className={`w-full bg-transparent outline-none border-none p-0 m-0 leading-normal ${className}`}
              placeholder={placeholder}
            />
          )
        ) : (
          <>
            <span className={`leading-normal break-words ${className} ${multiline ? 'line-clamp-3' : 'line-clamp-2'}`}>{value || placeholder || '...'}</span>
            <Edit2 className="w-3 h-3 opacity-0 group-hover/field:opacity-40 transition-opacity flex-shrink-0 mt-1.5" />
          </>
        )}
      </div>
    </div>
  );
}

function VisualizerBars({ color }) {
  return [...Array(12)].map((_, i) => (
    <motion.div
      key={i}
      animate={{ 
        height: [4, 24, 12, 20, 8], 
      }}
      transition={{ 
        repeat: Infinity, 
        duration: 0.5 + Math.random() * 0.5,
        delay: i * 0.05
      }}
      className="w-1 rounded-full"
      style={{ backgroundColor: color }}
    />
  ));
}

function Tooltip({ children, content, position = "top", align = "center" }) {
  if (!content) return children;

  let alignClasses = "left-1/2 -translate-x-1/2";
  if (align === "right" || align === "end") {
    alignClasses = "right-0 left-auto translate-x-0";
  } else if (align === "left" || align === "start") {
    alignClasses = "left-0 right-auto translate-x-0";
  }

  const positionClasses = {
    top: `bottom-[calc(100%+10px)] ${alignClasses} translate-y-1 group-hover/tooltip:translate-y-0`,
    bottom: `top-[calc(100%+10px)] ${alignClasses} -translate-y-1 group-hover/tooltip:translate-y-0`,
    left: "right-[calc(100%+10px)] top-1/2 -translate-y-1/2 translate-x-1 group-hover/tooltip:translate-x-0",
    right: "left-[calc(100%+10px)] top-1/2 -translate-y-1/2 -translate-x-1 group-hover/tooltip:translate-x-0",
  };

  const posClass = positionClasses[position] || positionClasses.top;

  return (
    <div className="relative group/tooltip inline-flex items-center justify-center">
      {children}
      <div 
        role="tooltip"
        className={`absolute pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 ease-out z-50 px-2.5 py-1.5 rounded-xl bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.8)] flex items-center gap-1.5 whitespace-nowrap ${posClass}`}
      >
        <span className="text-[10px] font-black tracking-[0.18em] uppercase text-white/80 select-none">
          {content}
        </span>
      </div>
    </div>
  );
}
