import Anthropic from "@anthropic-ai/sdk";
import { GameState, Player, AnswerReview } from "./types";

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

const AI_TIMEOUT = 30000; // 30 seconds

const FALLBACK_REVIEW_COMMENTS: string[] = [
  "Hmm. I've seen worse. Not much worse, but worse.",
  "On Vexar-9 we'd call that answer 'technically a response.' Moving on.",
  "That was... something. I'm going to process it and get back to you never.",
  "My translation device is struggling. Whether that's a you problem or a me problem, I'm not sure.",
  "I've interrogated 47 species across the galaxy. You're in the bottom half. But still, half.",
  "Bold choice. Confusing, but bold.",
  "I didn't hate it. Don't read into that.",
  "You know what? Fine. You get points. Multiple points. I'm not telling you how many.",
  "My ship's AI rated that a 3 out of 10. I'm feeling generous today so I'm rounding up.",
  "That's actually not terrible. I'm choosing to be suspicious of that.",
  "On Vexar-9, that would get you exiled to the moon. Here? Probably just embarrassing.",
  "I've heard better answers from cleaning drones. But you're more entertaining, so.",
  "Keep this up and I might accidentally start rooting for you. Don't make it weird.",
  "My patience is running out faster than this planet's lifespan. But sure. Points.",
  "That response raised three new questions and answered zero. Impressive, in a chaotic way.",
  "I wasn't expecting that. I'm still not sure if that's good or bad. Moving on.",
  "You know what, Earth creature? You're starting to annoy me in an interesting way.",
  "The fleet is close. That answer was not worth delaying for. And yet here we are.",
  "Technically you answered the question. Technically.",
  "That's either very smart or very stupid. The line is thin and you're standing right on it.",
  "I'm going to pretend I understood that and give you some points anyway.",
  "On Vexar-9 this would be considered performance art. So — points for art.",
  "I've seen this energy before. Usually right before something explodes. I'll allow it.",
  "Half marks. No wait, more than half. Don't tell the others.",
  "Your planet is doomed but at least you're entertaining about it.",
  "That answer made my scanner malfunction. I don't know if that's your fault or a feature.",
  "I've given worse scores to better answers. You're welcome. I think.",
  "Something about that suggests you've never thought about survival before. And yet — points.",
  "You're trying. I can't say if that's working, but you're definitely trying.",
  "If this were a proper Vexar-9 tribunal, you'd be in serious trouble. Luckily, it isn't.",
  "That answer had a beginning, a middle, and an end. More structure than most of your species manages.",
  "I checked my notes and that is technically an original thought. Well done, I suppose.",
  "My ship's credibility scanner just beeped. I'm choosing to ignore it in your favor.",
  "Fine. Fine! You get points. Are you happy? I hope you're happy.",
  "I've interrogated prisoners of war with more charm. And they weren't even trying.",
  "Not the answer I expected. That's either brave or clueless. Both score the same here.",
  "The fleet is going to think I've gone soft. Worth it? Debatable.",
  "On Vexar-9 we have a word for that kind of answer. I won't translate it.",
  "I'm going to score that generously and pretend it was intentional.",
  "That was the verbal equivalent of a shrug. I respect the commitment.",
  "My co-pilot would have hated that. He's gone now. You're doing better than him. Slightly.",
  "That response defied three laws of logic and one of physics. Points for creativity.",
  "Not what I expected. Not what anyone expected. Points for the surprise.",
  "You're growing on me. Like the moss creatures of Blaarg-7. Annoying, but I miss them.",
  "That had energy. Not the right energy, but energy.",
  "I've scored based on what I think you meant, not what you said. You're welcome.",
  "The audacity of that answer is worth something. I'm not sure what, but something.",
  "That was technically an answer to a different question, but I'll count it.",
  "Every species has one member who answers like that. Every species. You're that one.",
  "I've seen worse from civilizations that still exist. Take that how you will.",
];

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
    console.error("Error generating question:", err);
    return fallback;
  }
}

export async function generateAnswerReviews(
  state: GameState,
  answers: Record<string, string>
): Promise<{
  reviews: AnswerReview[];
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
    comment: pickFallbackComment(usedCommentIndices),
    score: Math.floor(Math.random() * (maxScore * 0.4)) + Math.floor(maxScore * 0.3),
  }));

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

    if (!response) return { reviews: fallbackReviews };
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const parsed = JSON.parse(text);
      return { reviews: parsed.reviews };
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return { reviews: parsed.reviews };
      }
      return { reviews: fallbackReviews };
    }
  } catch (err) {
    console.error("Error generating answer reviews:", err);
    return { reviews: fallbackReviews };
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
    console.error("Error generating sendoff:", err);
    return fallback;
  }
}
