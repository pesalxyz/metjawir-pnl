# Meteora PnL Card Generator

Production-ready Next.js web app that accepts a Meteora DLMM close-position transaction signature (or supported explorer URL), reconstructs realized PnL, and generates a shareable card permalink.

## Features

- Input normalization from raw signatures and explorer URLs:
  - Solscan
  - SolanaFM
  - Solana Explorer
  - SolBeach
  - OKLink
- End-to-end generation flow:
  - Validate tx input
  - Fetch transaction (Helius-first, fallback RPC)
  - Detect Meteora DLMM transaction pattern
  - Reconstruct normalized lifecycle events
  - Price events with historical lookup + cache
  - Compute realized PnL summary
  - Save and serve permalink at `/card/[signature]`
- Card workspace with:
  - Aurora / Midnight / Emerald themes
  - 1:1 and 16:9 ratios
  - Watermark toggle
  - Custom background upload
  - Download PNG (client fallback to OG image)
  - Copy share link
  - Regenerate
- Dynamic Open Graph image per card
- Prisma-backed caching for cards, tx payloads, prices, and asset metadata
- Development/offline mock signature flow for UI testing

## Tech Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS
- shadcn/ui-style component primitives
- Framer Motion
- Zod + React Hook Form
- Route handlers (`app/api/generate/route.ts`)
- Prisma + PostgreSQL
- Solana RPC via `@solana/web3.js`
- Server-side OG image generation with `next/og`
- `html-to-image` fallback for local PNG export

## Architecture

- `app/page.tsx`: Landing page + input workflow
- `app/api/generate/route.ts`: Validate + rate-limit + generate pipeline
- `app/card/[signature]/page.tsx`: Shareable permalink page
- `app/card/[signature]/opengraph-image.tsx`: Dynamic social image
- `lib/solana/*`: Input parsing + tx fetch abstraction
- `lib/meteora/*`: DLMM detection + lifecycle reconstruction
- `lib/pricing/*`: Historical price providers + cache
- `lib/pnl/*`: Realized PnL calculation + card formatting
- `lib/cache/*`: tx/price/asset cache + rate limit
- `lib/db/*`: Prisma client + generated-card repository
- `types/domain.ts`: Strong app-wide domain types

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Set up database and Prisma:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

4. Run dev server:

```bash
npm run dev
```

## Environment Variables

See `.env.example`:

- `DATABASE_URL=` PostgreSQL connection string
- `HELIUS_API_KEY=` Helius API key for primary RPC
- `SOLANA_RPC_URL=` fallback Solana RPC URL
- `BIRDEYE_API_KEY=` Birdeye historical price key
- `NEXT_PUBLIC_APP_URL=` public app base URL

## Tx Normalization Strategy

`lib/solana/parseSignature.ts`:

- Accepts raw base58 signatures (64-88 chars)
- Extracts signatures from supported explorer URL formats
- Returns a normalized input object with source metadata

## Position Reconstruction Strategy

`lib/meteora/reconstructPositionHistory.ts`:

- Fetches parsed tx from cache or RPC
- Detects Meteora DLMM hints via logs/instruction payloads
- Builds normalized event model:
  - `OPEN_POSITION`
  - `ADD_LIQUIDITY`
  - `REMOVE_LIQUIDITY`
  - `CLAIM_FEES`
  - `CLOSE_POSITION`
- Applies dedupe to avoid overlapping parsed/inner artifacts
- Normalizes wrapped SOL mint aliases
- Computes confidence score (`HIGH`/`MEDIUM`/`LOW`)
- Emits warnings for partial reconstruction

## Pricing Strategy

`lib/pricing/getHistoricalPrice.ts`:

1. Read nearest cached price window first
2. Birdeye historical lookup (primary)
3. Jupiter fallback (estimated)
4. DefiLlama fallback (estimated)
5. Static safe fallback for known mints (estimated)

If estimated pricing is used, cards include warning badges.

## Mocked Offline Flow

Use this sample signature to test complete UI flow without live parsing dependencies:

- `4Ki8fk5Yp1stzWkPHjUknaPJ5cW89cU4P4YQ5N5FQmqyMj5hGCV7m9mU7ECq8LwD`

Also available in seeded DB after `npm run prisma:seed`.

## Known Limitations

- Meteora parser currently uses resilient heuristics for unknown layouts; strict decoder coverage is marked with TODOs.
- Full historical signature scanning for position accounts is scaffolded conceptually and should be expanded for maximal accuracy.
- In-memory rate limiting is per instance (replace with Redis for horizontal scaling).
- Client PNG export depends on browser compatibility; OG fallback is provided.

## Future Improvements

- Implement strict Meteora DLMM instruction decoders per program version
- Add deterministic position-account history scanner with pagination and checkpointing
- Add persistent distributed rate limits and job queues
- Add richer asset metadata/logo pipelines and identicon fallback
- Add signed report exports and audit snapshots
