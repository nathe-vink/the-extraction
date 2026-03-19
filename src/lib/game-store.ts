import { Redis } from "@upstash/redis";
import { GameState } from "./types";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const GAME_TTL = 3600; // 1 hour expiry for game data

function gameKey(roomCode: string): string {
  return `game:${roomCode.toUpperCase()}`;
}

export async function getGame(roomCode: string): Promise<GameState | null> {
  const data = await redis.get<GameState>(gameKey(roomCode));
  return data;
}

export async function setGame(roomCode: string, state: GameState): Promise<void> {
  await redis.set(gameKey(roomCode), state, { ex: GAME_TTL });
}

export async function deleteGame(roomCode: string): Promise<void> {
  await redis.del(gameKey(roomCode));
}
