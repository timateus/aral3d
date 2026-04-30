import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { ArrowLeft } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  DATA — distilled from the MFSA presentation                       */
/* ------------------------------------------------------------------ */

// Sea-level / area / volume — composite from the slide tables (1960–2025)
const SEA_TIMELINE = [
  { year: 1960, level: 53.4, area: 67500, volume: 1083, salinity: 10 },
  { year: 1965, level: 52.5, area: 63500, volume: 1020, salinity: 11 },
  { year: 1970, level: 51.5, area: 60500, volume: 970,  salinity: 12 },
  { year: 1975, level: 49.0, area: 55700, volume: 800,  salinity: 14 },
  { year: 1980, level: 45.5, area: 51700, volume: 670,  salinity: 18 },
  { year: 1985, level: 41.0, area: 43000, volume: 440,  salinity: 27 },
  { year: 1990, level: 38.2, area: 36500, volume: 330,  salinity: 35 },
  { year: 1995, level: 36.5, area: 32500, volume: 258,  salinity: 45 },
  { year: 2000, level: 33.5, area: 24000, volume: 175,  salinity: 57 },
  { year: 2005, level: 30.5, area: 17200, volume: 115,  salinity: 100 },
  { year: 2010, level: 27.0, area: 13900, volume: 84,   salinity: 150 },
  { year: 2015, level: 26.5, area: 8300,  volume: 62,   salinity: 200 },
  { year: 2020, level: 26.0, area: 7400,  volume: 55,   salinity: 230 },
  { year: 2025, level: 25.8, area: 6800,  volume: 50,   salinity: 270 },
];

// Water-balance periods (km³/year) — page 22
const WATER_BALANCE = [
  { period: '1911–1960', inflow: 56.0, evap: 66.1, balance: -1.0 },
  { period: '1961–1970', inflow: 43.3, evap: 65.4, balance: -14.1 },
  { period: '1971–1980', inflow: 16.7, evap: 55.2, balance: -32.2 },
  { period: '1981–1985', inflow:  2.0, evap: 45.9, balance: -36.8 },
];

// Fish species — page 32
const FISH = [
  { year: 1960, species: 20 },
  { year: 1970, species: 11 },
  { year: 1980, species:  5 },
  { year: 1990, species:  1 },
  { year: 2010, species:  0 },
];

// Health (per 100k) — page 31
const HEALTH = [
  { year: 2005, oncology: 63.7, asthma: 512.4, bronchitis: 79.9 },
  { year: 2006, oncology: 66.9, asthma: 722.6, bronchitis: 86.4 },
  { year: 2007, oncology: 67.2, asthma: 755.6, bronchitis: 113.2 },
  { year: 2008, oncology: 67.9, asthma: 807.6, bronchitis: 111.3 },
  { year: 2009, oncology: 68.8, asthma: 770.4, bronchitis: 110.1 },
];

// Key-event milestones for the scrubber
const EVENTS: Record<number, string> = {
  1960: 'Baseline. Sea covers 67,500 km², 4th-largest lake on Earth.',
  1965: 'Intensive irrigation diversions begin on Amu Darya & Syr Darya.',
  1970: 'Average drop accelerates to 21 cm / year.',
  1980: 'Drop accelerates to 58 cm / year. Big Aral loses fishery value.',
  1985: 'Sea area down to 43,000 km². Volume = 41 % of 1960.',
  1989: 'Aral splits into Northern and Southern seas (Berg Strait dries).',
  2000: 'Drought year. Salinity reaches 57 g/L. Sea collapses further.',
  2003: 'Southern Aral splits into eastern and western basins.',
  2005: 'Kokaral Dam completed — stabilises the Northern Aral.',
  2010: 'Eastern basin near-empty. 0 fish species remain.',
  2015: 'Eastern Aral effectively dries up.',
  2025: 'Three disconnected remnants. Aralkum desert > 5 M ha.',
};

const EVENT_YEARS = Object.keys(EVENTS).map(Number);

/* ------------------------------------------------------------------ */
/*  Small UI helpers                                                  */
/* ------------------------------------------------------------------ */

