import React, { useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Dynamic Fingerprint Collector (Module 1 — SWE3004 FR1 / Architecture Fig 9.1)
 * Continuously samples device, browser, canvas, display attributes, and passive
 * behavioral biometrics (mouse movement, typing cadence) in the background.
 * Posts enriched heartbeats to the Session Gateway at defined intervals.
 */
export default function DynamicFingerprintCollector({ onTelemetryUpdate, activeApp = 'General Gateway' }) {
  const mouseMovesRef = useRef([]);
  const keystrokesRef = useRef([]);
  const lastKeyDownRef = useRef({});

  useEffect(() => {
    // --- Passive biometric collectors ---
    const handleMouseMove = (e) => {
      mouseMovesRef.current.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      if (mouseMovesRef.current.length > 80) mouseMovesRef.current.shift();
    };
    const handleKeyDown = (e) => {
      lastKeyDownRef.current[e.code] = Date.now();
    };
    const handleKeyUp = (e) => {
      const downTime = lastKeyDownRef.current[e.code];
      if (downTime) {
        keystrokesRef.current.push(Date.now() - downTime);
        if (keystrokesRef.current.length > 50) keystrokesRef.current.shift();
        delete lastKeyDownRef.current[e.code];
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('keyup', handleKeyUp, { passive: true });

    // --- Canvas fingerprint ---
    const getCanvasHash = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'alphabetic';
        ctx.font = '14px "Arial"';
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

    // --- Extract behavioral biometric features ---
    const getBiometrics = () => {
      const moves = mouseMovesRef.current;
      let avgSpeed = 0;
      let jitterScore = 0;
      let directionChanges = 0;

      if (moves.length > 2) {
        let totalDist = 0;
        let totalTime = 0;
        let prevDx = 0;
        let prevDy = 0;
        for (let i = 1; i < moves.length; i++) {
          const dx = moves[i].x - moves[i - 1].x;
          const dy = moves[i].y - moves[i - 1].y;
          const dt = moves[i].t - moves[i - 1].t;
          const dist = Math.sqrt(dx * dx + dy * dy);
          totalDist += dist;
          totalTime += dt;
          // Direction change detection
          if (i > 1 && (Math.sign(dx) !== Math.sign(prevDx) || Math.sign(dy) !== Math.sign(prevDy))) {
            directionChanges++;
          }
          jitterScore += Math.abs(dist - (totalDist / i));
          prevDx = dx;
          prevDy = dy;
        }
        avgSpeed = totalTime > 0 ? totalDist / totalTime : 0;
        jitterScore = moves.length > 0 ? jitterScore / moves.length : 0;
      }

      const dwells = keystrokesRef.current;
      const avgDwellMs = dwells.length > 0
        ? Math.round(dwells.reduce((a, b) => a + b, 0) / dwells.length)
        : 0;

      return {
        mouseDynamics: {
          movesCount: moves.length,
          avgSpeed: Math.round(avgSpeed * 100) / 100,
          jitterScore: Math.round(jitterScore),
          directionChanges,
          isHeadless: moves.length === 0
        },
        typingDynamics: {
          keystrokesCount: dwells.length,
          avgDwellMs
        }
      };
    };

    const sendHeartbeat = async () => {
      const token = localStorage.getItem('session_firewall_token');
      if (!token) return;

      try {
        const biometrics = getBiometrics();

        const res = await api.post('/gateway/telemetry/heartbeat', {
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          canvasHash: getCanvasHash(),
          targetApplication: activeApp,
          biometrics
        });

        if (res.data?.success && onTelemetryUpdate) {
          onTelemetryUpdate(res.data.scores);
        }
      } catch {
        // Silently handled — non-critical background sensor
      }
    };

    // Initial heartbeat on mount
    sendHeartbeat();

    // Re-sample every 12 seconds (NFR1 — low latency overhead)
    const interval = setInterval(sendHeartbeat, 12000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeApp, onTelemetryUpdate]);

  return null; // Invisible background sensor
}
