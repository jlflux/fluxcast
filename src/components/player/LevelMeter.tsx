"use client";

import { useEffect, useRef } from "react";

/**
 * Live audio level meter — the bar-graph kind.
 *
 * Its job is reassurance: a fan who hears nothing needs to know within a second
 * whether the broadcast is silent or their phone is muted. Bars moving means
 * audio is arriving.
 *
 * Reads from a Web Audio AnalyserNode rather than faking motion, so the bars
 * genuinely reflect the broadcast. Drawn on a canvas at animation-frame rate;
 * a silent stream shows flat bars, which is itself the useful signal.
 */

/** Frequency bands per bar, low to high. Log-ish spacing matches hearing. */
const BAR_COUNT = 28;

export function LevelMeter({
  analyser,
  active,
}: {
  analyser: AnalyserNode | null;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  /** Smoothed bar heights, so bars fall gently instead of flickering. */
  const levelsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);

      // Match the backing store to the CSS size for a crisp result on retina.
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, width, height);

      if (analyser && bins && active) {
        analyser.getByteFrequencyData(bins as Uint8Array<ArrayBuffer>);
      }

      const gap = 3;
      const barWidth = (width - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      // Ignore the top of the spectrum: it is mostly empty for speech and
      // would leave the right-hand bars permanently flat.
      const usableBins = bins ? Math.floor(bins.length * 0.6) : 0;

      for (let i = 0; i < BAR_COUNT; i += 1) {
        let target = 0;

        if (bins && active && usableBins > 0) {
          // Log spacing: more bars over the low frequencies where voices live.
          const start = Math.floor((i / BAR_COUNT) ** 1.6 * usableBins);
          const end = Math.max(
            start + 1,
            Math.floor(((i + 1) / BAR_COUNT) ** 1.6 * usableBins),
          );
          let sum = 0;
          for (let b = start; b < end; b += 1) sum += bins[b];
          target = sum / (end - start) / 255;
        }

        // Rise quickly, fall slowly — reads as a level meter rather than noise.
        const previous = levelsRef.current[i];
        levelsRef.current[i] = target > previous ? target : previous * 0.86 + target * 0.14;

        const level = levelsRef.current[i];
        const barHeight = Math.max(2, level * height);
        const x = i * (barWidth + gap);
        const y = height - barHeight;

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, "#12b0c6");
        gradient.addColorStop(1, "#6ee7f5");
        ctx.fillStyle = level > 0.02 ? gradient : "#232837";

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    draw();
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [analyser, active]);

  return (
    <canvas
      ref={canvasRef}
      className="h-16 w-full"
      role="img"
      aria-label={active ? "Live audio level" : "Audio level, not connected"}
    />
  );
}
