/**
 * Unit tests for generateFallbackReview
 * Run with: npx tsx tests/fallback-review.test.ts
 */
import { generateFallbackReview } from "../src/lib/zyrax-fallbacks";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function test(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("Empty answer → minimum score range + empty comment", () => {
  const { comment, score } = generateFallbackReview("", false, 1000, new Set());
  assert(score >= 100 && score <= 400, `score ${score} in 15–40% range (100–400 of 1000)`);
  assert(comment.length > 0, "comment is non-empty");
  assert(
    comment.toLowerCase().includes("nothing") || comment.toLowerCase().includes("blank") || comment.toLowerCase().includes("empty"),
    `empty-category comment: "${comment}"`
  );
});

test("Very short answer (≤5 words) → low-mid score + snippet in comment", () => {
  const answer = "dogs are great pets";
  const { comment, score } = generateFallbackReview(answer, false, 1000, new Set());
  assert(score >= 200 && score <= 500, `score ${score} in 25–50% range (200–500 of 1000)`);
  assert(comment.includes("dogs"), `short comment references answer snippet: "${comment}"`);
});

test("Medium answer (6–15 words) → mid score + snippet in comment", () => {
  const answer = "I would bring my dog because dogs are loyal and useful companions";
  const { comment, score } = generateFallbackReview(answer, false, 1000, new Set());
  assert(score >= 350 && score <= 700, `score ${score} in 40–70% range`);
  assert(comment.includes("I would bring"), `medium comment references first snippet: "${comment}"`);
});

test("Long answer (>30 words) → higher score + snippet in comment", () => {
  const answer = "I would bring my collection of vintage vinyl records because music is the universal language of the soul and even aliens must appreciate the rhythmic complexity of Earth jazz and its emotional resonance";
  const { comment, score } = generateFallbackReview(answer, false, 1000, new Set());
  assert(score >= 500 && score <= 900, `score ${score} in 55–90% range`);
  assert(comment.includes("I would bring"), `long comment references first snippet: "${comment}"`);
});

test("Drawing round → drawing-specific comment, no snippet", () => {
  const drawingDataUrl = "data:image/png;base64,abc123";
  const { comment, score } = generateFallbackReview(drawingDataUrl, true, 1000, new Set());
  assert(score >= 300 && score <= 700, `drawing score ${score} in 30–70% range`);
  assert(!comment.includes("data:image"), "drawing comment doesn't reference data URL");
  assert(
    comment.toLowerCase().includes("draw") || comment.toLowerCase().includes("image") || comment.toLowerCase().includes("visual") || comment.toLowerCase().includes("scan"),
    `drawing-specific comment: "${comment}"`
  );
});

test("Final plea (maxScore=2000) → scores scale correctly", () => {
  const answer = "Please save me I have so much to offer the galaxy";
  const { score } = generateFallbackReview(answer, false, 2000, new Set());
  assert(score >= 700 && score <= 1800, `final-plea score ${score} scales to 2000 max`);
});

test("used Set prevents comment repetition within a round", () => {
  const used = new Set<number>();
  const comments = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const { comment } = generateFallbackReview("short answer", false, 1000, used);
    comments.add(comment);
  }
  assert(comments.size >= 4, `got ${comments.size} unique comments out of 6 calls (deduplication working)`);
});

test("Scores vary with answer length (effort-based, not purely random)", () => {
  const runs = 10;
  const emptyScores: number[] = [];
  const longScores: number[] = [];
  const longAnswer = "word ".repeat(40).trim();

  for (let i = 0; i < runs; i++) {
    emptyScores.push(generateFallbackReview("", false, 1000, new Set()).score);
    longScores.push(generateFallbackReview(longAnswer, false, 1000, new Set()).score);
  }

  const avgEmpty = emptyScores.reduce((a, b) => a + b, 0) / runs;
  const avgLong = longScores.reduce((a, b) => a + b, 0) / runs;
  assert(avgLong > avgEmpty + 100, `avg long (${avgLong.toFixed(0)}) is meaningfully higher than avg empty (${avgEmpty.toFixed(0)})`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
