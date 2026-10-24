import { useState } from 'react';

/** Temporary-storage cleanup dialog state. */
export function useTempCleanup() {
  const [isClearingTemp, setIsClearingTemp] = useState<boolean>(false);
  const [tempClearMsg, setTempClearMsg] = useState<string>('');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);

  const handleClearTempClick = () => {
    setShowClearConfirmModal(true);
  };

  const executeClearTemp = async () => {
    if (isClearingTemp) return;
    setIsClearingTemp(true);
    setTempClearMsg('');
    try {
      const resp = await fetch('/api/clear-temp', { method: 'POST' });
      if (resp.ok) {
        const data = await resp.json();
        setTempClearMsg(`✓ ${data.message || 'Temp folder cleared!'}`);
        setTimeout(() => setTempClearMsg(''), 4500);
      } else {
        setTempClearMsg('Failed to clear temp cache');
      }
    } catch (e) {
      console.error('Error clearing temp cache:', e);
      setTempClearMsg('Error clearing temp cache');
    } finally {
      setIsClearingTemp(false);
      setShowClearConfirmModal(false);
    }
  };

  return {
    isClearingTemp,
    tempClearMsg,
    showClearConfirmModal,
    setShowClearConfirmModal,
    handleClearTempClick,
    executeClearTemp,
  };
}
