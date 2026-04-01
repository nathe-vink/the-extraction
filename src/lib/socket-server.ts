// src/lib/socket-server.ts

/**
 * Publishes a game event to all sockets in the target room via pipe.pen15.ai.
 *
 * This runs server-side only (Next.js API routes, Server Actions).
 * SOCKET_PUBLISHER_TOKEN must be set as an env var — never expose it to clients.
 *
 * Room name is derived from roomCode: `game-${roomCode.toLowerCase()}`.
 * This satisfies the ^[a-z0-9:_-]{3,128}$ constraint.
 *
 * Throws if the publish call fails (non-2xx HTTP response).
 */
export async function triggerGameEvent(
  roomCode: string,
  eventName: string,
  data: Record<string, unknown>
): Promise<void> {
  const room = `game-${roomCode.toLowerCase()}`

  // Guard: validate room name before sending to avoid confusing server errors
  if (!/^[a-z0-9:_-]{3,128}$/.test(room)) {
    throw new Error(
      `[socket-server] Invalid room name "${room}". Must match ^[a-z0-9:_-]{3,128}$`
    )
  }

  const publishUrl = `${process.env.NEXT_PUBLIC_SOCKET_URL}/v1/publish`
  const publisherToken = process.env.SOCKET_PUBLISHER_TOKEN

  if (!publisherToken) {
    throw new Error('[socket-server] SOCKET_PUBLISHER_TOKEN env var is not set')
  }

  const res = await fetch(publishUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publisherToken}`,
    },
    body: JSON.stringify({
      room,
      event: eventName,
      payload: {
        ...data,
        timestamp: Date.now(),
      },
    }),
  })

  if (!res.ok) {
    let errorDetail: string
    try {
      const body = await res.json()
      errorDetail = body.error ?? JSON.stringify(body)
    } catch {
      errorDetail = String(res.status)
    }
    throw new Error(`[socket-server] publish failed: ${errorDetail}`)
  }
}
