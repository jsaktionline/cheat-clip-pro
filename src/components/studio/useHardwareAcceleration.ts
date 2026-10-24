import { useEffect, useState } from 'react';

import { getClientGpuName, isWebCodecsGpuSupported } from '../../services/webcodecsRenderer';
import { resilientFetch } from '../../utils/api';
import type { HardwareAccelInfo, HardwareAccelOption } from '../../types';
import { getSavedStudioPreferences } from './preferences';

/** Encoder selection plus the backend hardware-capability probe. */
export function useHardwareAcceleration() {
  const [isLocalhost] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      return host === 'localhost' || host === '127.0.0.1';
    }
    return false;
  });

  const [clientGpuName] = useState<string>(() => getClientGpuName());
  const [hasWebCodecs] = useState<boolean>(() => isWebCodecsGpuSupported());

  // Default to server 'auto' locally; force a client engine when deployed.
  const [hardwareAccel, setHardwareAccel] = useState<HardwareAccelOption>(() => {
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocal) {
      return isWebCodecsGpuSupported() ? 'client_gpu' : 'browser_wasm';
    }
    const saved = getSavedStudioPreferences().hardwareAccel;
    return saved && saved !== 'browser_wasm' ? saved : 'auto';
  });
  const [hardwareInfo, setHardwareInfo] = useState<HardwareAccelInfo | null>(null);
  const [hwDropdownOpen, setHwDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isLocalhost) {
      // On a deployed domain, force the client engine (prefer GPU).
      setHardwareAccel(isWebCodecsGpuSupported() ? 'client_gpu' : 'browser_wasm');
      return;
    }

    const fetchHardwareSupport = async () => {
      try {
        const res = await resilientFetch('/api/hardware-accel', {
          maxRetries: 4,
          retryDelay: 1000,
          silent: true,
        });
        if (res.ok) {
          const data: HardwareAccelInfo = await res.json();
          setHardwareInfo(data);
        }
      } catch {
        // Backend offline or still loading.
      }
    };

    void fetchHardwareSupport();
  }, [isLocalhost]);

  return {
    isLocalhost,
    clientGpuName,
    hasWebCodecs,
    hardwareAccel,
    setHardwareAccel,
    hardwareInfo,
    hwDropdownOpen,
    setHwDropdownOpen,
  };
}
