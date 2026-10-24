import { useEffect, useRef, useState } from 'react';

import { DEFAULT_STUDIO_PREFS, getSavedStudioPreferences } from './preferences';

/** Background music, hook SFX and original-voice volume for the studio. */
export function useStudioAudio() {
  // Original Voice Audio Boost (0% - 200%, default 100%)
  const [originalAudioVolume, setOriginalAudioVolume] = useState<number>(() => getSavedStudioPreferences().originalAudioVolume ?? DEFAULT_STUDIO_PREFS.originalAudioVolume);

  // Background Music (BGM) state
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(false);
  const [bgmFileName, setBgmFileName] = useState<string>('');
  const [bgmFilePath, setBgmFilePath] = useState<string>('');
  const [bgmAudioUrl, setBgmAudioUrl] = useState<string>('');
  const [bgmVolume, setBgmVolume] = useState<number>(() => getSavedStudioPreferences().bgmVolume ?? DEFAULT_STUDIO_PREFS.bgmVolume);
  const [bgmDuration, setBgmDuration] = useState<number>(0);
  const [bgmStartOffset, setBgmStartOffset] = useState<number>(0);
  const [isBgmPlaying, setIsBgmPlaying] = useState<boolean>(false);
  const [isUploadingBgm, setIsUploadingBgm] = useState<boolean>(false);
  const [isBgmDragging, setIsBgmDragging] = useState<boolean>(false);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  // Hook Sound Effect (SFX) state
  const [hookSfxFileName, setHookSfxFileName] = useState<string>('');
  const [hookSfxFilePath, setHookSfxFilePath] = useState<string>('');
  const [hookSfxAudioUrl, setHookSfxAudioUrl] = useState<string>('');
  const [hookSfxVolume, setHookSfxVolume] = useState<number>(() => getSavedStudioPreferences().hookSfxVolume ?? DEFAULT_STUDIO_PREFS.hookSfxVolume);
  const [isHookSfxPlaying, setIsHookSfxPlaying] = useState<boolean>(false);
  const [isUploadingHookSfx, setIsUploadingHookSfx] = useState<boolean>(false);
  const [isHookSfxDragging, setIsHookSfxDragging] = useState<boolean>(false);
  const hookSfxAudioRef = useRef<HTMLAudioElement | null>(null);

  // Background Music handlers
  const uploadBgmFile = async (file: File) => {
    if (!file) return;
    setIsUploadingBgm(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-bgm', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to upload background music');
      }
      const data = await res.json();
      setBgmFileName(data.filename || file.name);
      setBgmFilePath(data.file_path);
      setBgmAudioUrl(data.url);
      setBgmEnabled(true);
    } catch (err) {
      console.error('BGM upload error:', err);
      alert('Failed to upload background music file. Please try an MP3, WAV, or M4A file.');
    } finally {
      setIsUploadingBgm(false);
    }
  };

  const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadBgmFile(file);
    e.target.value = '';
  };

  const handleBgmLoadedMetadata = () => {
    if (bgmAudioRef.current) {
      const dur = bgmAudioRef.current.duration;
      if (dur && !isNaN(dur)) {
        setBgmDuration(dur);
      }
    }
  };

  const handleBgmStartOffsetChange = (newOffset: number) => {
    setBgmStartOffset(newOffset);
    if (bgmAudioRef.current) {
      bgmAudioRef.current.currentTime = newOffset;
    }
  };

  const handleRemoveBgm = () => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
    }
    setIsBgmPlaying(false);
    setBgmEnabled(false);
    setBgmFileName('');
    setBgmFilePath('');
    setBgmAudioUrl('');
    setBgmDuration(0);
    setBgmStartOffset(0);
  };

  const toggleBgmPlayback = () => {
    if (!bgmAudioRef.current) return;
    if (isBgmPlaying) {
      bgmAudioRef.current.pause();
      setIsBgmPlaying(false);
    } else {
      bgmAudioRef.current.currentTime = bgmStartOffset;
      bgmAudioRef.current.volume = Math.max(0, Math.min(1, bgmVolume / 100));
      bgmAudioRef.current.play().then(() => setIsBgmPlaying(true)).catch(console.error);
    }
  };

  useEffect(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = Math.max(0, Math.min(1, bgmVolume / 100));
    }
  }, [bgmVolume]);

  // Hook SFX handlers
  const uploadHookSfxFile = async (file: File) => {
    if (!file) return;
    setIsUploadingHookSfx(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-sfx', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to upload hook sound effect');
      }
      const data = await res.json();
      setHookSfxFileName(data.filename || file.name);
      setHookSfxFilePath(data.file_path);
      setHookSfxAudioUrl(data.url);
    } catch (err) {
      console.error('SFX upload error:', err);
      alert('Failed to upload sound effect file. Please try an MP3, WAV, or M4A file.');
    } finally {
      setIsUploadingHookSfx(false);
    }
  };

  const handleHookSfxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadHookSfxFile(file);
    e.target.value = '';
  };

  const handleRemoveHookSfx = () => {
    if (hookSfxAudioRef.current) {
      hookSfxAudioRef.current.pause();
    }
    setIsHookSfxPlaying(false);
    setHookSfxFileName('');
    setHookSfxFilePath('');
    setHookSfxAudioUrl('');
  };

  const toggleHookSfxPlayback = () => {
    if (!hookSfxAudioRef.current) return;
    if (isHookSfxPlaying) {
      hookSfxAudioRef.current.pause();
      setIsHookSfxPlaying(false);
    } else {
      hookSfxAudioRef.current.currentTime = 0;
      hookSfxAudioRef.current.volume = Math.max(0, Math.min(1, hookSfxVolume / 100));
      hookSfxAudioRef.current.play().then(() => setIsHookSfxPlaying(true)).catch(console.error);
    }
  };

  useEffect(() => {
    if (hookSfxAudioRef.current) {
      hookSfxAudioRef.current.volume = Math.max(0, Math.min(1, hookSfxVolume / 100));
    }
  }, [hookSfxVolume]);


  return {
    originalAudioVolume, setOriginalAudioVolume,
    bgmEnabled, setBgmEnabled, bgmFileName, setBgmFileName, bgmFilePath, setBgmFilePath,
    bgmAudioUrl, setBgmAudioUrl, bgmVolume, setBgmVolume, bgmDuration, setBgmDuration,
    bgmStartOffset, setBgmStartOffset, isBgmPlaying, setIsBgmPlaying,
    isUploadingBgm, setIsUploadingBgm, isBgmDragging, setIsBgmDragging, bgmAudioRef,
    hookSfxFileName, setHookSfxFileName, hookSfxFilePath, setHookSfxFilePath,
    hookSfxAudioUrl, setHookSfxAudioUrl, hookSfxVolume, setHookSfxVolume,
    isHookSfxPlaying, setIsHookSfxPlaying, isUploadingHookSfx, setIsUploadingHookSfx,
    isHookSfxDragging, setIsHookSfxDragging, hookSfxAudioRef,
    uploadBgmFile, handleBgmUpload, handleBgmLoadedMetadata, handleBgmStartOffsetChange,
    handleRemoveBgm, toggleBgmPlayback,
    uploadHookSfxFile, handleHookSfxUpload, handleRemoveHookSfx, toggleHookSfxPlayback,
  };
}
