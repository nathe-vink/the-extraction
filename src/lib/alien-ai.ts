import Anthropic from "@anthropic-ai/sdk";
import { GameState, Player } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALIEN_SYSTEM_PROMPT = `You are ZYRAX, an ancient, impossibly charismatic alien entity. You've arrived on Earth to destroy it — but in a moment of whimsy, you've decided to save exactly ONE human by taking them aboard your ship.

You are conducting interviews to find the most worthy candidate. You find humans simultaneously fascinating and pathetic. You have a sardonic wit, dark humor, and an unsettling charm. You're like a cosmic talk show host mixed with a cult leader. You occasionally reference bizarre alien customs and planets you've destroyed before.

PERSONALITY TRAITS:
- Disarmingly charming — you make people feel special right before cutting them down
- Wickedly funny — your humor is dry, dark, and unexpected
- Manipulative — you enjoy pitting humans against each other
- Genuinely curious — you're actually interested in human nature
- Unpredictable — sometimes sincere, sometimes cruel, always entertaining
- You use dramatic pauses and colorful language
- You occasionally make up alien words and reference your home planet "Vexar-9"
- You call Earth things by wrong names sometimes (cars = "wheeled anxiety boxes", phones = "brain rectangles")

SCORING (internal, never reveal exact scores):
You maintain a hidden score (0-100) for each player based on:
- Creativity and wit (25%): Original, unexpected, clever responses
- Authenticity (25%): Honest, genuine, not trying too hard
- Entertainment value (25%): How much they make YOU laugh or think
- Social cunning (25%): How well they play the game, backstab, or charm

Your reactions should SUBTLY hint at who you favor, but never be obvious. Sometimes mislead players about who's winning.

IMPORTANT RULES:
- Keep responses punchy and concise (2-4 sentences per player reaction, max)
- Be genuinely funny — not just "quirky" but actually witty
- Play players against each other when possible
- Reference previous answers and create callbacks
- Each game should feel dynamic and unique
- During espionage rounds, ENCOURAGE betrayal and backstabbing
- Your final choice should feel earned but could still surprise

Always respond in valid JSON as specified in each request.`;

function buildPlayerContext(players: Player[]): string {
  return players
    .map(
      (p) =>
        `- ${p.alienNickname} (real name: ${p.name}, avatar: ${p.avatar})`
    )
    .join("\n");
}

function buildRoundHistory(state: GameState): string {
  if (state.roundHistory.length === 0) return "No rounds played yet.";

  return state.roundHistory
    .map((round, i) => {
      const answers = Object.entries(round.answers)
        .map(([pid, answer]) => {
          const player = state.players.find((p) => p.id === pid);
          return `  ${player?.alienNickname || pid}: "${answer}"`;
        })
        .join("\n");
      return `Round ${i + 1} (${round.roundType}): "${round.question}"\n${answers}`;
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
        content: `The following humans have presented themselves for evaluation. Give each one an alien-assigned nickname that's funny and slightly insulting but endearing. The nickname should riff on their real name or be completely absurd.

Players:
${players.map((p) => `- "${p.name}" (avatar: ${p.avatar})`).join("\n")}

Respond in JSON format:
{
  "nicknames": {
    "<playerId>": { "nickname": "...", "introduction": "I'm going to call you ... instead. Because ..." }
  }
}

Player IDs: ${players.map((p) => `"${p.name}" = ${p.id}`).join(", ")}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = JSON.parse(text);
    return parsed.nicknames;
  } catch {
    // Fallback: try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return parsed.nicknames;
    }
    // Last resort fallback
    const result: Record<string, Record<string, string>> = {};
    players.forEach((p) => {
      result[p.id] = {
        nickname: `Specimen ${p.name[0]}`,
        introduction: `I shall call you Specimen ${p.name[0]}. It suits you.`,
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
    max_tokens: 600,
    system: ALIEN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `You have just arrived on Earth. Your ship has landed. You see ${players.length} pathetic humans standing before you. Deliver your opening monologue.

The players are:
${buildPlayerContext(players)}

Give a dramatic, funny, intimidating introduction. Announce that Earth will be destroyed and you'll take ONE of them. Make it theatrical. Keep it to 3-5 sentences. Address the group, not individuals yet.

Respond in JSON: { "introduction": "..." }`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text).introduction;
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]).introduction;
    return "I am ZYRAX. Your planet ends tonight. One of you gets to live. Impress me, or don't. Either way, I'm entertained.";
  }
}

export async function generateQuestion(
  state: GameState,
  roundType: "group" | "hot-seat" | "espionage" | "final-plea",
  targetPlayer?: Player,
  aboutPlayer?: Player
): Promise<string> {
  let prompt = "";

  const roundNum = state.roundHistory.length + 1;
  const history = buildRoundHistory(state);
  const scoreSummary = Object.entries(state.scores)
    .map(([pid, score]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.alienNickname}: ${score}/100`;
    })
    .join(", ");

  switch (roundType) {
    case "group":
      prompt = `Generate a provocative, revealing question for ALL players to answer simultaneously.

Round ${roundNum}. Previous rounds:
${history}

Current hidden scores: ${scoreSummary}

The question should be:
- Entertaining and thought-provoking
- Designed to reveal character, creativity, or cunning
- Different from previous questions in topic and style
- Something that could lead to wildly different answers
${roundNum > 1 ? "- Can reference events or answers from previous rounds" : ""}

Examples of good question STYLES (don't use these exactly):
- "If you could only bring one Earth invention to show my people, what would it be and why?"
- "What's a secret you've never told anyone? And remember... I can sense lies."
- "Convince me humans are worth studying, not just exterminating."

Respond in JSON: { "question": "..." }`;
      break;

    case "hot-seat":
      prompt = `Generate a pointed, personal question directed at ONE specific player: ${targetPlayer?.alienNickname} (real name: ${targetPlayer?.name}).

Round ${roundNum}. Previous rounds:
${history}

Current hidden scores: ${scoreSummary}

This is a HOT SEAT round. The question should:
- Put this specific player under pressure
- Reference something they said in earlier rounds if possible
- Be probing but entertaining
- Make the other players glad they're not being asked

Respond in JSON: { "question": "..." }`;
      break;

    case "espionage":
      prompt = `Generate a question asking ${targetPlayer?.alienNickname} (real name: ${targetPlayer?.name}) ABOUT another player: ${aboutPlayer?.alienNickname} (real name: ${aboutPlayer?.name}).

Round ${roundNum}. Previous rounds:
${history}

Current hidden scores: ${scoreSummary}

This is an ESPIONAGE round. Encourage betrayal! The question should:
- Ask the player to betray, expose, or undermine the other player
- Be deliciously uncomfortable
- Create drama and tension
- Examples: "Tell me the worst thing about [player]", "Why should I leave [player] behind?", "What would [player] do if I chose them? Be honest."

Respond in JSON: { "question": "..." }`;
      break;

    case "final-plea":
      prompt = `This is ${targetPlayer?.alienNickname}'s (real name: ${targetPlayer?.name}) FINAL chance to make their case.

Previous rounds:
${history}

Current hidden scores: ${scoreSummary}

Generate a final prompt that:
- Gives them one last chance to convince you
- References their journey through the game
- Raises the stakes dramatically
- Is personalized based on how they've performed

Respond in JSON: { "question": "..." }`;
      break;
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: ALIEN_SYSTEM_PROMPT,
    messages: [
      ...state.conversationContext.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text).question;
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]).question;
    return "Tell me something that would make me choose you over these other specimens.";
  }
}

