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

function toAlienChar(ch: string): string {
  return ALIEN_GLYPHS[ch] || ch;
}

// Sentence-ending punctuation that triggers a pause
const SENTENCE_END = /[.!?]/;
const DECODE_LAG = 8; // Characters behind the typing cursor before decoding starts

interface TypewriterTextProps {
  text: string;
  speed?: number;         // ms per character (base speed)
  onComplete?: () => void;
  onWordSound?: () => void; // called per word for sound
  className?: string;
  skipAnimation?: boolean;  // show full text immediately
}

export function TypewriterText({
  text,
  speed = 25,
  onComplete,
  onWordSound,
  className = "",
  skipAnimation = false,
}: TypewriterTextProps) {
  const [typedCount, setTypedCount] = useState(0);
  const [decodedCount, setDecodedCount] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const completedRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const charsSinceSound = useRef(0);

  // Skip animation mode
  useEffect(() => {
    if (skipAnimation && !completedRef.current) {
      setTypedCount(text.length);
      setDecodedCount(text.length);
      setIsDone(true);
      completedRef.current = true;
      onComplete?.();
    }
  }, [skipAnimation, text.length, onComplete]);

  // Typing effect — advances typedCount
  useEffect(() => {
    if (isDone || skipAnimation) return;
    if (typedCount >= text.length) {
      // Typing done, but wait for decode to catch up
      return;
    }

    const now = Date.now();
    if (now < pauseUntilRef.current) {
      // We're in a sentence pause
      const remaining = pauseUntilRef.current - now;
      const timer = setTimeout(() => {
        setTypedCount((c) => c + 1);
      }, remaining);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      const newCount = typedCount + 1;
      const char = text[typedCount];

      // Sound: play every 3-4 characters (roughly per word)
      charsSinceSound.current++;
      if (charsSinceSound.current >= 3 && char === " ") {
        charsSinceSound.current = 0;
        onWordSound?.();
      }

      // Check for sentence pause
      if (SENTENCE_END.test(char) && newCount < text.length) {
        // Next char should be a space or end — this is a real sentence break
        const nextChar = text[newCount];
        if (nextChar === " " || nextChar === "\n" || newCount >= text.length) {
          pauseUntilRef.current = Date.now() + 400; // 400ms pause
        }
      }

      setTypedCount(newCount);
    }, speed);

    return () => clearTimeout(timer);
  }, [typedCount, text, speed, isDone, skipAnimation, onWordSound]);

  // Decode effect — trails behind typedCount by DECODE_LAG chars
  useEffect(() => {
    if (isDone || skipAnimation) return;

    const targetDecode = Math.max(0, typedCount - DECODE_LAG);
    if (decodedCount >= targetDecode && decodedCount < text.length) {
      // Wait for more typing
      return;
    }
    if (decodedCount >= text.length) {
      // Fully decoded
      if (typedCount >= text.length && !completedRef.current) {
        completedRef.current = true;
        setIsDone(true);
        onComplete?.();
      }
      return;
    }

    // Decode at the same rate as typing
    const timer = setTimeout(() => {
      setDecodedCount((c) => Math.min(c + 1, text.length));
    }, speed);

    return () => clearTimeout(timer);
  }, [decodedCount, typedCount, text.length, speed, isDone, skipAnimation, onComplete]);

  // Once typing is done, fast-decode remaining chars
  useEffect(() => {
    if (typedCount < text.length || isDone || skipAnimation) return;
    if (decodedCount >= text.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        setIsDone(true);
        onComplete?.();
      }
      return;
    }

    // Fast decode remaining
    const timer = setTimeout(() => {
      setDecodedCount((c) => Math.min(c + 1, text.length));
    }, 15); // faster than normal speed

    return () => clearTimeout(timer);
  }, [typedCount, decodedCount, text.length, isDone, skipAnimation, onComplete]);

  // Skip on click
  const handleClick = useCallback(() => {
    if (!isDone) {
      setTypedCount(text.length);
      setDecodedCount(text.length);
      if (!completedRef.current) {
        completedRef.current = true;
        setIsDone(true);
        onComplete?.();
      }
    }
  }, [isDone, text.length, onComplete]);

  // Build displayed text:
  // [0..decodedCount) = English
  // [decodedCount..typedCount) = alien glyphs
  // [typedCount..end) = not shown
  let rendered = "";
  for (let i = 0; i < typedCount; i++) {
    if (i < decodedCount) {
      rendered += text[i];
    } else {
      rendered += toAlienChar(text[i]);
    }
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer select-none ${className}`}
    >
      {rendered}
      {!isDone && <span className="animate-pulse opacity-60">|</span>}
    </span>
  );
}
