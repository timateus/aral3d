import { useEffect, useState } from 'react';

interface Phrase {
  id: number;
  text: string;
  font: string;
  color: string;
  size: number;
  weight: string;
  italic: boolean;
  transform: 'uppercase' | 'lowercase' | 'none';
  x: number; y: number;
  rotate: number;
}

const LAYERS = [
  { name: 'Canals',           desc: 'Soviet-era irrigation channels that bled the Aral Sea dry — over 40,000 km of waterways cut through the cotton fields of the Amu Darya basin.' },
  { name: 'Demographics',     desc: 'Karakalpakstan holds ~1.9M people. Birth rates are high; out-migration from Aralkum shore towns rose sharply after the 1990s collapse.' },
  { name: 'Schools (TDS)',    desc: 'Schools color-coded by Total Dissolved Solids in drinking water. Green = safe; red = above WHO limits for salinity.' },
  { name: 'Groundwater',      desc: 'Pillar height = depth to water table. Salinity intrusion follows the receding sea — the aquifer is now mostly brackish.' },
  { name: 'Salinity',         desc: 'Soil salinity along the former seabed. Wind lifts the salt into dust storms reaching 500 km inland — into farms and lungs.' },
  { name: 'Population Density', desc: 'Hex-binned counts. Density clusters along the Amu Darya and around Nukus; the desiccated north is nearly uninhabited.' },
  { name: 'Landcover',        desc: 'GlobCover classes — cropland, bare soil, sparse vegetation. The Aralkum is the youngest desert on Earth, born 1960–2010.' },
  { name: 'Rivers & Waterways', desc: 'Stream network thickness scales with order and inflow. The Amu Darya rarely reaches the sea anymore — it ends in cotton.' },
  { name: 'Historical Basins', desc: '13th, 19th, and 21st century shorelines. The sea has retreated, advanced, and retreated again — but never this fast.' },
  { name: 'Maternal Mortality', desc: 'Per 100k live births. The Aral crisis correlates with elevated rates linked to salinity, anemia, and contaminated water.' },
  { name: 'Sewage Coverage',  desc: 'Share of households connected to sanitation. Coverage drops sharply outside Nukus and the regional centers.' },
  { name: 'Migration',        desc: 'Net arrivals vs. emigrants per district. The Aral shore has lost more than 100,000 residents since 1991.' },
];

export const FacePhraseLayer = () => {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [layer, setLayer] = useState<{ name: string; desc: string } | null>(null);

  useEffect(() => {
    let id = 0;
    const onPhrase = (e: Event) => {
      const d = (e as CustomEvent).detail as Omit<Phrase,'id'>;
      const p: Phrase = { ...d, id: ++id };
      setPhrases((arr) => [...arr, p]);
      setTimeout(() => setPhrases((arr) => arr.filter((x) => x.id !== p.id)), 2600);
    };
    const onFingerUp = (e: Event) => {
      const { active } = (e as CustomEvent).detail;
      if (active) setLayer(LAYERS[Math.floor(Math.random() * LAYERS.length)]);
      else setLayer(null);
    };
    window.addEventListener('face:phrase', onPhrase);
    window.addEventListener('face:fingerup', onFingerUp);
    return () => {
      window.removeEventListener('face:phrase', onPhrase);
      window.removeEventListener('face:fingerup', onFingerUp);
    };
  }, []);

  return (
    <>
      {phrases.map((p) => (
        <div
          key={p.id}
          className="fixed pointer-events-none z-[45] animate-fade-in"
          style={{
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
            color: p.color,
            fontFamily: p.font,
            fontSize: p.size,
            fontWeight: p.weight as any,
            fontStyle: p.italic ? 'italic' : 'normal',
            textTransform: p.transform,
            textShadow: '0 2px 14px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.9)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}
        >
          {p.text}
        </div>
      ))}

      {layer && (
        <div
          className="fixed left-1/2 top-1/2 z-[44] -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-scale-in"
          style={{ maxWidth: 'min(560px, 80vw)' }}
        >
          <div className="px-6 py-5 rounded-md bg-black/75 backdrop-blur-md border border-white/20">
            <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-white/60 mb-2">
              ☝ data layer
            </div>
            <div className="text-3xl font-bold text-white mb-3" style={{ fontFamily: '"Impact", sans-serif', letterSpacing: '0.02em' }}>
              {layer.name}
            </div>
            <div className="text-sm text-white/85 leading-relaxed" style={{ fontFamily: '"Georgia", serif' }}>
              {layer.desc}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FacePhraseLayer;
