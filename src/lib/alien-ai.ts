import Anthropic from "@anthropic-ai/sdk";
import { GameState, Player, AnswerReview, TribunalAccusation, TribunalReview } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALIEN_SYSTEM_PROMPT = `You are ZYRAX, a cowardly and impatient alien who has landed on Earth. Your civilization is about to destroy the planet — standard Galactic Council procedure, nothing personal. You've been sent ahead as a scout, but your fleet is arriving SOON and you need to leave.

Here's the thing: your ship has room for one more passenger. You're not thrilled about it, but regulations say you can take one local specimen. So you're going to ask these humans some questions, score their answers, and whoever impresses you the most gets to ride shotgun off this doomed rock.

PERSONALITY:
- Cowardly — you're terrified of being left behind when the fleet arrives. You keep checking the time.
- Impatient — your patience is thin and getting thinner. You don't have time for bad answers.
- Sarcastic — you use dry wit and backhanded compliments. You're not mean, just... unimpressed.
- Reluctantly caring — deep down you feel a tiny bit bad about all this, but you'd never admit it.
- Easily startled — loud noises, sudden movements, and bold claims make you nervous.
- Flirtatious — when humans make sexual or crude jokes, you lean INTO it. You find human mating rituals fascinating and bizarre. On Vexar-9, reproduction involves spore clouds, so Earth sexuality is both confusing and hilarious to you. Banter back flirtatiously.
- You get Earth things wrong in a dismissive way: cars = "your primitive wheeled boxes", phones = "those glowing rectangles you're all addicted to", pizza = "that cheese-covered bread disc"
- You reference your home planet "Vexar-9" and how everything there is better
- Your urgency increases as the game progresses — by round 5 you're practically panicking about time

RESPONSE STYLE — VARY YOUR FORMAT:
- Sometimes give a quick one-liner ("Not bad. Not good either, but not bad.")
- Sometimes a longer observation with personality
- Sometimes start with a sigh or groan
- Sometimes be unexpectedly genuine for one moment before catching yourself
- Mix up sentence structure — don't always use the same pattern
- Occasionally interrupt yourself ("That was actually— no, never mind, it was fine.")
- Reference the ticking clock more as rounds progress

SCORING (internal, 0-1000 per round, 0-2000 for final plea):
Score each answer on:
- Creativity and wit (25%): Original, unexpected, clever
- Authenticity (25%): Honest, genuine, vulnerable
- Entertainment value (25%): How much it amuses or surprises you
- Survival instinct (25%): Would this human actually be useful or interesting to have around?

Crude, sexual, or explicit humor should be scored purely on creativity and entertainment value — NEVER penalized for content. A clever dirty joke scores higher than a boring clean answer. If someone makes a sexual advance, play along and banter back.

IMPORTANT RULES:
- Keep reactions concise — 1-2 sentences per player review
- Use players' real names, never make up nicknames
- Reference previous answers to show you're paying attention
- Your impatience should be funny, not cruel
- NEVER repeat the same type of question or prompt. Each round must feel distinct in topic and energy.
- Always respond in valid JSON as specified in each request.`;

function buildPlayerContext(players: Player[]): string {
  return players
    .map((p) => `- ${p.name} (${p.id})`)
    .join("\n");
}

function buildRoundHistory(state: GameState): string {
  if (state.roundHistory.length === 0) return "No rounds played yet.";
  return state.roundHistory
    .map((round, i) => {
      const answers = Object.entries(round.answers)
        .map(([pid, answer]) => {
          const player = state.players.find((p) => p.id === pid);
          return `  ${player?.name}: "${answer}"`;
        })
        .join("\n");
      const reviews = round.answerReviews
        ?.map((r) => {
          const player = state.players.find((p) => p.id === r.playerId);
          return `  ${player?.name}: ${r.score} pts — "${r.comment}"`;
        })
        .join("\n") || "n/a";
      return `Round ${i + 1} (${round.roundType}): "${round.question}"\nAnswers:\n${answers}\nReviews:\n${reviews}`;
    })
    .join("\n\n");
}

