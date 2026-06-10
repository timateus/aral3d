// Posts a PNG to Instagram via the Instagram API (with Instagram Login).
// Flow: receive base64 PNG -> upload to private 'shared-cards' bucket ->
// create signed URL -> create IG media container with image_url -> publish.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const IG_API = 'https://graph.instagram.com/v23.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');
    const igUserId = Deno.env.get('INSTAGRAM_USER_ID');
    if (!token || !igUserId) {
      return json({ error: 'Missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const imageBase64: string | undefined = body?.imageBase64;
    const caption: string = typeof body?.caption === 'string' ? body.caption : '';
    if (!imageBase64) return json({ error: 'imageBase64 required' }, 400);

    // Decode base64 PNG
    const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    // Upload to private bucket
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const objectKey = `${crypto.randomUUID()}.png`;
    const up = await admin.storage.from('shared-cards').upload(objectKey, bin, {
      contentType: 'image/png',
      upsert: false,
    });
    if (up.error) return json({ error: `upload failed: ${up.error.message}` }, 500);

    // Signed URL valid 10 min (IG fetches within seconds)
    const signed = await admin.storage.from('shared-cards').createSignedUrl(objectKey, 600);
    if (signed.error || !signed.data?.signedUrl) {
      return json({ error: `signed url failed: ${signed.error?.message}` }, 500);
    }
    const imageUrl = signed.data.signedUrl;

    // 1) Create media container
    const createUrl = new URL(`${IG_API}/${igUserId}/media`);
    createUrl.searchParams.set('image_url', imageUrl);
    if (caption) createUrl.searchParams.set('caption', caption);
    createUrl.searchParams.set('access_token', token);

    const createRes = await fetch(createUrl.toString(), { method: 'POST' });
    const createData = await createRes.json();
    if (!createRes.ok || !createData?.id) {
      console.error('[ig] create container failed', createData);
      return json({ error: 'IG create container failed', details: createData }, 502);
    }
    const containerId = createData.id;

    // 2) Publish (poll briefly in case container needs a moment)
    let publishData: any = null;
    let publishRes: Response | null = null;
    for (let i = 0; i < 5; i++) {
      const publishUrl = new URL(`${IG_API}/${igUserId}/media_publish`);
      publishUrl.searchParams.set('creation_id', containerId);
      publishUrl.searchParams.set('access_token', token);
      publishRes = await fetch(publishUrl.toString(), { method: 'POST' });
      publishData = await publishRes.json();
      if (publishRes.ok && publishData?.id) break;
      await new Promise((r) => setTimeout(r, 1200));
    }
    if (!publishRes?.ok || !publishData?.id) {
      console.error('[ig] publish failed', publishData);
      return json({ error: 'IG publish failed', details: publishData }, 502);
    }

    // Fetch permalink (best-effort)
    let permalink: string | null = null;
    try {
      const permUrl = new URL(`${IG_API}/${publishData.id}`);
      permUrl.searchParams.set('fields', 'permalink');
      permUrl.searchParams.set('access_token', token);
      const permRes = await fetch(permUrl.toString());
      const permJson = await permRes.json();
      permalink = permJson?.permalink ?? null;
    } catch { /* ignore */ }

    // Fetch username (best-effort)
    let username: string | null = null;
    try {
      const meUrl = new URL(`${IG_API}/${igUserId}`);
      meUrl.searchParams.set('fields', 'username');
      meUrl.searchParams.set('access_token', token);
      const meRes = await fetch(meUrl.toString());
      const meJson = await meRes.json();
      username = meJson?.username ?? null;
    } catch { /* ignore */ }

    return json({ ok: true, mediaId: publishData.id, permalink, username });
  } catch (e) {
    console.error('[ig] error', e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
