// src/lib/socket-client.ts
import { io, Socket } from 'socket.io-client'

let socketInstance: Socket | null = null

/**
 * Returns the active socket, creating one if none exists or the previous one
 * disconnected. The token must be a valid connect JWT from POST /auth.
 *
 * Call this once per game session. Subsequent calls with the same token return
 * the cached instance. Call disconnectSocketClient() on session end to reset.
 */
export function getSocketClient(token: string): Socket {
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketInstance.on('connect', () => {
      console.log('[socket] connected:', socketInstance?.id)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason)
    })

    socketInstance.on('connect_error', (err) => {
      console.error('[socket] connect_error:', err.message)
    })

    socketInstance.on('session.ready', (data: { socketId: string; userId: string }) => {
      console.log('[socket] session ready:', data)
    })
  }
  return socketInstance
}

/**
 * Disconnects and clears the cached socket instance.
 * Call this in useEffect cleanup or on game session end.
 */
export function disconnectSocketClient(): void {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}

/**
 * Joins a socket room. Room name must match ^[a-z0-9:_-]{3,128}$.
 * Callback receives (error, data) where data = { room, members: string[] }.
 */
export function joinRoom(
  socket: Socket,
  room: string,
  callback: (err: unknown, data?: { room: string; members: string[] }) => void
): void {
  socket.emit('room.join', { room }, callback)
}

/**
 * Leaves a socket room. Room name must match ^[a-z0-9:_-]{3,128}$.
 */
export function leaveRoom(
  socket: Socket,
  room: string,
  callback?: (err: unknown) => void
): void {
  socket.emit('room.leave', { room }, callback)
}