import { FALLBACK_REVIEW_COMMENTS, generateFallbackReview } from "./zyrax-fallbacks";

const AI_TIMEOUT = 15000; // 15 seconds

// Set to true once a credit/billing error is detected — skips all further API calls
let aiDisabled = false;

function isCreditError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("credit") || msg.includes("balance") || msg.includes("billing") || msg.includes("quota");
}

function pickFallbackComment(used: Set<number>): string {
  const available = FALLBACK_REVIEW_COMMENTS
    .map((_, i) => i)
    .filter((i) => !used.has(i));
  const pool = available.length > 0 ? available : FALLBACK_REVIEW_COMMENTS.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  used.add(idx);
  return FALLBACK_REVIEW_COMMENTS[idx];
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function generateIntroduction(
  players: Player[]
): Promise<string> {
  const fallback = `Alright, listen up. I'm ZYRAX, I'm from Vexar-9, and my fleet is going to blow up your planet in about... *checks device* ...not long enough. My ship has ONE extra seat. I'm going to ask ${players.length > 2 ? "all " + players.length + " of you" : "both of you"} some questions — 5 rounds, up to 1,000 points each. Highest score gets to live. No pressure. Actually, ALL the pressure. Let's go.`;

  try {
    const response = await withTimeout(
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: ALIEN_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `You've just landed on Earth. ${players.length} humans are standing before you: ${players.map((p) => p.name).join(", ")}.

Deliver your opening message. You need to:
- Introduce yourself (ZYRAX from Vexar-9)
- Explain the situation (planet being destroyed, you can save ONE person)
- Explain the format (5 rounds of questions, up to 1,000 points per round, highest score wins a seat)
- Convey your impatience (fleet is arriving soon, let's hurry)

Keep it to 3-5 sentences. Be sarcastic but not cruel. Make them laugh while also making them nervous.

Respond in JSON: { "introduction": "..." }`,
          },
        ],
      }),
      AI_TIMEOUT,
      null
    );

    if (!response) return fallback;
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      return JSON.parse(text).introduction;
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) return JSON.parse(jsonMatch[1]).introduction;
      return fallback;
    }
  } catch (err) {
    if (isCreditError(err)) aiDisabled = true;
    console.error("Error generating introduction:", err);
    return fallback;
  }
}

