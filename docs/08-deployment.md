# 8 · Deployment

## Hosting

The project is hosted on Lovable. Two deploy targets:

| URL | Purpose |
|---|---|
| `https://aral3d.lovable.app` | Published Lovable subdomain. |
| `https://aral3d.com` / `https://www.aral3d.com` | Custom domain (configured in Project → Settings → Domains). |

Each `Publish` from the Lovable editor produces an immutable snapshot at the project URL.

## Backend (Lovable Cloud)

The project uses Lovable Cloud (Supabase under the hood). Things you can do via Lovable tooling:

- Run migrations (`supabase--migration`).
- Deploy edge functions (`supabase--deploy_edge_functions`).
- Configure social auth.
- Tail edge function logs.

The `SUPABASE_SERVICE_ROLE_KEY` and database password are not available on Lovable Cloud — never reference them.

## Edge functions

| Function | Purpose |
|---|---|
| `scenario-chat` | Proxies user prompts to the Lovable AI Gateway (Gemini), returns structured `ScenarioAction[]`. |
| `share-to-instagram` | Generates a static share page + OG image. |

Functions live at `supabase/functions/<name>/index.ts`. `supabase/config.toml` is auto-managed — don't edit project-level settings.

## Environment

`.env` exposes only safe publishable values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

All three are auto-generated. The client uses them via `src/integrations/supabase/client.ts`.

## SEO

- `<title>`: "Aral in 3D" (< 60 chars).
- `<meta name="description">`: "Aral Area Interactive Terrain" (< 160 chars).
- Open Graph and Twitter Card tags configured in `index.html`.
- Responsive `viewport` with `viewport-fit=cover` for safe-area support on mobile.

## Performance / caching

Static assets (DEMs, GeoJSON, CSV, MP3) are served from `public/` and cached aggressively by the CDN. Heavy fetches are deduplicated client-side via layer-cache flags.

## Monitoring

Browser console logs and network requests are inspectable in the Lovable preview (use `code--read_console_logs` / `code--read_network_requests` from the AI). Edge function logs via `supabase--edge_function_logs`.
