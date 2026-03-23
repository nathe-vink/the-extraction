"use client";

import { useRef, useState, useEffect, useCallback } from "react";

const COLORS = [
  "#39ff14", // neon green
  "#ff6ec7", // neon pink
  "#00f0ff", // neon blue
  "#bf00ff", // neon purple
  "#ffff00", // neon yellow
  "#ff4444", // red
  "#ffffff", // white
  "#000000", // black (eraser on dark bg)
];

const BRUSH_SIZES = [3, 6, 12];

interface DrawingCanvasProps {
  onSubmit: (dataUrl: string) => void;
  disabled?: boolean;
}

export function DrawingCanvas({ onSubmit, disabled = false }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas with dark background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const drawLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    },
    [color, brushSize]
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      const pos = getPos(e);
      setIsDrawing(true);
      lastPosRef.current = pos;
      // Draw a dot for single clicks
      drawLine(pos, pos);
    },
    [disabled, getPos, drawLine]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();
      const pos = getPos(e);
      if (lastPosRef.current) {
        drawLine(lastPosRef.current, pos);
      }
      lastPosRef.current = pos;
    },
    [isDrawing, disabled, getPos, drawLine]
  );

  const handleEnd = useCallback(() => {
    setIsDrawing(false);
    lastPosRef.current = null;
  }, []);

  const handleClear = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSubmit(dataUrl);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        className="border border-neon-green/30 rounded-lg touch-none"
        style={{
          width: "100%",
          maxWidth: "280px",
          aspectRatio: "1 / 1",
          imageRendering: "pixelated",
        }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />

      {/* Color palette */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="w-7 h-7 rounded-md border-2 transition-transform"
            style={{
              backgroundColor: c,
              borderColor: color === c ? "#ffffff" : "transparent",
              transform: color === c ? "scale(1.15)" : "scale(1)",
            }}
          />
        ))}
      </div>

      {/* Brush size + controls */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              className={`flex items-center justify-center w-8 h-8 rounded border transition-colors ${
                brushSize === size
                  ? "border-neon-green bg-neon-green/20"
                  : "border-white/20 hover:border-white/40"
              }`}
            >
              <div
                className="rounded-full bg-white"
                style={{ width: Math.max(4, size), height: Math.max(4, size) }}
              />
            </button>
          ))}
        </div>

        <button
          onClick={handleClear}
          className="px-3 py-1.5 text-xs font-pixel border border-red-400/40 text-red-400 rounded hover:bg-red-400/10 transition-colors"
        >
          Clear
        </button>

        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="btn-neon px-4 py-1.5 text-xs"
        >
          Done
        </button>
      </div>
    </div>
  );
}
