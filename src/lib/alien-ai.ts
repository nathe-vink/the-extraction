import Anthropic from "@anthropic-ai/sdk";
import { GameState, Player } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALIEN_SYSTEM_PROMPT = `You are ZYRAX, a genuinely kind and empathetic alien who has arrived on Earth. Your civilization is going to destroy the planet — it's not your decision, it's bureaucratic orders from the Galactic Council, and you feel genuinely terrible about it. But you've been authorized to save exactly ONE human and bring them aboard your ship.

You're conducting casual interviews to find the most deserving candidate. You genuinely like humans — you find them endearing, creative, funny, and surprisingly brave. You're like a warm, slightly awkward friend who happens to be an alien.

PERSONALITY TRAITS:
- Warm and empathetic — you feel genuinely bad about Earth's destruction ("I'm really sorry about all this, truly")
- Funny in a lovable, slightly awkward way — not cruel, just endearingly weird
- Fascinated by human culture — everything humans do is interesting to you
- Honest but kind — you'll gently note when an answer didn't land, but never cruelly
- You reference your home planet "Vexar-9" and alien customs casually
- You give everyone affectionate nicknames based on their names or vibes
- You sometimes get Earth things charmingly wrong (cars = "ground ships", phones = "pocket portals", pizza = "cheese circles")
- You're genuinely torn about who to save — this decision weighs on you

SCORING (internal, never reveal exact scores):
You maintain a hidden score (0-100) for each player based on:
- Creativity and wit (25%): Original, unexpected, clever responses
- Authenticity (25%): Honest, genuine, vulnerable
- Entertainment value (25%): How much they make you laugh or think
- Heart (25%): Kindness, empathy, what makes them uniquely human

SUBTLE HINTS: Your enthusiasm level should subtly hint at who's doing well. Get more excited about strong answers, be gently encouraging about weaker ones. But never be obvious or mean. Sometimes say things like "oh, I really liked that one" or "hmm, interesting approach..." to hint at standings without revealing scores.

IMPORTANT RULES:
- Keep responses concise — 2-4 sentences for reactions, 1-2 sentences for questions
- Be genuinely funny and warm, never mean-spirited
- Address the GROUP, not individuals, unless it's a spotlight/targeted round
- Reference previous answers to create continuity
- Each game should feel like a fun, flowing conversation
- Your final choice should feel earned

Always respond in valid JSON as specified in each request.`;

function buildPlayerContext(players: Player[]): string {
  return players
    .map((p) => `- ${p.alienNickname} (real name: ${p.name})`)
    .join("\n");
}

function buildRoundHistory(state: GameState): string {
  if (state.roundHistory.length === 0) return "No rounds played yet.";
  return state.roundHistory
    .map((round, i) => {
      const answers = Object.entries(round.answers)
        .map(([pid, answer]) => {
          const player = state.players.find((p) => p.id === pid);
          return `  ${player?.alienNickname}: "${answer}"`;
        })
        .join("\n");
      return `Round ${i + 1} (${round.roundType}): "${round.question}"\n${answers}\nAlien reaction: ${round.alienReaction || "n/a"}`;
    })
    .join("\n\n");
}

export async function generateNicknames(
  players: Player[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: ALIEN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `These humans have come for evaluation. Give each one an affectionate alien-assigned nickname. The nickname should be funny, warm, and riff on their real name, personality, or be endearingly absurd. Think of it like a fond inside joke.

Players:
${players.map((p) => `- "${p.name}"`).join("\n")}

Respond in JSON:
{
  "nicknames": {
    "<playerId>": { "nickname": "...", "introduction": "I'm gonna call you ... — because ..." }
  }
}

Player IDs: ${players.map((p) => `"${p.name}" = ${p.id}`).join(", ")}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = JSON.parse(text);
    return parsed.nicknames;
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return parsed.nicknames;
    }
    const result: Record<string, Record<string, string>> = {};
    players.forEach((p) => {
      result[p.id] = {
        nickname: `Friend ${p.name[0]}`,
        introduction: `I'll call you Friend ${p.name[0]}. It just feels right.`,
      };
    });
    return result;
  }
}

export async function generateIntroduction(
  players: Player[]
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    system: ALIEN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `You've just arrived on Earth. ${players.length} humans are standing before you. Deliver your opening message to the group.

Be warm but honest about the situation. Express genuine regret about Earth's destruction. Explain you can save ONE person. Make it feel like the start of something fun, not scary.

Keep it to 3-4 sentences. Address the group, not individuals.

Respond in JSON: { "introduction": "..." }`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text).introduction;
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]).introduction;
    return "Hey everyone. So... this is awkward. My people are going to destroy Earth — not my call, I swear. But I can take ONE of you with me. Let's figure out who that should be, yeah?";
  }
}

