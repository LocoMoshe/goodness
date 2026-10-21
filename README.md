# Goodness (goodness-token)

Exported from Lovable on 21 Oct 2026. Standard React + Vite + TypeScript + Tailwind + shadcn/ui app with a Supabase backend.

## Run it on your Mac

You need Node.js (https://nodejs.org, LTS version). Then, in Terminal:

```sh
cd ~/Documents/BUSINESS/"Goodness App"/goodness-token
npm install
npm run dev
```

Open http://localhost:8080

## Backend

The app talks to Supabase project **Goodness App** (`qizqfvfobcdrxekciqtd`, created 21 Oct 2026) — see `src/integrations/supabase/client.ts`.
The full database setup is in `supabase/migrations/20261021000000_initial_schema.sql`.
The original project (`bddrrwquxuzavlamdoiu`) was paused for over a year and can't be restored; its backup was downloaded on 21 Oct 2026.

Free Supabase projects pause after ~1 week without traffic. If the app stops connecting, open supabase.com and press Restore.

## Notes on the export

- Only the shadcn/ui components the app actually uses were copied into `src/components/ui`. Add others any time with `npx shadcn@latest add <name>`.
- `public/placeholder.svg` is a simple stand-in (the original was a binary file Lovable doesn't export through its API). `favicon.ico` was not exported.
