import { useRef, useState } from 'react';

/** Watermark branding state and upload/preset handlers. */
export function useWatermarkSettings() {
  // Watermark state & default configs
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(false);
  const [watermarkType, setWatermarkType] = useState<'image' | 'text'>('image');
  const [watermarkImageFileName, setWatermarkImageFileName] = useState<string>('');
  const [watermarkImageFilePath, setWatermarkImageFilePath] = useState<string>('');
  const [watermarkImageUrl, setWatermarkImageUrl] = useState<string>('');
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [watermarkSize, setWatermarkSize] = useState<number>(20);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(80);
  const [watermarkX, setWatermarkX] = useState<number>(88);
  const [watermarkY, setWatermarkY] = useState<number>(8);
  const [isUploadingWatermark, setIsUploadingWatermark] = useState<boolean>(false);
  const [isWatermarkDragging, setIsWatermarkDragging] = useState<boolean>(false);
  const phoneContainerRef = useRef<HTMLDivElement | null>(null);

  // Watermark handlers
  const uploadWatermarkFile = async (file: File) => {
    if (!file) return;
    setIsUploadingWatermark(true);
    let localUrl = '';
    try {
      localUrl = URL.createObjectURL(file);
      setWatermarkImageUrl(localUrl);
      setWatermarkImageFileName(file.name);

      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-watermark', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to upload watermark');
      }
      const data = await res.json();
      setWatermarkImageFilePath(data.file_path);
      setWatermarkImageFileName(data.filename || file.name);
      setWatermarkImageUrl(data.url || localUrl);
      setWatermarkEnabled(true);
    } catch (err) {
      console.error('Watermark upload error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to upload watermark image.';
      alert(msg);
      if (localUrl) {
        try { URL.revokeObjectURL(localUrl); } catch { /* ignore */ }
      }
      setWatermarkImageFilePath('');
      setWatermarkImageUrl('');
      setWatermarkImageFileName('');
    } finally {
      setIsUploadingWatermark(false);
    }
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadWatermarkFile(file);
    e.target.value = '';
  };

  const handleRemoveWatermarkImage = () => {
    setWatermarkImageFileName('');
    setWatermarkImageFilePath('');
    setWatermarkImageUrl('');
  };

  const getDefaultWatermarkConfig = (type: 'image' | 'text') => {
    if (type === 'image') {
      return {
        size: 20,
        opacity: 80,
        x: 88,
        y: 8,
      };
    } else {
      return {
        size: 20,
        opacity: 80,
        x: 50,
        y: 92,
      };
    }
  };

  const handleSelectWatermarkType = (type: 'image' | 'text') => {
    setWatermarkType(type);
    const defaults = getDefaultWatermarkConfig(type);
    setWatermarkSize(defaults.size);
    setWatermarkOpacity(defaults.opacity);
    setWatermarkX(defaults.x);
    setWatermarkY(defaults.y);
    if (type === 'text' && !watermarkText.trim()) {
      setWatermarkText('@channel');
    }
  };

  const handleResetWatermark = () => {
    const defaults = getDefaultWatermarkConfig(watermarkType);
    setWatermarkSize(defaults.size);
    setWatermarkOpacity(defaults.opacity);
    setWatermarkX(defaults.x);
    setWatermarkY(defaults.y);
    if (watermarkType === 'text' && !watermarkText.trim()) {
      setWatermarkText('@channel');
    }
  };

  const applyWatermarkPreset = (preset: 'tl' | 'tc' | 'tr' | 'c' | 'bl' | 'bc' | 'br') => {
    const halfW = Math.round(watermarkSize / 2);
    const leftX = Math.max(4, Math.min(50, halfW + 2));
    const rightX = Math.min(96, Math.max(50, 100 - halfW - 2));
    const topY = 8;
    const bottomY = 92;

    switch (preset) {
      case 'tl':
        setWatermarkX(leftX);
        setWatermarkY(topY);
        break;
      case 'tc':
        setWatermarkX(50);
        setWatermarkY(topY);
        break;
      case 'tr':
        setWatermarkX(rightX);
        setWatermarkY(topY);
        break;
      case 'c':
        setWatermarkX(50);
        setWatermarkY(50);
        break;
      case 'bl':
        setWatermarkX(leftX);
        setWatermarkY(bottomY);
        break;
      case 'bc':
        setWatermarkX(50);
        setWatermarkY(bottomY);
        break;
      case 'br':
        setWatermarkX(rightX);
        setWatermarkY(bottomY);
        break;
    }
  };


  return {
    watermarkEnabled, setWatermarkEnabled, watermarkType, setWatermarkType,
    watermarkImageFileName, watermarkImageFilePath, watermarkImageUrl, setWatermarkImageUrl,
    watermarkText, setWatermarkText, watermarkSize, setWatermarkSize,
    watermarkOpacity, setWatermarkOpacity, watermarkX, setWatermarkX, watermarkY, setWatermarkY,
    isUploadingWatermark, isWatermarkDragging, setIsWatermarkDragging, phoneContainerRef,
    uploadWatermarkFile, handleWatermarkUpload, handleRemoveWatermarkImage, handleSelectWatermarkType,
    handleResetWatermark, applyWatermarkPreset,
  };
}
