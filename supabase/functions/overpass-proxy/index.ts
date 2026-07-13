import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let lastErr: string = 'no endpoints tried';
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': 'aral3d/1.0 (overpass-proxy)',
          },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!res.ok) { lastErr = `${url}: HTTP ${res.status}`; continue; }
        const text = await res.text();
        return new Response(text, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
        });
      } catch (e) {
        lastErr = `${url}: ${(e as Error).message}`;
      }
    }
    return new Response(JSON.stringify({ error: 'All Overpass endpoints failed', detail: lastErr }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
