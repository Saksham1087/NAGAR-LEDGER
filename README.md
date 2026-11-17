# NAGAR-LEDGER — Mira-Bhayandar Civic Issue & SLA Ledger

Public works issue reporting, algorithmic prioritization (Civic Priority Score 0–100), 50-meter duplicate clustering, and live SLA accountability ledger for Mira-Bhayandar Municipal Corporation (Wards 1–24).

## Features Implemented
- **30-Second Intake & 50m Geo-Deduplication (`/report`)**: Zero-login civic reporting with Mira-Bhayandar locality presets, EXIF GPS coordinate simulation, inline validation, and automatic matching of open nearby tickets for `+1 Confirm` consolidation.
- **Civic Priority Score (CPS 0–100) Engine**: Transparent scoring formula combining Base Category Urgency (`18–40`), Neighbor Cluster Bonus (`+3 pts` per confirmation, capped at `+25`), Critical Zone Multiplier (`1.25x` near schools, hospitals, railway stations, or flood nullahs), and SLA Decay Boost (`+1 pt` per 4h past inspection window).
- **Live Statutory SLA Matrix & Ticket Inspector (`/ticket/:id`)**: Real-time `tabular-nums` countdowns (12h garbage, 24h water/drainage, 72h road damage) with automatic `SLA BREACH · DMC` escalation and 6-stage immutable audit timeline.
- **Citizen Proof-of-Fix Audit**: Interactive Before/After schematic split-view scrubber (pointer + keyboard accessible) with `Verify Fix` and `Re-open` citizen voting.
- **Ward Accountability Scorecard (`/wards`)**: Comparative Prabhag-level metrics (MTTR, SLA Compliance %, Open Critical, Escalated to DMC).
- **Multilingual Switcher & Theme Persistence**: `EN / मराठी / हिंदी` toggle and light/dark archival ledger themes persisted in `localStorage`.

## Running Locally
```bash
npm install
npm run dev
```

## Testing & Verification
```bash
npx --yes tsx --test src/utils/ledgerEngine.test.ts
npm run lint
npm run build
```

## Deployment
- **Vercel / Netlify**: Configured via `vercel.json` and `public/_redirects` for clean SPA History API routing.
- **Editing Seed Data**: Update `src/data/miraBhayandarData.ts` for localities, tickets, helplines, and FAQs, or `src/data/translations.ts` for multilingual copy.
- **Design Tokens**: Semantic neutral/accent scales, typography, spacing, and motion tokens live in `src/styles/tokens.css`.
