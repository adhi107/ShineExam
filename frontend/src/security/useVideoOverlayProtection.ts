/**
 * useVideoOverlayProtection
 * ─────────────────────────
 * Injects a hardware-accelerated black `<video>` overlay using a canvas stream.
 *
 * WHY THIS EXISTS:
 * Some software-based screen recorders (not OS-level PrtSc) capture GPU video
 * hardware overlays separately from the composited framebuffer. When they do,
 * they see the raw black canvas frames instead of the composited page content.
 * This is the same principle that makes Netflix/Spotify content appear black
 * in screenshots on some systems.
 *
 * WORKS FOR (possibly):
 *  - Some screen recording software that doesn't composite GPU video overlays
 *  - Browser-API `getDisplayMedia` sharing on some GPU configurations
 *
 * DOES NOT WORK FOR:
 *  - Windows PrtSc / Snipping Tool / Win+Shift+S  (OS compositor captures everything)
 *  - macOS Cmd+Shift+3/4  (OS compositor captures everything)
 *  - OBS / Bandicam / most professional recorders  (capture full framebuffer)
 *  - Hardware capture cards  (HDMI signal, OS-level)
 *  - Phone camera pointed at screen
 *
 * The ONLY reliable solution for browser content appearing black in ALL screenshots
 * is to wrap the app in Electron and call:
 *   mainWindow.setContentProtection(true)  // Works on Windows + macOS
 *
 * This hook is best-effort. Use it in combination with watermarking and
 * other deterrents, not as the sole protection.
 */

import { useEffect } from 'react';

export function useVideoOverlayProtection(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    // ── Create a 1×1 black canvas ─────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 2, 2);

    // ── Capture stream from canvas (1 fps is enough to maintain GPU overlay) ─
    let stream: MediaStream;
    try {
      stream = canvas.captureStream(1);
    } catch {
      return; // Not supported in this browser
    }

    // ── Create the video overlay ──────────────────────────────────────────
    const video = document.createElement('video');
    video.setAttribute('data-shine-overlay', 'true');
    video.srcObject = stream;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    // disablePictureInPicture forces browser to use a hardware video plane
    video.disablePictureInPicture = true;

    /**
     * CSS Strategy:
     *
     * opacity: 0.004  → Nearly invisible to the human eye (threshold ~0.01)
     *                   but sufficient to force the browser to maintain an
     *                   active GPU hardware video overlay.
     *
     * mix-blend-mode: difference
     *                 → difference(black, white) = white
     *                   difference(black, black) = black
     *                   Net visual effect: minimal colour inversion artefact
     *                   at 0.004 opacity = imperceptible.
     *
     * The GPU composites: user sees normal page.
     * Some capture tools that only read the video plane see: solid black.
     */
    video.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100vw',
      'height:100vh',
      // Must be below the flash overlay (2147483647) but above all page content
      'z-index:2147483640',
      'pointer-events:none',
      'opacity:0.004',
      'object-fit:cover',
      'mix-blend-mode:difference',
      // Force hardware compositing layer
      'transform:translateZ(0)',
      'will-change:transform',
      // Prevent the video element itself from being captured as a thumbnail
      '-webkit-user-select:none',
      'user-select:none',
    ].join(';');

    document.body.appendChild(video);

    // Play — required to maintain the hardware overlay
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Autoplay blocked — try on first user interaction
        const startOnInteraction = () => {
          video.play().catch(() => {});
          document.removeEventListener('click', startOnInteraction);
          document.removeEventListener('keydown', startOnInteraction);
        };
        document.addEventListener('click', startOnInteraction, { once: true });
        document.addEventListener('keydown', startOnInteraction, { once: true });
      });
    }

    return () => {
      video.pause();
      video.remove();
      stream.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);
}