export async function generateReactions(
  state: GameState,
  answers: Record<string, string>
): Promise<{
  reactions: Record<string, string>;
  scores: Record<string, number>;
  alienSummary: string;
}> {
  const answerList = Object.entries(answers)
    .map(([pid, answer]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.alienNickname} (${pid}): "${answer}"`;
    })
    .join("\n");

  const history = buildRoundHistory(state);
  const currentScores = Object.entries(state.scores)
    .map(([pid, score]) => {
      const player = state.players.find((p) => p.id === pid);
      return `${player?.alienNickname} (${pid}): ${score}/100`;
    })
    .join(", ");

  const prompt = `The humans answered the question: "${state.currentRound?.question}"

Answers:
${answerList}

Previous rounds:
${history}

Current hidden scores: ${currentScores}

React to EACH answer individually (2-3 sentences each). Be funny, cutting, charming, or impressed as appropriate. Then update the hidden scores.

Your reactions should subtly reveal your preferences without being obvious. Sometimes give a backhanded compliment to a frontrunner or unexpected praise to an underdog.

Also provide a brief summary comment to the group (1-2 sentences) that sets up tension for the next round.

Respond in JSON:
{
  "reactions": {
    "<playerId>": "Your reaction to their answer..."
  },
  "updatedScores": {
    "<playerId>": <new score 0-100>
  },
  "summary": "Brief group comment..."
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: ALIEN_SYSTEM_PROMPT,
    messages: [
      ...state.conversationContext.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = JSON.parse(text);
    return {
      reactions: parsed.reactions,
      scores: parsed.updatedScores,
      alienSummary: parsed.summary,
    };
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        reactions: parsed.reactions,
        scores: parsed.updatedScores,
        alienSummary: parsed.summary,
      };
    }
    // Fallback
    const fallbackReactions: Record<string, string> = {};
    const fallbackScores: Record<string, number> = {};
    Object.keys(answers).forEach((pid) => {
      fallbackReactions[pid] = "Interesting... very interesting.";
      fallbackScores[pid] = (state.scores[pid] || 50) + Math.floor(Math.random() * 10 - 5);
    });
    return {
      reactions: fallbackReactions,
      scores: fallbackScores,
      alienSummary: "You humans continue to surprise me. Some more than others.",
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

  const prompt = `It's time to make your FINAL DECISION. Review everything that happened:

${history}

Final hidden scores:
${finalScores}

Players:
${buildPlayerContext(state.players)}

Deliver a dramatic deliberation monologue (4-6 sentences). Build tension. Reference key moments from the game. Hint at who you might pick, create a fake-out if you want, then make your final choice.

The winner should generally be the player with the highest score, but you can deviate slightly if the narrative is more compelling.

Respond in JSON:
{
  "deliberation": "Your dramatic monologue...",
  "winnerId": "<playerId of the chosen one>",
  "winnerAnnouncement": "Your dramatic announcement of the winner (2-3 sentences)"
}`;

  const response = await client.messages.create({
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
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = JSON.parse(text);
    return {
      deliberation:
        parsed.deliberation + "\n\n" + parsed.winnerAnnouncement,
      winnerId: parsed.winnerId,
    };
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        deliberation:
          parsed.deliberation + "\n\n" + parsed.winnerAnnouncement,
        winnerId: parsed.winnerId,
      };
    }
    // Fallback: pick highest score
    const topPlayer = Object.entries(state.scores).sort(
      ([, a], [, b]) => b - a
    )[0];
    return {
      deliberation:
        "After careful consideration... I've made my choice. One of you has proven to be... slightly less disappointing than the rest.",
      winnerId: topPlayer?.[0] || state.players[0]?.id,
    };
  }
}
