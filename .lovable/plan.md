## 1. Prev / Next buttons on Kegeyli (L6) and Minebox (Voxel)

**Kegeyli — `SchoolTwelveOverlay.tsx`**
- Add `onNext?` prop alongside existing `onPrev`.
- Render a matching "next ·  RB" button next to the existing "← prev · LB" pill in the top-left HUD strip.
- In `Index.tsx`, wire `onNext={() => enterGameLevel(1)}` (cycles back to L1, since L6 is the last; show button always so behavior matches "buttons to go to next and previous").

**Minebox (`/voxel` page)**
- Voxel lives outside the level flow, so navigation goes back into `Index.tsx`:
  - `prev` → navigate to `/?level=6` (Kegeyli).
  - `next` → navigate to `/?level=1` (Choose your character).
- Add two pill buttons next to the existing "Exit Survive" link in `Voxel.tsx`.
- `Index.tsx` reads `?level=N` on mount and calls `enterGameLevel(N)` so the deep-link works.

## 2. Persist game state across reloads

Add a tiny `src/lib/game-persistence.ts` helper that wraps `localStorage` with versioned JSON keys.

Persist:
- **L2 Great Water Level** — `waterLevel` + `waterLevelManual`.
- **L3 FLOW** — `flowSpeed`, `flowWaterAmount`, `simCompleted`.
- **L4 GeoGuessr** — current `idx`, `history`, `timeLeft` (so a refresh resumes the run).
- **L5 Map Builder** — full `placedItems` array (already in state; just save/restore on mount).
- **L6 Kegeyli** — `schoolArrived`, `schoolDialogOpen` so returning users skip the walk.
- **Voxel** — inventory + stats already use hooks; extend `useVoxelInventory` and `useVoxelStats` to read/write localStorage (they already hold the only mutable state; missions stay derived).

A single `clearGameState()` is exposed for future "reset" UI but not wired into the UI in this pass.

## 3. GeoGuessr leaderboard (Lovable Cloud)

**Schema (migration)**
```sql
CREATE TABLE public.geoguessr_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL DEFAULT 'anon',
  score integer NOT NULL,
  rounds integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.geoguessr_scores TO anon, authenticated;
GRANT ALL ON public.geoguessr_scores TO service_role;
ALTER TABLE public.geoguessr_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read scores" ON public.geoguessr_scores FOR SELECT USING (true);
CREATE POLICY "anyone can post a score"  ON public.geoguessr_scores FOR INSERT WITH CHECK (true);
```
(Anon read/insert is intentional — there's no auth and the game is a public toy.)

**Client**
- On finishing the run (`done` becomes true), POST the totalScore + rounds to `geoguessr_scores`. Player name is auto-generated like `player-7a3b` and stored in `localStorage` so the same browser keeps its name.
- Fetch top 20 scores with Tanstack Query and render a horizontal bar chart (Recharts) in the existing right-side "final score" panel: each bar = a run, the current player's bar highlighted in `accent`, others in `inkColor` with 30% opacity. Rank label on the left, score on the right.
- Show the player's rank ("you are #4 of 87") above the chart.

## Files touched

- new: `src/lib/game-persistence.ts`
- new: `supabase/migrations/<ts>_geoguessr_scores.sql`
- edited: `src/pages/Index.tsx` — query-param level deep-link, wire `onNext` on L6, persistence hooks for L2/L3/L5/L6.
- edited: `src/pages/Voxel.tsx` — prev/next pill buttons.
- edited: `src/components/SchoolTwelveOverlay.tsx` — `onNext` prop + next button.
- edited: `src/components/GeoGuessrHUD.tsx` — score submit + leaderboard chart.
- edited: `src/hooks/useVoxelInventory.ts`, `src/hooks/useVoxelStats.ts` — persistence.

## Out of scope

- No auth — leaderboard is anonymous on purpose.
- No "clear save" UI; the helper exists but isn't surfaced.
- Map Builder already had prev/next buttons, so we don't touch its UI.
