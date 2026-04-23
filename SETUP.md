# Ruhi — Setup Instructions

## Quick Start (on your Cursor laptop)

1. Copy this `ruhi/` folder to your other laptop
2. Open the folder in Cursor
3. Run in terminal:
   ```
   npm install
   ```
4. Create `.env.local` file in the root:
   ```
   ANTHROPIC_API_KEY=your-api-key-here
   ```
5. Start the dev server:
   ```
   npm run dev
   ```
6. Open http://localhost:3000

## What's Built

| Screen | File | Status |
|---|---|---|
| Landing page | `src/components/Landing.js` | Ready — tweak copy/style in Cursor |
| Onboarding (9 screens) | `src/components/Onboarding.js` | Ready — full flow with localStorage |
| Daily check-in | `src/components/DailyCheckin.js` | Ready — energy, cooking mood, kitchen input |
| Card view | `src/components/CardView.js` | Ready — meal/movement/energy tabs + Surprise Me |
| API route | `src/app/api/generate-cards/route.js` | Ready — needs API key to work |

## What to Do in Cursor

### Week 2 priority (April 23):
- Run it, see it work, fix any styling you don't like
- Tweak colors, fonts, landing page copy
- Test the onboarding flow end-to-end
- Stretch: start polishing the daily check-in

### Week 3 priority (April 30):
- Add your API key and test the Claude integration
- Refine the AI prompt (the most important part)
- Polish the card view
- Deploy to Vercel (`npx vercel`)

### Week 4 priority (May 7):
- Final polish, animations
- Voice input if time allows
- Prepare demo script
- Static fallback cards are already in CardView.js (demo safety net)

## File Structure
```
ruhi/
├── src/
│   ├── app/
│   │   ├── page.js          ← Main router (landing → onboarding → checkin)
│   │   ├── layout.js        ← HTML wrapper + metadata
│   │   ├── globals.css      ← Tailwind imports + base styles
│   │   └── api/
│   │       └── generate-cards/
│   │           └── route.js  ← Claude API integration (the brain)
│   ├── components/
│   │   ├── Landing.js        ← First screen
│   │   ├── Onboarding.js     ← 9-screen tap-through flow
│   │   ├── DailyCheckin.js   ← Energy + cooking mood + kitchen
│   │   └── CardView.js       ← Meal/Movement/Energy cards
│   └── lib/
│       ├── storage.js        ← localStorage read/write
│       └── phases.js         ← Cycle phase calculation + phase data
├── package.json
├── tailwind.config.js        ← Custom Ruhi color palette
├── next.config.js
├── postcss.config.js
├── .env.local.example        ← Copy to .env.local, add API key
└── .gitignore
```

## Deploy to Vercel
```
npx vercel
```
Add `ANTHROPIC_API_KEY` as an environment variable in Vercel dashboard.