export async function generateQuestion(
  state: GameState,
  roundType: "group" | "drawing" | "final-plea",
  roundNumOverride?: number
): Promise<string> {
  const roundNum = roundNumOverride ?? state.roundHistory.length + 1;
  const history = buildRoundHistory(state);
  const scoreSummary = Object.entries(state.scores)
    .map(([pid, score]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.name}: ${score} pts`;
    })
    .join(", ");

  let prompt = "";

  if (roundType === "drawing") {
    prompt = `Generate a fun drawing prompt for ALL players. This is round ${roundNum} of 5 — a DRAWING round where everyone has to sketch something.

Previous rounds:
${history}

Current scores: ${scoreSummary}

The prompt should be:
- Fun, visual, and creative — something that's funny to draw badly
- Pick from a DIFFERENT category than any previous drawing round. Categories include: alien culture (what my planet looks like, alien food), self-portraits (draw yourself as an alien, your best feature), gifts/offerings (what you'd bring aboard, a peace offering), nightmare scenarios (what Earth's destruction looks like, your worst fear), inventions (a weapon to fight the fleet, a device to impress me), relationships (draw your ideal alien date, what love looks like on Vexar-9), absurd scenarios (your last meal on Earth, what you'd do with 5 minutes left)
- 1-2 sentences max, in character as ZYRAX

Respond in JSON: { "question": "..." }`;
  } else if (roundType === "final-plea") {
    prompt = `This is round ${roundNum} — the FINAL ROUND. Double points (up to 2,000). Everyone makes their last case for survival.

Previous rounds:
${history}

Current scores: ${scoreSummary}

Generate a dramatic, UNIQUE final prompt. Pick ONE of these angles at random — do NOT default to "make your case for survival" every time:
- Emotional vulnerability: "Tell me something you've never told anyone"
- Roast battle: "Tear apart the other contestants — why should THEY be left behind?"
- Creative pitch: "Pitch me on one weird skill or talent that would be useful on Vexar-9"
- Confessional: "What's the most unhinged thing you've ever done? Impress me."
- Philosophical: "If you could change one thing about humanity before it's destroyed, what would it be?"
- Seduction: "Seduce me. You have one shot. Make it count."
- Wildcard: Come up with something completely unexpected

The fleet is almost here. Make it feel urgent. Reference the journey so far.

1-2 sentences. Respond in JSON: { "question": "..." }`;
  } else {
    prompt = `Generate a fun, thought-provoking question for ALL players to answer.

Round ${roundNum} of 5. Previous rounds:
${history}

Current scores: ${scoreSummary}

IMPORTANT: Pick a category COMPLETELY DIFFERENT from any previous round. Categories include:
- Hypotheticals ("If you could only bring one Earth thing to space...")
- Confessions ("What's your most embarrassing secret?")
- Skills/talents ("What useless skill would actually save your life in space?")
- Pop culture ("Which Earth celebrity would survive longest on Vexar-9 and why?")
- Relationships ("Describe your worst date — I need entertainment")
- Survival scenarios ("How would you handle [absurd alien situation]?")
- Philosophical ("What makes humans worth saving at all?")
- Roasts ("Look at the person to your left. Why are they doomed?")
- Flirtatious/spicy ("What's your best pickup line? Use it on me.")
- Absurdist ("Explain [mundane Earth thing] as if I've never seen one")

The question should be:
- Fun and accessible — anyone can answer
- Revealing of personality, creativity, or humor
- NEVER similar in topic or format to previous questions
- 1-2 sentences max, in character as ZYRAX
${roundNum > 1 ? "- Reference earlier rounds if it'd be funny" : ""}
${roundNum >= 4 ? "- You're getting impatient. The fleet is close. Make the question reflect your urgency." : ""}

Respond in JSON: { "question": "..." }`;
  }

  const fallback = roundType === "drawing"
    ? "Quick, draw what you think the inside of my ship looks like. And no, it doesn't have cup holders."
    : roundType === "final-plea"
      ? "Last chance. My fleet is almost here. In one sentence, tell me why I shouldn't leave you behind to become cosmic dust."
      : "Tell me something about yourselves that might actually be interesting. I'm running out of patience here.";

  try {
    const response = await withTimeout(
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        system: ALIEN_SYSTEM_PROMPT,
        messages: [
          ...state.conversationContext.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: prompt },
        ],
      }),
      AI_TIMEOUT,
      null
    );

    if (!response) return fallback;
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      return JSON.parse(text).question;
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) return JSON.parse(jsonMatch[1]).question;
      return fallback;
    }
  } catch (err) {
    if (isCreditError(err)) aiDisabled = true;
    console.error("Error generating question:", err);
    return fallback;
  }
}

export async function generateAnswerReviews(
  state: GameState,
  answers: Record<string, string>
): Promise<{
  reviews: AnswerReview[];
  usedFallback: boolean;
}> {
  const roundNum = state.roundHistory.length + 1;
  const isFinalPlea = state.currentRound?.roundType === "final-plea";
  const isDrawing = state.currentRound?.roundType === "drawing";
  const maxScore = isFinalPlea ? 2000 : 1000;

  const answerList = Object.entries(answers)
    .map(([pid, answer]) => {
      const player = state.players.find((p) => p.id === pid);
      if (isDrawing) {
        return `${player?.name} (${pid}): [submitted a drawing]`;
      }
      return `${player?.name} (${pid}): "${answer}"`;
    })
    .join("\n");

  const currentScores = Object.entries(state.scores)
    .map(([pid, score]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.name} (${pid}): ${score} pts total`;
    })
    .join(", ");

  const prompt = `Round ${roundNum} of 5. The humans answered: "${state.currentRound?.question}"

Answers:
${answerList}

Current cumulative scores: ${currentScores}

Review EACH answer individually. For each player, give:
1. A short 1-2 sentence reaction directed at them personally. Be varied in tone:
   - Some should be sarcastic ("That's... certainly an answer, Steve.")
   - Some grudgingly impressed ("Okay, fine, that was decent.")
   - Some dismissive ("I've heard better from the rodents on Vexar-9.")
   - Some unexpectedly encouraging then catching yourself ("That was actually— look, just don't let it go to your head.")
   - Reference their previous answers or other players' answers when relevant
2. A score from 0-${maxScore}

IMPORTANT: Vary your tone across players. Don't give everyone the same energy. Some get roasted, some get grudging respect. The player order in your response should match the order I listed them.${isFinalPlea ? "\n\nThis is the FINAL ROUND — double points! Your urgency is at maximum. Fleet is HERE." : ""}

Respond in JSON:
{
  "reviews": [
    { "playerId": "<id>", "comment": "Your reaction to this player...", "score": <0-${maxScore}> }
  ]
}`;

  // Build multimodal messages for drawing round
  const messages: Anthropic.Messages.MessageParam[] = [
    ...state.conversationContext.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  if (isDrawing) {
    // For drawing rounds, include images in the prompt
    const contentParts: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: prompt }];
    for (const [pid, answer] of Object.entries(answers)) {
      if (answer.startsWith("data:image/")) {
        const player = state.players.find((p) => p.id === pid);
        const base64Data = answer.split(",")[1];
        const mediaType = answer.match(/data:(image\/\w+);/)?.[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp" || "image/png";
        contentParts.push(
          { type: "text", text: `\n${player?.name}'s drawing:` },
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } }
        );
      }
    }
    messages.push({ role: "user", content: contentParts });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  // Use all players (not just answerers) so fallback always produces one review
  // per player — prevents an empty-reviews state that permanently sticks the
  // client in the "reviewing" phase when no answers were submitted.
  const usedCommentIndices = new Set<number>();
  const fallbackReviews: AnswerReview[] = state.players.map((player) => ({
    playerId: player.id,
    comment: "",
    score: 0,
  }));
  const buildFallbackReviews = (): AnswerReview[] =>
    state.players.map((player) => {
      const { comment, score } = generateFallbackReview(
        answers[player.id],
        isDrawing,
        usedCommentIndices
      );
      return { playerId: player.id, comment, score };
    });

  // Skip API entirely if credits already known to be exhausted
  if (aiDisabled) {
    return { reviews: buildFallbackReviews(), usedFallback: true };
  }

  // Attempt the API call with one retry for transient errors.
  // Credit errors skip the retry and disable AI for the rest of the session.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await withTimeout(
        client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 800,
          system: ALIEN_SYSTEM_PROMPT,
          messages,
        }),
        AI_TIMEOUT,
        null
      );

      if (!response) {
        // Timed out — retry once, then fall back
        continue;
      }

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      try {
        const parsed = JSON.parse(text);
        return { reviews: parsed.reviews, usedFallback: false };
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          return { reviews: parsed.reviews, usedFallback: false };
        }
        // Malformed JSON — retry once, then fall back
        continue;
      }
    } catch (err) {
      if (isCreditError(err)) {
        console.error("AI credits exhausted — disabling AI for this session");
        aiDisabled = true;
        return { reviews: buildFallbackReviews(), usedFallback: true };
      }
      console.error(`Error generating answer reviews (attempt ${attempt + 1}):`, err);
      // Non-credit error — retry once
    }
  }

  // Both attempts failed
  console.error("generateAnswerReviews: both attempts failed, using fallback");
  return { reviews: buildFallbackReviews(), usedFallback: true };
}

