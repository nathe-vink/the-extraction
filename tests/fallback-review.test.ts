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

test("Empty answer → score 0 + empty-category comment", () => {
  const { comment, score } = generateFallbackReview("", false, new Set());
  assert(score === 0, `score is 0 (community voting only)`);
  assert(comment.length > 0, "comment is non-empty");
  assert(
    comment.toLowerCase().includes("nothing") || comment.toLowerCase().includes("blank") || comment.toLowerCase().includes("no answer"),
    `empty-category comment: "${comment}"`
  );
});

test("Very short answer (≤5 words) → score 0 + snippet in comment", () => {
  const answer = "dogs are great pets";
  const { comment, score } = generateFallbackReview(answer, false, new Set());
  assert(score === 0, `score is 0 (community voting only)`);
  assert(comment.includes("dogs"), `short comment references answer snippet: "${comment}"`);
});

test("Medium answer (6–15 words) → score 0 + snippet in comment", () => {
  const answer = "I would bring my dog because dogs are loyal and useful companions";
  const { comment, score } = generateFallbackReview(answer, false, new Set());
  assert(score === 0, `score is 0 (community voting only)`);
  assert(comment.includes("I would bring"), `medium comment references first snippet: "${comment}"`);
});

test("Long answer (>30 words) → score 0 + snippet in comment", () => {
  const answer = "I would bring my collection of vintage vinyl records because music is the universal language of the soul and even aliens must appreciate the rhythmic complexity of Earth jazz and its emotional resonance";
  const { comment, score } = generateFallbackReview(answer, false, new Set());
  assert(score === 0, `score is 0 (community voting only)`);
  assert(comment.includes("I would bring"), `long comment references first snippet: "${comment}"`);
});

test("Drawing round → score 0 + drawing-specific comment, no data URL", () => {
  const drawingDataUrl = "data:image/png;base64,abc123";
  const { comment, score } = generateFallbackReview(drawingDataUrl, true, new Set());
  assert(score === 0, `score is 0 (community voting only)`);
  assert(!comment.includes("data:image"), "drawing comment doesn't reference data URL");
  assert(
    comment.toLowerCase().includes("draw") || comment.toLowerCase().includes("image") ||
    comment.toLowerCase().includes("visual") || comment.toLowerCase().includes("scan") ||
    comment.toLowerCase().includes("crowd"),
    `drawing-specific comment: "${comment}"`
  );
});

test("Score is always 0 regardless of answer length (no effort-based scoring)", () => {
  const cases = ["", "short", "medium length answer here today", "word ".repeat(40).trim()];
  for (const answer of cases) {
    const { score } = generateFallbackReview(answer, false, new Set());
    assert(score === 0, `"${answer.slice(0, 20)}..." → score ${score} === 0`);
  }
});

test("used Set prevents comment repetition within a round", () => {
  const used = new Set<number>();
  const comments = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const { comment } = generateFallbackReview("short answer here", false, used);
    comments.add(comment);
  }
  assert(comments.size >= 4, `got ${comments.size} unique comments out of 6 calls (deduplication working)`);
});

test("Comments no longer reference 'Points' (misleading when score is 0)", () => {
  const answers = ["", "short", "medium answer here", "word ".repeat(35).trim()];
  let pointsFound = false;
  for (const answer of answers) {
    const { comment } = generateFallbackReview(answer, false, new Set());
    if (/\bpoints\b/i.test(comment)) {
      pointsFound = true;
      console.error(`  Found "Points" in comment: "${comment}"`);
    }
  }
  assert(!pointsFound, "no fallback comment ends with bare 'Points'");
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
