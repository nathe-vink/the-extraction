// src/app/api/socket-token/route.ts
import { NextResponse } from 'next/server'

/**
 * POST /api/socket-token
 * Body: { username: string }
 * Response: { token: string }
 *
 * Fetches a connect token from pipe.pen15.ai/auth using the server-side
 * SOCKET_INVITE_CODE. The token is returned to the client for use in io() auth.
 *
 * SOCKET_INVITE_CODE is never exposed to the client — only this endpoint uses it.
 * NEXT_PUBLIC_SOCKET_URL is the socket service base URL (client-accessible).
 */
export async function POST(req: Request) {
  const { username } = await req.json()

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  const inviteCode = process.env.SOCKET_INVITE_CODE
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL

  if (!inviteCode) {
    console.error('[socket-token] SOCKET_INVITE_CODE env var is not set')
    return NextResponse.json({ error: 'server configuration error' }, { status: 500 })
  }

  const res = await fetch(`${socketUrl}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inviteCode,
      username: username.trim(),
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return NextResponse.json(
      { error: body.error ?? 'auth failed' },
      { status: res.status }
    )
  }

  const data = await res.json()
  return NextResponse.json(data)
}