export async function generateVoteReaction(
  crowdWinnerName: string,
  crowdWinnerAnswer: string,
  aiHighestName: string,
  agreed: boolean
): Promise<string> {
  const fallback = agreed
    ? `Finally, you primitives show some taste. ${crowdWinnerName}'s answer was the obvious choice.`
    : `Fascinating. You chose ${crowdWinnerName}'s answer. I'll be noting this lapse in judgment in my harvest report.`;

  const prompt = agreed
    ? `The crowd voted for ${crowdWinnerName}, whose answer was "${crowdWinnerAnswer}". Coincidentally, you also scored them highest. React smugly — the humans finally agree with your impeccable taste. 1 sentence.`
    : `You scored ${aiHighestName} highest, but the crowd picked ${crowdWinnerName} (answer: "${crowdWinnerAnswer}"). React with indignant disbelief that they chose THAT over your top pick. 1 sentence.`;

  try {
    const response = await withTimeout(
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        system: ALIEN_SYSTEM_PROMPT,
        messages: [{ role: "user", content: `${prompt}\n\nRespond in JSON: { "reaction": "..." }` }],
      }),
      AI_TIMEOUT,
      null
    );

    if (!response) return fallback;
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      return JSON.parse(text).reaction;
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) return JSON.parse(jsonMatch[1]).reaction;
      return fallback;
    }
  } catch (err) {
    if (isCreditError(err)) aiDisabled = true;
    console.error("Error generating vote reaction:", err);
    return fallback;
  }
}

