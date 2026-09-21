import React, { useEffect } from 'react';
import api from '../services/api';

/**
 * Dynamic Fingerprint Collector (Module 1 - Architecture Fig 9.1 & FR1)
 * Continuously samples device, browser, canvas, and display attributes in the background
 * and posts heartbeats to the Session Gateway at defined intervals.
 */
export default function DynamicFingerprintCollector({ onTelemetryUpdate, activeApp = 'General Gateway' }) {
  useEffect(() => {
    // Generate lightweight canvas fingerprint hash
    const getCanvasHash = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px "Arial"';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('SessionFirewall', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('ContinuousAuth', 4, 17);
        const dataUrl = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
          hash |= 0;
        }
        return 'cv_' + Math.abs(hash).toString(16);
      } catch (e) {
        return 'cv_default_7a8f9';
      }
    };

    const sendHeartbeat = async () => {
      const token = localStorage.getItem('session_firewall_token');
      if (!token) return;

      try {
        const screenResolution = `${window.screen.width}x${window.screen.height}`;
        const canvasHash = getCanvasHash();

        const res = await api.post('/gateway/telemetry/heartbeat', {
          screenResolution,
          canvasHash,
          targetApplication: activeApp
        });

        if (res.data?.success && onTelemetryUpdate) {
          onTelemetryUpdate(res.data.scores);
        }
      } catch (err) {
        // Handled silently
      }
    };

    // Initial heartbeat
    sendHeartbeat();

    // Re-sample at defined intervals (every 12 seconds per NFR1 low added latency)
    const interval = setInterval(sendHeartbeat, 12000);
    return () => clearInterval(interval);
  }, [activeApp, onTelemetryUpdate]);

  return null;
}
