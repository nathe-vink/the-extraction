import Pusher from "pusher";

let pusherInstance: Pusher | null = null;

export function getPusherServer(): Pusher {
  if (!pusherInstance) {
    pusherInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return pusherInstance;
}

export async function triggerGameEvent(
  roomCode: string,
  eventName: string,
  data: Record<string, unknown>
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(`game-${roomCode}`, eventName, {
    ...data,
    timestamp: Date.now(),
  });
}