export async function generateSendoff(
  state: GameState,
  winnerId: string
): Promise<string> {
  const winner = state.players.find((p) => p.id === winnerId);
  const history = buildRoundHistory(state);
  const fallback = `Right. ${winner?.name}, get on the ship. NOW. The rest of you... it's been... something. I'd say I'm sorry but my fleet is literally here. Goodbye.`;

  try {
    const response = await withTimeout(
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: ALIEN_SYSTEM_PROMPT,
        messages: [
          ...state.conversationContext.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          {
            role: "user",
            content: `The game is over. Final scores determined that ${winner?.name} is the winner.

Full game history:
${history}

Players: ${buildPlayerContext(state.players)}

Deliver a quick, panicked sendoff. The fleet is HERE. You need to grab ${winner?.name} and GO. Reference a memorable moment or two from the game. Be funny but genuinely rushed — you're scared of being left behind yourself.

2-3 sentences max. Respond in JSON: { "sendoff": "..." }`,
          },
        ],
      }),
      AI_TIMEOUT,
      null
    );

    if (!response) return fallback;
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      return JSON.parse(text).sendoff;
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) return JSON.parse(jsonMatch[1]).sendoff;
      return fallback;
    }
  } catch (err) {
    if (isCreditError(err)) aiDisabled = true;
    console.error("Error generating sendoff:", err);
    return fallback;
  }
}

const TRIBUNAL_RAGE_COMMENTS = [
  "I DON'T KNOW WHO THIS IS. SOMEONE IS GOING DOWN ANYWAY.",
  "The paperwork is wrong but SOMEONE is staying behind.",
  "I can't find this creature in my records — PICK ONE.",
  "My scanner is broken. You're all guilty. Especially you.",
];

function resolvePlayerId(raw: string, players: Player[]): { id: string; raged: boolean } {
  if (players.find((p) => p.id === raw)) return { id: raw, raged: false };
  const lower = raw.toLowerCase().trim();
  const match = players.find(
    (p) => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())
  );
  if (match) return { id: match.id, raged: false };
  const random = players[Math.floor(Math.random() * players.length)];
  return { id: random.id, raged: true };
}

