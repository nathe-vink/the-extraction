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
  { label: string; color: string }
> = {
  hillbilly: { label: "Hillbilly", color: "#DAA520" },
  "mib-agent": { label: "MIB Agent", color: "#4a5568" },
  "sexy-lady": { label: "Femme Fatale", color: "#FF1493" },
  "mad-scientist": { label: "Mad Scientist", color: "#00FF88" },
  cowboy: { label: "Space Cowboy", color: "#8B4513" },
  grandma: { label: "Granny", color: "#DDA0DD" },
  "conspiracy-nut": { label: "Conspiracy Nut", color: "#FF4444" },
  "florida-man": { label: "Florida Man", color: "#FF8C00" },
};

export type GamePhase =
  | "lobby"
  | "arrival"
  | "questioning"
  | "processing"
  | "deliberation"
  | "result";

export interface GameMessage {
  id: string;
  sender: "alien" | "system" | string;
  text: string;
  timestamp: number;
  targetPlayer?: string;
}

export interface RoundState {
  roundNumber: number;
  roundType: "group" | "spotlight" | "betrayal" | "final-plea";
  question: string;
  targetPlayerId?: string;
  aboutPlayerId?: string;
  answers: Record<string, string>;
  alienReaction: string;
}

export interface GameState {
  roomCode: string;
  players: Player[];
  phase: GamePhase;
  currentRound: RoundState | null;
  roundHistory: RoundState[];
  messages: GameMessage[];
  scores: Record<string, number>;
  conversationContext: Array<{ role: string; content: string }>;
  winnerId: string | null;
  gameStartedAt: number | null;
  roundDeadline: number | null;
  currentSpotlightIndex: number;
}

export interface PusherGameEvent {
  type: string;
  gameState: GameState;
  timestamp: number;
}

export type GameAction =
  | { action: "create"; playerName: string }
  | { action: "join"; roomCode: string; playerName: string }
  | { action: "start"; roomCode: string; playerId: string }
  | { action: "submit-answer"; roomCode: string; playerId: string; answer: string }
  | { action: "timer-expire"; roomCode: string }
  | { action: "get-state"; roomCode: string };

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
    "hillbilly", "mib-agent", "sexy-lady", "mad-scientist",
    "cowboy", "grandma", "conspiracy-nut", "florida-man",
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
    roundDeadline: null,
    currentSpotlightIndex: 0,
  };
}
