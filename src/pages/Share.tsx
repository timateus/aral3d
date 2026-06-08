import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Share2, Download, Instagram } from 'lucide-react';

const SharePage = () => {
  const { id } = useParams<{ id: string }>();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const { data } = supabase.storage.from('shared-cards').getPublicUrl(`${id}.png`);
    if (data?.publicUrl) setUrl(data.publicUrl);
    else setErr('Card not found');
  }, [id]);

  const handleShare = async () => {
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `spectral-earth-${id}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share: (d: ShareData) => Promise<void> };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'Spectral Earth', text: 'Made at Aral School 2026' });
        return;
      }
      if (nav.share) {
        await nav.share({ title: 'Spectral Earth', text: 'Made at Aral School 2026', url });
        return;
      }
      const a = document.createElement('a');
      a.href = url; a.download = `spectral-earth-${id}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `spectral-earth-${id}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#06080e] text-white flex flex-col items-center px-4 py-8">
      <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40 mb-2">aral school 2026</div>
      <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-white/90 mb-8">Spectral Earth</h1>
      {err && <div className="text-red-400 font-mono">{err}</div>}
      {url && (
        <>
          <img
            src={url}
            alt="Your spectral earth"
            className="max-w-full w-full md:max-w-2xl border border-white/20 shadow-2xl"
          />
          <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-mono text-sm uppercase tracking-[0.2em] hover:bg-white/90 transition-colors"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 border border-white/40 text-white font-mono text-sm uppercase tracking-[0.2em] hover:bg-white/10 transition-colors"
            >
              <Download className="w-4 h-4" /> Save
            </button>
          </div>
          <p className="mt-6 text-xs text-white/50 font-mono uppercase tracking-[0.2em] flex items-center gap-2">
            <Instagram className="w-3 h-3" /> tap share, then choose instagram
          </p>
        </>
      )}
      {!url && !err && <div className="text-white/40 font-mono">loading…</div>}
    </div>
  );
};

export default SharePage;