const Stat = ({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) => (
  <div className="border-l border-foreground/20 pl-4 py-1">
    <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/50 font-mono">{label}</div>
    <div className="font-mono text-3xl text-foreground mt-1 leading-none">
      {value}<span className="text-base text-foreground/60 ml-1">{unit}</span>
    </div>
    {sub && <div className="text-[10px] text-foreground/40 mt-1 font-mono">{sub}</div>}
  </div>
);

const SectionHeader = ({ n, title, subtitle }: { n: string; title: string; subtitle?: string }) => (
  <div className="border-b border-foreground/15 pb-3 mb-6 flex items-baseline gap-4">
    <span className="font-mono text-xs text-foreground/40">{n}</span>
    <div>
      <h2 className="text-xl font-light tracking-tight text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-foreground/50 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const tooltipStyle = {
  background: 'hsl(220 18% 12%)',
  border: '1px solid hsl(220 15% 25%)',
  borderRadius: 0,
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
};

/* ------------------------------------------------------------------ */
/*  Schematic SVG of the sea shrinking by year                        */
/* ------------------------------------------------------------------ */

const SeaSchematic = ({ year }: { year: number }) => {
  // simple shape interpolation — rectangles approximating remaining basins
  const t = (year - 1960) / (2025 - 1960);
  const k = Math.max(0, Math.min(1, t));
  // North Aral (top): stays after 2005 thanks to dam
  const northH = 30 - k * 12;
  // Western Aral
  const westH = 80 - k * 60;
  const westW = 35 - k * 22;
  // Eastern Aral — collapses
  const eastW = 60 - k * 58;
  const eastH = 70 - k * 65;
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* original 1960 outline */}
      <path
        d="M40 20 Q90 10 150 25 Q170 60 165 100 Q150 140 100 145 Q50 140 35 100 Q30 60 40 20 Z"
        fill="none"
        stroke="hsl(190 70% 50%)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
        opacity="0.5"
      />
      {/* current water */}
      <g fill="hsl(190 70% 50%)" opacity="0.85">
        {/* North */}
        <ellipse cx="80" cy="30" rx="28" ry={northH / 2} />
        {/* West */}
        <rect x={55 - westW / 2 + 50} y={50} width={westW} height={westH} rx="6" />
        {/* East */}
        <rect x={110} y={55} width={eastW} height={eastH} rx="6" />
      </g>
      {/* labels */}
      <g fontFamily="JetBrains Mono, monospace" fontSize="5" fill="hsl(210 20% 70%)">
        <text x="80" y="32" textAnchor="middle">N. ARAL</text>
        <text x={50 + 50 + westW / 2 - westW / 2} y={50 + westH / 2} textAnchor="start">W</text>
        <text x={110 + eastW / 2} y={55 + eastH / 2} textAnchor="middle" opacity={eastW > 5 ? 1 : 0}>E</text>
      </g>
      <text x="100" y="155" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill="hsl(210 20% 50%)">
        ── 1960 outline
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

const Report = () => {
  const [year, setYear] = useState(1985);

  useEffect(() => {
    document.title = 'Aral Sea — Scientific Report';
  }, []);

  const current = useMemo(() => {
    // nearest record
    return SEA_TIMELINE.reduce((best, r) =>
      Math.abs(r.year - year) < Math.abs(best.year - year) ? r : best
    );
  }, [year]);

  const nearestEventYear = useMemo(() => {
    return EVENT_YEARS.reduce((best, y) =>
      Math.abs(y - year) < Math.abs(best - year) ? y : best
    );
  }, [year]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------- Top bar ---------- */}
      <header className="border-b border-foreground/15 px-8 py-4 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-xs text-foreground/60 hover:text-foreground transition-colors font-mono">
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK TO 3D MAP
          </Link>
          <div className="h-4 w-px bg-foreground/20" />
          <div className="font-mono text-[11px] text-foreground/50 uppercase tracking-[0.2em]">
            MFSA / Aral School · April 2026
          </div>
        </div>
        <div className="font-mono text-[11px] text-foreground/40">
          Document №01 — Sea Profile
        </div>
      </header>

      {/* ---------- Title ---------- */}
      <section className="px-8 pt-16 pb-12 max-w-6xl mx-auto">
        <div className="font-mono text-[11px] text-foreground/40 mb-4 tracking-[0.2em]">
          ENVIRONMENTAL DOSSIER · ARAL BASIN
        </div>
        <h1 className="text-5xl font-light tracking-tight leading-[1.05] max-w-3xl">
          The Aral Sea, <br />
          <span className="text-foreground/50">a brief history of its disappearance.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-foreground/70">
          Once the world's fourth-largest lake, the Aral Sea has lost more than 90 % of its
          volume since 1960. This dossier consolidates the data presented by the
          Agency of the IFAS in Uzbekistan into a single, readable record.
        </p>
      </section>

      {/* ---------- §1 Headline numbers ---------- */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <SectionHeader n="01" title="At a glance" subtitle="Change between 1960 and 2025" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
          <Stat label="Surface area" value="−90" unit="%" sub="67,500 → 6,800 km²" />
          <Stat label="Water volume" value="−95" unit="%" sub="1,083 → 50 km³" />
          <Stat label="Salinity"     value="×27"          sub="10 → 270 g/L" />
          <Stat label="Fish species" value="20→0"         sub="extinct by 2010" />
          <Stat label="New desert"   value="5+" unit="M ha" sub="Aralkum, since 1960" />
          <Stat label="Dust days"    value="100" unit="/yr" sub="salt + fine particles" />
          <Stat label="Sea level"    value="−27.6" unit="m" sub="53.4 → 25.8 m a.s.l." />
          <Stat label="Remnants"     value="3"             sub="N. / W. / E. basins" />
        </div>
      </section>

      {/* ---------- §2 Interactive scrubber ---------- */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <SectionHeader n="02" title="Time scrubber" subtitle="Drag the slider to read the sea at any year between 1960 and 2025" />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10">
          {/* Left: schematic */}
          <div className="border border-foreground/15 aspect-[4/3] bg-card/40 relative">
            <SeaSchematic year={year} />
            <div className="absolute top-3 left-3 font-mono text-xs text-foreground/60 tracking-widest">
              {year}
            </div>
            <div className="absolute bottom-3 right-3 font-mono text-[10px] text-foreground/40">
              schematic — not to scale
            </div>
          </div>
          {/* Right: data + slider */}
          <div className="flex flex-col">
            <div className="space-y-5 mb-6">
              <Stat label="Sea level"    value={current.level.toFixed(1)} unit="m"   />
              <Stat label="Surface area" value={current.area.toLocaleString()} unit="km²" />
              <Stat label="Volume"       value={current.volume.toString()}    unit="km³" />
              <Stat label="Salinity"     value={current.salinity.toString()}  unit="g/L" />
            </div>
            <input
              type="range"
              min={1960}
              max={2025}
              value={year}
              onChange={(e) => setYear(+e.target.value)}
              className="w-full accent-primary"
            />
            <div className="flex justify-between font-mono text-[10px] text-foreground/40 mt-2">
              <span>1960</span><span>1985</span><span>2025</span>
            </div>
            <div className="mt-6 p-4 border border-foreground/15 bg-card/30">
              <div className="font-mono text-[10px] text-foreground/40 mb-1 uppercase tracking-widest">
                Closest milestone — {nearestEventYear}
              </div>
              <div className="text-sm leading-relaxed text-foreground/80">
                {EVENTS[nearestEventYear]}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- §3 Hydrological dynamics ---------- */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <SectionHeader n="03" title="Hydrological dynamics" subtitle="How sea level, area and volume collapsed in lockstep" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ChartCard title="Sea level (m a.s.l.)" color="hsl(190 70% 50%)" data={SEA_TIMELINE} dataKey="level" />
          <ChartCard title="Area (km²)"           color="hsl(170 60% 50%)" data={SEA_TIMELINE} dataKey="area" />
          <ChartCard title="Volume (km³)"         color="hsl(210 70% 55%)" data={SEA_TIMELINE} dataKey="volume" />
        </div>
      </section>

      {/* ---------- §4 Water balance ---------- */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <SectionHeader n="04" title="Water balance" subtitle="River inflow vs. evaporation, by period (km³ / year)" />
        <div className="border border-foreground/15 p-6 bg-card/30">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WATER_BALANCE} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(220 15% 25%)" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'hsl(210 20% 60%)', fontFamily: 'JetBrains Mono' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(210 20% 60%)', fontFamily: 'JetBrains Mono' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="inflow" name="River inflow" fill="hsl(190 70% 50%)" />
                <Bar dataKey="evap"   name="Evaporation" fill="hsl(30 70% 55%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4 text-[11px] font-mono">
            {WATER_BALANCE.map((p) => (
              <div key={p.period} className="border-l border-foreground/20 pl-3">
                <div className="text-foreground/40 text-[10px] uppercase">{p.period}</div>
                <div className={p.balance < -10 ? 'text-destructive' : 'text-foreground/80'}>
                  Δ {p.balance.toFixed(1)} km³
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- §5 Ecosystem collapse ---------- */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <SectionHeader n="05" title="Ecosystem collapse" subtitle="Fish biodiversity in the Aral Sea, 1960–2010" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-foreground/15 p-6 bg-card/30 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FISH} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(220 15% 25%)" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'hsl(210 20% 60%)', fontFamily: 'JetBrains Mono' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(210 20% 60%)', fontFamily: 'JetBrains Mono' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="species" name="Fish species">
                  {FISH.map((d, i) => (
                    <Cell key={i} fill={`hsl(${190 - i * 35} 60% 50%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-sm leading-relaxed text-foreground/75 space-y-3">
            <p>
              In 1960 the Aral hosted <span className="font-mono text-foreground">20 fish species</span> and a
              full commercial fishery centred on Muynak and Aralsk.
            </p>
            <p>
              By 1980 the Big Aral had lost all economic value as a fishery. By 2010, with
              salinity exceeding <span className="font-mono text-foreground">270 g/L</span>, no fish species
              survived in the southern remnants.
            </p>
            <p className="text-foreground/50 text-xs font-mono pt-2 border-t border-foreground/10">
              source: MFSA presentation, p. 32
            </p>
          </div>
        </div>
      </section>

      {/* ---------- §6 Public health ---------- */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <SectionHeader n="06" title="Human cost" subtitle="Disease incidence in Karakalpakstan (per 100,000 inhabitants)" />
        <div className="border border-foreground/15 p-6 bg-card/30 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={HEALTH} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="hsl(220 15% 25%)" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'hsl(210 20% 60%)', fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(210 20% 60%)', fontFamily: 'JetBrains Mono' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="asthma"     name="Asthma"      stroke="hsl(0 70% 60%)"   strokeWidth={1.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="bronchitis" name="Bronchitis"  stroke="hsl(30 80% 55%)"  strokeWidth={1.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="oncology"   name="Oncology"    stroke="hsl(280 60% 65%)" strokeWidth={1.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 max-w-3xl text-sm text-foreground/70 leading-relaxed">
          Salt and dust storms from the exposed seabed reach up to 100 days per year.
          They are linked to elevated rates of respiratory disease, kidney disorders,
          anaemia and cancers in surrounding districts.
        </p>
      </section>

      {/* ---------- §7 Response ---------- */}
      <section className="px-8 pb-24 max-w-6xl mx-auto">
        <SectionHeader n="07" title="Stabilisation efforts" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-foreground/15 p-6 bg-card/30">
            <div className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mb-2">2005</div>
            <h3 className="text-lg font-light mb-2">Kokaral Dam</h3>
            <p className="text-xs text-foreground/70 leading-relaxed">
              13 km dam across the Berg Strait. Stabilises the Northern Aral at 42.2 m a.s.l.
              and restored 332,000 ha of water surface.
            </p>
          </div>
          <div className="border border-foreground/15 p-6 bg-card/30">
            <div className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mb-2">since 2001</div>
            <h3 className="text-lg font-light mb-2">Delta lakes</h3>
            <p className="text-xs text-foreground/70 leading-relaxed">
              MFSA-Uzbekistan engineers a network of small lakes along the former Amu Darya
              delta to stabilise local ecosystems.
            </p>
          </div>
          <div className="border border-foreground/15 p-6 bg-card/30">
            <div className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mb-2">ongoing</div>
            <h3 className="text-lg font-light mb-2">Aralkum afforestation</h3>
            <p className="text-xs text-foreground/70 leading-relaxed">
              Saxaul plantations on 1.7 M+ ha of former seabed to suppress salt-and-dust
              storms.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-foreground/15 px-8 py-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between gap-3 text-[10px] font-mono text-foreground/40 tracking-[0.18em] uppercase">
          <span>Source · MFSA / Aral School Presentation, Apr 2026</span>
          <span>Compiled · Aral 3D · 2026</span>
        </div>
      </footer>
    </div>
  );
};

/* small inner chart card */
const ChartCard = ({
  title, color, data, dataKey,
}: { title: string; color: string; data: typeof SEA_TIMELINE; dataKey: keyof typeof SEA_TIMELINE[number] }) => (
  <div className="border border-foreground/15 p-4 bg-card/30">
    <div className="font-mono text-[10px] text-foreground/50 uppercase tracking-widest mb-2">{title}</div>
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="hsl(220 15% 25%)" />
          <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'hsl(210 20% 60%)', fontFamily: 'JetBrains Mono' }} />
          <YAxis tick={{ fontSize: 9, fill: 'hsl(210 20% 60%)', fontFamily: 'JetBrains Mono' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.15} />
          <ReferenceLine x={1989} stroke="hsl(45 90% 60%)" strokeDasharray="3 3" label={{ value: 'split', fill: 'hsl(45 90% 60%)', fontSize: 9 }} />
          <ReferenceLine x={2005} stroke="hsl(140 60% 50%)" strokeDasharray="3 3" label={{ value: 'dam', fill: 'hsl(140 60% 50%)', fontSize: 9 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default Report;