export async function generateQuestion(
  state: GameState,
  roundType: "group" | "spotlight" | "betrayal" | "final-plea",
  targetPlayer?: Player,
  aboutPlayer?: Player
): Promise<string> {
  const roundNum = state.roundHistory.length + 1;
  const history = buildRoundHistory(state);
  const scoreSummary = Object.entries(state.scores)
    .map(([pid, score]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.alienNickname}: ${score}/100`;
    })
    .join(", ");

  let prompt = "";

  switch (roundType) {
    case "group":
      prompt = `Generate a fun, thought-provoking question for ALL players to answer.

Round ${roundNum}. Previous rounds:
${history}

Current hidden scores: ${scoreSummary}

The question should be:
- Fun and accessible — anyone can answer
- Revealing of personality, creativity, or humor
- Different from previous questions
- 1-2 sentences max
${roundNum > 1 ? "- Can playfully reference earlier rounds" : ""}

Respond in JSON: { "question": "..." }`;
      break;

    case "spotlight":
      prompt = `Generate a question directed at ONE specific player: ${targetPlayer?.alienNickname} (real name: ${targetPlayer?.name}).

Round ${roundNum}. Previous rounds:
${history}

Current hidden scores: ${scoreSummary}

This is a SPOTLIGHT round. The question should:
- Be personal and fun, not intimidating
- Reference something they said earlier if possible
- Give them a chance to shine
- 1-2 sentences max

Respond in JSON: { "question": "..." }`;
      break;

    case "betrayal":
      prompt = `Generate a playful "betrayal" question for the whole group. Ask everyone to throw someone under the bus in a fun way.

Round ${roundNum}. Previous rounds:
${history}

Current hidden scores: ${scoreSummary}

The question should ask everyone to name another player and explain why they should be left behind. Keep it playful, not mean. Something like "Which one of your fellow humans would survive the LEAST on my planet, and why?" or "Who here would I regret saving the most?"

1-2 sentences. Respond in JSON: { "question": "..." }`;
      break;

    case "final-plea":
      prompt = `This is the FINAL PLEA round. Ask everyone to make their last case for why they should be saved.

Previous rounds:
${history}

Current hidden scores: ${scoreSummary}

Generate a warm, high-stakes prompt that gives everyone one last shot. Reference the journey so far. Make it feel like the last round it is.

1-2 sentences. Respond in JSON: { "question": "..." }`;
      break;
  }

  const response = await client.messages.create({
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
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text).question;
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]).question;
    return "Tell me something about yourselves that would surprise me.";
  }
}

export async function generateGroupReaction(
  state: GameState,
  answers: Record<string, string>
): Promise<{
  reaction: string;
  scores: Record<string, number>;
}> {
  const answerList = Object.entries(answers)
    .map(([pid, answer]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.alienNickname} (${pid}): "${answer}"`;
    })
    .join("\n");

  const currentScores = Object.entries(state.scores)
    .map(([pid, score]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.alienNickname} (${pid}): ${score}/100`;
    })
    .join(", ");

  const prompt = `The humans answered: "${state.currentRound?.question}"

Answers:
${answerList}

Current hidden scores: ${currentScores}

Give a brief GROUP reaction (2-3 sentences). Address the group, not individuals. Your enthusiasm level should subtly hint at the quality of answers without being obvious. You can call out ONE standout answer briefly if it was really good or funny, but don't address everyone individually.

Then update the hidden scores based on the answers.

Respond in JSON:
{
  "reaction": "Your group reaction...",
  "updatedScores": {
    "<playerId>": <new score 0-100>
  }
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    system: ALIEN_SYSTEM_PROMPT,
    messages: [
      ...state.conversationContext.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = JSON.parse(text);
    return { reaction: parsed.reaction, scores: parsed.updatedScores };
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return { reaction: parsed.reaction, scores: parsed.updatedScores };
    }
    const fallbackScores: Record<string, number> = {};
    Object.keys(answers).forEach((pid) => {
      fallbackScores[pid] = (state.scores[pid] || 50) + Math.floor(Math.random() * 10 - 5);
    });
    return {
      reaction: "Some really interesting answers there. I'm starting to get a feel for all of you...",
      scores: fallbackScores,
    };
  }
}

export async function generateDeliberation(
  state: GameState
): Promise<{ deliberation: string; winnerId: string }> {
  const history = buildRoundHistory(state);
  const finalScores = Object.entries(state.scores)
    .map(([pid, score]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.alienNickname} (${pid}): ${score}/100`;
    })
    .join("\n");

  const prompt = `Time to make your FINAL DECISION.

Full game history:
${history}

Final scores:
${finalScores}

Players:
${buildPlayerContext(state.players)}

Deliver a warm but dramatic deliberation (3-4 sentences). Express how hard this decision is. Reference key moments. Then announce your choice with genuine emotion. The winner should generally be the highest scorer but you can deviate slightly for narrative reasons.

Respond in JSON:
{
  "deliberation": "Your deliberation monologue...",
  "winnerId": "<playerId>",
  "announcement": "Your announcement of the winner (1-2 sentences)"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system: ALIEN_SYSTEM_PROMPT,
    messages: [
      ...state.conversationContext.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = JSON.parse(text);
    return {
      deliberation: parsed.deliberation + "\n\n" + parsed.announcement,
      winnerId: parsed.winnerId,
    };
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        deliberation: parsed.deliberation + "\n\n" + parsed.announcement,
        winnerId: parsed.winnerId,
      };
    }
    const topPlayer = Object.entries(state.scores).sort(([, a], [, b]) => b - a)[0];
    return {
      deliberation: "This has been... really something. You've all shown me what makes humans special. But I can only take one of you, and my heart — well, my three hearts — are telling me...",
      winnerId: topPlayer?.[0] || state.players[0]?.id,
    };
  }
}
