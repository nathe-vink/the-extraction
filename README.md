# The Extraction

A multiplayer party game where an alien overlord (ZYRAX from Vexar-9) interrogates players across 5 rounds of increasingly unhinged questions. The highest scorer wins a seat on the escape ship before Earth's destruction.

## Stack

- Next.js 15 (App Router)
- Claude API (question generation + reviews)
- Redis (game state)
- Real-time via pipe.pen15.ai sockets with polling fallback

## Running Locally

```bash
npm install
npm run dev
```

See [ROADMAP.md](./ROADMAP.md) for planned features.