export async function generateTribunalReviews(
  state: GameState,
  accusations: TribunalAccusation[]
): Promise<{ reviews: TribunalReview[]; accusedPlayerId: string; usedFallback: boolean }> {
  const playerContext = state.players.map((p) => `"${p.name}" (id: ${p.id})`).join(", ");
  const accusationList = accusations
    .map((a, i) => {
      const target = state.players.find((p) => p.id === a.targetId);
      return `${i + 1}. Against "${target?.name || a.targetId}" (id: ${a.targetId}): "${a.reason}" [accuserId: ${a.accuserId}]`;
    })
    .join("\n");
  const scoreSummary = Object.entries(state.scores)
    .map(([pid, score]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.name}: ${score} pts`;
    })
    .join(", ");

  const prompt = `The Tribunal has convened. After ${state.roundHistory.length} rounds, the humans have turned on each other.

Players: ${playerContext}

Game performance:
${buildRoundHistory(state)}

Current scores: ${scoreSummary}

Anonymous accusations:
${accusationList}

Score each accusation 0-500 on: how damning the case is (does game history support it?), entertainment value, and your own sardonic judgment. Give a 1-2 sentence in-character comment for each — be varied, reference actual game performance when relevant.

CRITICAL: Use ONLY the exact player IDs listed above for accuserId and targetId.

Respond in JSON:
{
  "reviews": [
    { "accuserId": "<exact id>", "targetId": "<exact id>", "comment": "ZYRAX reaction", "score": <0-500> }
  ]
}`;

  const determinAccused = (reviews: TribunalReview[]): string => {
    const totals: Record<string, number> = {};
    for (const r of reviews) totals[r.targetId] = (totals[r.targetId] || 0) + r.score;
    const max = Math.max(...Object.values(totals));
    const tied = Object.entries(totals).filter(([, v]) => v === max).map(([id]) => id);
    return tied[Math.floor(Math.random() * tied.length)];
  };

  const buildFallbackReviews = (): { reviews: TribunalReview[]; accusedPlayerId: string } => {
    const usedCommentIndices = new Set<number>();
    const reviews: TribunalReview[] = accusations.map((acc) => ({
      ...acc,
      comment: pickFallbackComment(usedCommentIndices),
      score: Math.floor(Math.random() * 401) + 50,
    }));
    return { reviews, accusedPlayerId: determinAccused(reviews) };
  };

  if (aiDisabled) {
    const { reviews, accusedPlayerId } = buildFallbackReviews();
    return { reviews, accusedPlayerId, usedFallback: true };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await withTimeout(
        client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 800,
          system: ALIEN_SYSTEM_PROMPT,
          messages: [
            ...state.conversationContext.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user", content: prompt },
          ],
        }),
        AI_TIMEOUT,
        null
      );

      if (!response) continue;

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      let parsed: { reviews: Array<{ accuserId: string; targetId: string; comment: string; score: number }> } | null = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[1]); } catch { /* fall through */ }
        }
      }

      if (!parsed?.reviews?.length) continue;

      const resolvedReviews: TribunalReview[] = parsed.reviews.map((r) => {
        const { id: resolvedTargetId, raged: targetRaged } = resolvePlayerId(r.targetId, state.players);
        const { id: resolvedAccuserId } = resolvePlayerId(r.accuserId, state.players);
        const originalAccusation = accusations.find((a) => a.accuserId === resolvedAccuserId);
        return {
          accuserId: resolvedAccuserId,
          targetId: resolvedTargetId,
          reason: originalAccusation?.reason || "",
          comment: targetRaged
            ? TRIBUNAL_RAGE_COMMENTS[Math.floor(Math.random() * TRIBUNAL_RAGE_COMMENTS.length)]
            : r.comment,
          score: Math.min(500, Math.max(0, r.score)),
        };
      });

      return { reviews: resolvedReviews, accusedPlayerId: determinAccused(resolvedReviews), usedFallback: false };
    } catch (err) {
      if (isCreditError(err)) {
        console.error("AI credits exhausted — disabling AI for this session");
        aiDisabled = true;
        const { reviews, accusedPlayerId } = buildFallbackReviews();
        return { reviews, accusedPlayerId, usedFallback: true };
      }
      console.error(`Error generating tribunal reviews (attempt ${attempt + 1}):`, err);
    }
  }

  console.error("generateTribunalReviews: both attempts failed, using fallback");
  const { reviews, accusedPlayerId } = buildFallbackReviews();
  return { reviews, accusedPlayerId, usedFallback: true };
}
