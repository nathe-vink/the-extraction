"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Alien glyph substitution map
const ALIEN_GLYPHS: Record<string, string> = {
  a: "\u0E04", b: "\u0E52", c: "\u0E08", d: "\u0E14", e: "\u0E07",
  f: "\u0E1F", g: "\u0E2B", h: "\u0E2D", i: "\u0E35", j: "\u0E0A",
  k: "\u0E01", l: "\u0E25", m: "\u0E21", n: "\u0E19", o: "\u0E2A",
  p: "\u0E1B", q: "\u0E20", r: "\u0E23", s: "\u0E28", t: "\u0E17",
  u: "\u0E22", v: "\u0E27", w: "\u0E2C", x: "\u0E0B", y: "\u0E22",
  z: "\u0E0C",
  A: "\u0E04", B: "\u0E52", C: "\u0E08", D: "\u0E14", E: "\u0E07",
  F: "\u0E1F", G: "\u0E2B", H: "\u0E2D", I: "\u0E35", J: "\u0E0A",
  K: "\u0E01", L: "\u0E25", M: "\u0E21", N: "\u0E19", O: "\u0E2A",
  P: "\u0E1B", Q: "\u0E20", R: "\u0E23", S: "\u0E28", T: "\u0E17",
  U: "\u0E22", V: "\u0E27", W: "\u0E2C", X: "\u0E0B", Y: "\u0E22",
  Z: "\u0E0C",
};

function toAlienText(text: string): string {
  return text
    .split("")
    .map((ch) => ALIEN_GLYPHS[ch] || ch)
    .join("");
}

interface TypewriterTextProps {
  text: string;
  speed?: number;         // ms per character
  decodeDelay?: number;   // ms before decode starts after typing completes
  decodeDuration?: number; // ms for the full decode animation
  onComplete?: () => void;
  onTick?: () => void;    // called per character for sound hooks
  className?: string;
  skipAlienFont?: boolean;
}

export function TypewriterText({
  text,
  speed = 25,
  decodeDelay = 300,
  decodeDuration = 600,
  onComplete,
  onTick,
  className = "",
  skipAlienFont = false,
}: TypewriterTextProps) {
  const [displayedCount, setDisplayedCount] = useState(0);
  const [decodeProgress, setDecodeProgress] = useState(0); // 0 = alien, 1 = english
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [isFullyDone, setIsFullyDone] = useState(false);
  const completedRef = useRef(false);

  // Typing effect
  useEffect(() => {
    if (isFullyDone) return;
    if (displayedCount >= text.length) {
      setIsTypingDone(true);
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedCount((c) => c + 1);
      onTick?.();
    }, speed);

    return () => clearTimeout(timer);
  }, [displayedCount, text.length, speed, onTick, isFullyDone]);

  // Decode animation after typing completes
  useEffect(() => {
    if (!isTypingDone || skipAlienFont || isFullyDone) {
      if (isTypingDone && skipAlienFont && !completedRef.current) {
        completedRef.current = true;
        setDecodeProgress(1);
        setIsFullyDone(true);
        onComplete?.();
      }
      return;
    }

    const startTime = Date.now() + decodeDelay;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) return;
      const progress = Math.min(1, elapsed / decodeDuration);
      setDecodeProgress(progress);

      if (progress >= 1) {
        clearInterval(interval);
        if (!completedRef.current) {
          completedRef.current = true;
          setIsFullyDone(true);
          onComplete?.();
        }
      }
    }, 30);

    return () => clearInterval(interval);
  }, [isTypingDone, skipAlienFont, decodeDelay, decodeDuration, onComplete, isFullyDone]);

  // Skip on click
  const handleClick = useCallback(() => {
    if (!isFullyDone) {
      setDisplayedCount(text.length);
      setIsTypingDone(true);
      setDecodeProgress(1);
      if (!completedRef.current) {
        completedRef.current = true;
        setIsFullyDone(true);
        onComplete?.();
      }
    }
  }, [isFullyDone, text.length, onComplete]);

  // Build displayed text with partial decode
  const visibleText = text.slice(0, displayedCount);
  let renderedText: string;

  if (skipAlienFont || decodeProgress >= 1) {
    renderedText = visibleText;
  } else if (decodeProgress <= 0) {
    renderedText = toAlienText(visibleText);
  } else {
    // Partially decoded — decode from left to right
    const decodedChars = Math.floor(visibleText.length * decodeProgress);
    const decoded = visibleText.slice(0, decodedChars);
    const alien = toAlienText(visibleText.slice(decodedChars));
    renderedText = decoded + alien;
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer ${className}`}
      style={{ userSelect: "none" }}
    >
      {renderedText}
      {!isFullyDone && <span className="animate-pulse opacity-60">|</span>}
    </span>
  );
}
