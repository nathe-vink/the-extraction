export interface Player {
  id: string;
  name: string;
  alienNickname: string;
  avatar: AvatarType;
  isHost: boolean;
  connected: boolean;
}

export type AvatarType =
  | "hillbilly"
  | "mib-agent"
  | "sexy-lady"
  | "mad-scientist"
  | "cowboy"
  | "grandma"
  | "conspiracy-nut"
  | "florida-man";

export const AVATAR_CONFIG: Record<
  AvatarType,
  { emoji: string; label: string; color: string }
> = {
  hillbilly: { emoji: "\uD83E\uDDD4", label: "Hillbilly", color: "#8B4513" },
  "mib-agent": {
    emoji: "\uD83D\uDD74\uFE0F",
    label: "MIB Agent",
    color: "#1a1a2e",
  },
  "sexy-lady": {
    emoji: "\uD83D\uDC83",
    label: "Femme Fatale",
    color: "#ff1493",
  },
  "mad-scientist": {
    emoji: "\uD83E\uDDD1\u200D\uD83D\uDD2C",
    label: "Mad Scientist",
    color: "#00ff88",
  },
  cowboy: { emoji: "\uD83E\uDD20", label: "Space Cowboy", color: "#daa520" },
  grandma: {
    emoji: "\uD83D\uDC75",
    label: "Granny",
    color: "#dda0dd",
  },
  "conspiracy-nut": {
    emoji: "\uD83D\uDD75\uFE0F",
    label: "Conspiracy Nut",
    color: "#ff4444",
  },
  "florida-man": {
    emoji: "\uD83D\uDC0A",
    label: "Florida Man",
    color: "#ff8c00",
  },
};

export type GamePhase =
  | "lobby"
  | "arrival"
  | "intro"
  | "group-question"
  | "answer-reveal"
  | "alien-react"
  | "hot-seat"
  | "hot-seat-answer"
  | "espionage"
  | "espionage-answer"
  | "final-plea"
  | "final-plea-answer"
  | "deliberation"
  | "result"
  | "departure";

export interface GameMessage {
  id: string;
  sender: "alien" | "system" | string; // string = playerId
  text: string;
  timestamp: number;
  targetPlayer?: string;
}

export interface RoundState {
  roundNumber: number;
  roundType: "group" | "hot-seat" | "espionage" | "final-plea";
  question: string;
  targetPlayerId?: string; // for hot-seat and espionage
  aboutPlayerId?: string; // for espionage (who they're talking about)
  answers: Record<string, string>; // playerId -> answer
  revealed: boolean;
  alienReactions: Record<string, string>; // playerId -> alien reaction
}

export interface GameState {
  roomCode: string;
  players: Player[];
  phase: GamePhase;
  currentRound: RoundState | null;
  roundHistory: RoundState[];
  messages: GameMessage[];
  scores: Record<string, number>; // hidden scores
  conversationContext: Array<{ role: string; content: string }>;
  winnerId: string | null;
  gameStartedAt: number | null;
  currentHotSeatIndex: number;
  currentEspionageIndex: number;
  currentFinalPleaIndex: number;
}

// Pusher event types
export interface PusherGameEvent {
  type: string;
  gameState: GameState;
  timestamp: number;
}

// API request/response
export type GameAction =
  | { action: "create"; playerName: string }
  | { action: "join"; roomCode: string; playerName: string }
  | { action: "start"; roomCode: string; playerId: string }
  | {
      action: "submit-answer";
      roomCode: string;
      playerId: string;
      answer: string;
    }
  | {
      action: "advance";
      roomCode: string;
      playerId: string;
      gameState: GameState;
    }
  | {
      action: "get-state";
      roomCode: string;
    };

export interface GameResponse {
  success: boolean;
  gameState?: GameState;
  playerId?: string;
  error?: string;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generatePlayerId(): string {
  return "p_" + Math.random().toString(36).substring(2, 10);
}

export function getAvailableAvatar(players: Player[]): AvatarType {
  const allAvatars: AvatarType[] = [
    "hillbilly",
    "mib-agent",
    "sexy-lady",
    "mad-scientist",
    "cowboy",
    "grandma",
    "conspiracy-nut",
    "florida-man",
  ];
  const usedAvatars = players.map((p) => p.avatar);
  const available = allAvatars.filter((a) => !usedAvatars.includes(a));
  return available[Math.floor(Math.random() * available.length)] || allAvatars[0];
}

export function createInitialGameState(roomCode: string): GameState {
  return {
    roomCode,
    players: [],
    phase: "lobby",
    currentRound: null,
    roundHistory: [],
    messages: [],
    scores: {},
    conversationContext: [],
    winnerId: null,
    gameStartedAt: null,
    currentHotSeatIndex: 0,
    currentEspionageIndex: 0,
    currentFinalPleaIndex: 0,
  };
}
