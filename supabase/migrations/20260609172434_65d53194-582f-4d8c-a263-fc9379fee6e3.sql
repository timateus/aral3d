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
CREATE POLICY "anyone can post a score" ON public.geoguessr_scores FOR INSERT WITH CHECK (true);
CREATE INDEX geoguessr_scores_score_idx ON public.geoguessr_scores (score DESC);