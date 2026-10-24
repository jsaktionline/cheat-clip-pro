import { useEffect, useRef, useState } from 'react';

import { detectFaceClientSide } from '../../utils/clientFaceDetector';
import { getStoredCookies } from '../../utils/cookieUtils';
import type { FacecamPosition, StreamerPreset, ViralClip } from '../../types';

interface StudioPlaybackOptions {
  videoId: string;
  videoUrl: string;
  clipStart: number;
  previewClipIndex: number;
  currentPreviewClip: ViralClip | null;
  facecamPosition: FacecamPosition;
  streamerPreset: StreamerPreset;
}

/**
 * Live studio preview transport: YouTube IFrame / HTML5 video, looping,
 * seeking, mute and face-tracking coordinates for the framing preview.
 */
export function useStudioPlayback({
  videoId,
  videoUrl,
  clipStart,
  previewClipIndex,
  currentPreviewClip,
  facecamPosition,
  streamerPreset,
}: StudioPlaybackOptions) {
  // Playable video player state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [playerReady, setPlayerReady] = useState<boolean>(false);

  // Face & object detection tracking state
  const [faceBox, setFaceBox] = useState<{ cx: number; cy: number; w: number; h: number; found: boolean; type?: string }>({
    cx: 0.5,
    cy: 0.35,
    w: 0.25,
    h: 0.25,
    found: false,
  });

  const previewPlayerRef = useRef<any>(null);
  const directVideoRef = useRef<HTMLVideoElement | null>(null);
  const ambientVideoRef = useRef<HTMLVideoElement | null>(null);
  const trackingTimerRef = useRef<number | null>(null);

  // Fetch face/object detection coordinates
  useEffect(() => {
    if (!videoId) return;
    let isMounted = true;
    const fetchFace = async () => {
      try {
        // For local uploaded files (blob: URL or upload_ ID), run client-side detection directly
        if (videoUrl?.startsWith('blob:') || videoId.startsWith('upload_')) {
          const clientBox = await detectFaceClientSide(directVideoRef.current, facecamPosition, streamerPreset);
          if (clientBox && isMounted) {
            setFaceBox(clientBox);
            return;
          }
        }

        const userCookies = getStoredCookies();
        const cookiesParam = userCookies ? `&cookies=${encodeURIComponent(userCookies)}` : '';
        const res = await fetch(`/api/detect-face?video_id=${encodeURIComponent(videoId)}&timestamp=${clipStart}&video_url=${encodeURIComponent(videoUrl || '')}&facecam_position=${encodeURIComponent(facecamPosition)}&streamer_preset=${encodeURIComponent(streamerPreset)}${cookiesParam}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data && typeof data.cx === 'number') {
            setFaceBox(data);
          }
        }
      } catch (err) {
        console.warn('Face detection fetch failed:', err);
      }
    };
    fetchFace();
    return () => { isMounted = false; };
  }, [videoId, previewClipIndex, clipStart, videoUrl, facecamPosition, streamerPreset]);

  // Initialize YouTube player or HTML5 direct video
  const initPreviewPlayer = () => {
    if (!videoId && !videoUrl) return;

    const isDirect = Boolean(videoUrl && (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.endsWith('.mov') || videoUrl.endsWith('.mkv') || videoUrl.includes('/api/video') || videoUrl.startsWith('blob:') || videoId?.startsWith('upload_') || videoId?.startsWith('gdrive_')));
    if (isDirect) {
      setPlayerReady(true);
      setCurrentTime(clipStart);
      return;
    }

    if (window.YT && window.YT.Player) {
      const container = document.getElementById('studio-preview-yt-container');
      if (!container) return;

      if (previewPlayerRef.current) {
        try {
          previewPlayerRef.current.destroy();
        } catch (e) {}
        previewPlayerRef.current = null;
      }

      container.innerHTML = '<div id="studio-yt-iframe-slot"></div>';

      try {
        const startSec = Math.floor(clipStart);
        previewPlayerRef.current = new window.YT.Player('studio-yt-iframe-slot', {
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            enablejsapi: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            autohide: 1,
            start: startSec,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              setPlayerReady(true);
              try {
                event.target.mute();
                setIsMuted(true);
                if (typeof event.target.unloadModule === 'function') {
                  event.target.unloadModule('captions');
                  event.target.unloadModule('cc');
                }
                event.target.seekTo(clipStart, true);
                setCurrentTime(clipStart);
              } catch (e) {}
            },
            onStateChange: (event: any) => {
              if (event.data === 1) {
                // PLAYING
                setIsPlaying(true);
                startTracking();
              } else {
                setIsPlaying(false);
                stopTracking();
                if (event.data === 0 && isLooping && currentPreviewClip) {
                  try {
                    previewPlayerRef.current.seekTo(clipStart, true);
                    previewPlayerRef.current.playVideo();
                  } catch (e) {}
                }
              }
            },
          },
        });
      } catch (err) {
        console.error('Error instantiating studio player:', err);
      }
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      setTimeout(initPreviewPlayer, 300);
    }
  };

  const startTracking = () => {
    stopTracking();
    trackingTimerRef.current = window.setInterval(() => {
      try {
        if (previewPlayerRef.current && typeof previewPlayerRef.current.getCurrentTime === 'function') {
          const iframe = document.getElementById('studio-yt-iframe-slot');
          if (iframe && iframe.parentElement) {
            const t = previewPlayerRef.current.getCurrentTime();
            if (typeof t === 'number' && !isNaN(t)) {
              setCurrentTime(t);
              if (currentPreviewClip && t >= currentPreviewClip.end_time) {
                if (isLooping) {
                  previewPlayerRef.current.seekTo(currentPreviewClip.start_time, true);
                } else {
                  previewPlayerRef.current.pauseVideo();
                }
              }
            }
          }
        } else if (directVideoRef.current) {
          const t = directVideoRef.current.currentTime;
          if (typeof t === 'number' && !isNaN(t)) {
            setCurrentTime(t);
            if (ambientVideoRef.current && Math.abs(ambientVideoRef.current.currentTime - t) > 0.3) {
              ambientVideoRef.current.currentTime = t;
            }
            if (currentPreviewClip && t >= currentPreviewClip.end_time) {
              if (isLooping) {
                directVideoRef.current.currentTime = currentPreviewClip.start_time;
                if (ambientVideoRef.current) ambientVideoRef.current.currentTime = currentPreviewClip.start_time;
              } else {
                directVideoRef.current.pause();
                if (ambientVideoRef.current) ambientVideoRef.current.pause();
                setIsPlaying(false);
              }
            }
          }
        }
      } catch (e) {}
    }, 150);
  };

  const stopTracking = () => {
    if (trackingTimerRef.current !== null) {
      clearInterval(trackingTimerRef.current);
      trackingTimerRef.current = null;
    }
  };

  useEffect(() => {
    initPreviewPlayer();
    return () => {
      stopTracking();
      if (previewPlayerRef.current) {
        try {
          previewPlayerRef.current.destroy();
        } catch (e) {}
        previewPlayerRef.current = null;
      }
    };
  }, [videoId, previewClipIndex]);

  // When previewClipIndex changes, seek player to new clip start
  useEffect(() => {
    setCurrentTime(clipStart);
    if (previewPlayerRef.current && typeof previewPlayerRef.current.seekTo === 'function') {
      try {
        previewPlayerRef.current.seekTo(clipStart, true);
      } catch (e) {}
    } else if (directVideoRef.current) {
      directVideoRef.current.currentTime = clipStart;
      if (ambientVideoRef.current) ambientVideoRef.current.currentTime = clipStart;
    }
  }, [previewClipIndex, clipStart]);

  const togglePlayPause = () => {
    if (previewPlayerRef.current) {
      try {
        if (isPlaying) {
          previewPlayerRef.current.pauseVideo();
        } else {
          if (currentPreviewClip && (currentTime >= currentPreviewClip.end_time || currentTime < currentPreviewClip.start_time)) {
            previewPlayerRef.current.seekTo(currentPreviewClip.start_time, true);
          }
          previewPlayerRef.current.playVideo();
        }
      } catch (e) {}
    } else if (directVideoRef.current) {
      if (isPlaying) {
        directVideoRef.current.pause();
        if (ambientVideoRef.current) ambientVideoRef.current.pause();
        setIsPlaying(false);
      } else {
        if (currentPreviewClip && (currentTime >= currentPreviewClip.end_time || currentTime < currentPreviewClip.start_time)) {
          directVideoRef.current.currentTime = currentPreviewClip.start_time;
          if (ambientVideoRef.current) ambientVideoRef.current.currentTime = currentPreviewClip.start_time;
        }
        directVideoRef.current.play();
        if (ambientVideoRef.current) ambientVideoRef.current.play().catch(() => {});
        setIsPlaying(true);
        startTracking();
      }
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (previewPlayerRef.current && typeof previewPlayerRef.current.seekTo === 'function') {
      try {
        previewPlayerRef.current.seekTo(newTime, true);
      } catch (e) {}
    } else if (directVideoRef.current) {
      directVideoRef.current.currentTime = newTime;
      if (ambientVideoRef.current) ambientVideoRef.current.currentTime = newTime;
    }
  };

  const handleRestart = () => {
    setCurrentTime(clipStart);
    if (previewPlayerRef.current && typeof previewPlayerRef.current.seekTo === 'function') {
      try {
        previewPlayerRef.current.seekTo(clipStart, true);
        previewPlayerRef.current.playVideo();
      } catch (e) {}
    } else if (directVideoRef.current) {
      directVideoRef.current.currentTime = clipStart;
      directVideoRef.current.play();
      setIsPlaying(true);
      startTracking();
    }
  };

  const toggleMute = () => {
    if (previewPlayerRef.current) {
      try {
        if (isMuted) {
          previewPlayerRef.current.unMute();
          setIsMuted(false);
        } else {
          previewPlayerRef.current.mute();
          setIsMuted(true);
        }
      } catch (e) {}
    } else if (directVideoRef.current) {
      directVideoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };


  return {
    isPlaying, setIsPlaying, currentTime, setCurrentTime, isMuted, setIsMuted,
    isLooping, setIsLooping, playerReady, faceBox, setFaceBox,
    directVideoRef, ambientVideoRef, previewPlayerRef, startTracking, stopTracking,
    togglePlayPause, handleSeek, handleRestart, toggleMute,
  };
}
