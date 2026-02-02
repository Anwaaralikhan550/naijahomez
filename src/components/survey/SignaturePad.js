'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * SignaturePad - Canvas-based signature capture component.
 *
 * Architecture notes:
 *   - Captures drawing via pointer events (works on mouse + touch).
 *   - Exposes an imperative API through onRef so the parent can call
 *     clear(), isEmpty(), and toDataURL() without lifting canvas state.
 *   - Returns a base64 PNG data-url that downstream consumers
 *     (Firestore storage, PDF renderer) can use directly.
 */
export default function SignaturePad({ onRef, width = 500, height = 200, penColor = '#000000', lineWidth = 2.5, disabled = false }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  // ── Initialise canvas context ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // HiDPI support — scale internal bitmap while keeping CSS size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = lineWidth;
    contextRef.current = ctx;

    // Fill with white so exported PNGs have a white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }, [width, height, penColor, lineWidth]);

  // ── Imperative handle exposed to parent ────────────────────────
  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = lineWidth;
    setHasStrokes(false);
  }, [width, height, penColor, lineWidth]);

  const isEmpty = useCallback(() => !hasStrokes, [hasStrokes]);

  const toDataURL = useCallback(() => {
    if (!canvasRef.current) return null;
    return canvasRef.current.toDataURL('image/png');
  }, []);

  useEffect(() => {
    if (onRef) {
      onRef({ clear, isEmpty, toDataURL });
    }
  }, [onRef, clear, isEmpty, toDataURL]);

  // ── Drawing handlers ───────────────────────────────────────────
  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Support both mouse and touch
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    e.preventDefault();
    const { x, y } = getPointerPos(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
    setHasStrokes(true);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const { x, y } = getPointerPos(e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e?.preventDefault();
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`border-2 rounded-lg cursor-crosshair select-none ${
        disabled
          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
          : 'border-gray-300 bg-white hover:border-blue-400'
      }`}
      style={{ touchAction: 'none', width, height }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
}
