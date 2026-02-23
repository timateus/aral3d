import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface AralAnnual {
  year: number;
  seaLevel: number;
  surfaceArea: number;
  volume: number;
  salinity: number;
  riverInflow: number;
  cottonHarvest: number;
  irrigatedArea: number;
  tempAnomaly: number;
}

interface ClimateMonthly {
  year: number;
  month: string;
  temp: number;
  rainfall: number;
  humidity: number;
  groundwater: number;
}

interface DataPanelProps {
  currentYear: number;
  onClose: () => void;
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SEA_SERIES = [
  { key: 'seaLevel', name: 'Sea Level (m)', color: 'hsl(200, 80%, 60%)', yAxis: 'left' },
  { key: 'surfaceArea', name: 'Area (km²)', color: 'hsl(280, 60%, 60%)', yAxis: 'right' },
  { key: 'volume', name: 'Volume (km³)', color: 'hsl(170, 70%, 50%)', yAxis: 'right' },
  { key: 'salinity', name: 'Salinity (g/L)', color: 'hsl(30, 80%, 55%)', yAxis: 'right' },
  { key: 'riverInflow', name: 'River Inflow (km³)', color: 'hsl(210, 80%, 55%)', yAxis: 'right' },
  { key: 'cottonHarvest', name: 'Cotton (Mt)', color: 'hsl(50, 70%, 55%)', yAxis: 'right' },
  { key: 'irrigatedArea', name: 'Irrigated (Mha)', color: 'hsl(130, 60%, 50%)', yAxis: 'right' },
  { key: 'tempAnomaly', name: 'Temp Δ (°C)', color: 'hsl(0, 70%, 60%)', yAxis: 'right' },
];

const CLIMATE_SERIES = [
  { key: 'temp', name: 'Avg Temp (°C)', color: 'hsl(0, 70%, 60%)' },
  { key: 'rainfall', name: 'Avg Rainfall (mm)', color: 'hsl(210, 80%, 60%)' },
  { key: 'humidity', name: 'Avg Humidity (%)', color: 'hsl(170, 60%, 50%)' },
  { key: 'groundwater', name: 'Avg GW (cm)', color: 'hsl(50, 70%, 55%)' },
];

const DataPanel = ({ currentYear, onClose }: DataPanelProps) => {
  const [annualData, setAnnualData] = useState<AralAnnual[]>([]);
  const [monthlyData, setMonthlyData] = useState<ClimateMonthly[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(
    new Set(['seaLevel', 'volume', 'salinity'])
  );
  const [enabledClimate, setEnabledClimate] = useState<Set<string>>(
    new Set(['temp', 'rainfall', 'humidity', 'groundwater'])
  );

  useEffect(() => {
    fetch('/data/aral_sea_annual.json').then(r => r.json()).then(setAnnualData);
    fetch('/data/karakalpakstan_monthly.json').then(r => r.json()).then(setMonthlyData);
  }, []);

  const toggleSeries = (key: string) => {
    setEnabledSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleClimate = (key: string) => {
    setEnabledClimate(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const climateAnnual = useMemo(() => {
    if (monthlyData.length === 0) return [];
    const byYear = new Map<number, ClimateMonthly[]>();
    for (const d of monthlyData) {
      if (!byYear.has(d.year)) byYear.set(d.year, []);
      byYear.get(d.year)!.push(d);
    }
    return Array.from(byYear.entries())
      .map(([year, rows]) => ({
        year,
        temp: +(rows.reduce((s, r) => s + r.temp, 0) / rows.length).toFixed(1),
        rainfall: +(rows.reduce((s, r) => s + r.rainfall, 0) / rows.length).toFixed(1),
        humidity: +(rows.reduce((s, r) => s + r.humidity, 0) / rows.length).toFixed(1),
        groundwater: +(rows.reduce((s, r) => s + r.groundwater, 0) / rows.length).toFixed(1),
      }))
      .sort((a, b) => a.year - b.year);
  }, [monthlyData]);

  return (
    <div className="glass-panel w-[480px] max-h-[520px] flex flex-col text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="font-semibold text-foreground text-sm">📊 Data Panel — {currentYear}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(e => !e)} className="p-1 hover:bg-muted/50 rounded transition-colors">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-muted/50 rounded transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <Tabs defaultValue="sea" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 bg-muted/30 h-8">
          <TabsTrigger value="sea" className="text-xs h-6 px-3">Sea History (1925–2024)</TabsTrigger>
          <TabsTrigger value="climate" className="text-xs h-6 px-3">Climate (1996–2025)</TabsTrigger>
        </TabsList>

        {/* Sea History Tab */}
        <TabsContent value="sea" className="flex-1 flex flex-col min-h-0 px-3 pb-2">
          {/* Series toggles */}
          <div className="flex flex-wrap gap-1 mt-1 mb-1">
            {SEA_SERIES.map(s => (
              <button
                key={s.key}
                onClick={() => toggleSeries(s.key)}
                className="px-1.5 py-0.5 rounded text-[9px] border transition-colors"
                style={{
                  borderColor: s.color,
                  background: enabledSeries.has(s.key) ? s.color : 'transparent',
                  color: enabledSeries.has(s.key) ? '#fff' : s.color,
                  opacity: enabledSeries.has(s.key) ? 1 : 0.5,
                }}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={annualData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} hide />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                {SEA_SERIES.filter(s => enabledSeries.has(s.key)).map(s => (
                  <Area
                    key={s.key}
                    yAxisId={s.yAxis}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    fill={s.color}
                    fillOpacity={0.1}
                    strokeWidth={1.5}
                  />
                ))}
                <ReferenceLine yAxisId="left" x={currentYear} stroke="hsl(45, 90%, 60%)" strokeDasharray="3 3" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {expanded && (
            <ScrollArea className="flex-1 max-h-[140px] mt-2">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-background/80 backdrop-blur">
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1 px-1">Year</th>
                    <th className="text-right py-1 px-1">Level</th>
                    <th className="text-right py-1 px-1">Area</th>
                    <th className="text-right py-1 px-1">Vol</th>
                    <th className="text-right py-1 px-1">Sal</th>
                    <th className="text-right py-1 px-1">Inflow</th>
                    <th className="text-right py-1 px-1">Cotton</th>
                    <th className="text-right py-1 px-1">Irrig</th>
                    <th className="text-right py-1 px-1">TΔ</th>
                  </tr>
                </thead>
                <tbody>
                  {annualData.map(d => (
                    <tr key={d.year} className={d.year === currentYear ? 'bg-accent/20' : ''}>
                      <td className="py-0.5 px-1 font-mono">{d.year}</td>
                      <td className="text-right py-0.5 px-1">{d.seaLevel}</td>
                      <td className="text-right py-0.5 px-1">{d.surfaceArea.toLocaleString()}</td>
                      <td className="text-right py-0.5 px-1">{d.volume}</td>
                      <td className="text-right py-0.5 px-1">{d.salinity}</td>
                      <td className="text-right py-0.5 px-1">{d.riverInflow}</td>
                      <td className="text-right py-0.5 px-1">{d.cottonHarvest}</td>
                      <td className="text-right py-0.5 px-1">{d.irrigatedArea}</td>
                      <td className="text-right py-0.5 px-1">{d.tempAnomaly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Climate Tab (1996–2025) */}
        <TabsContent value="climate" className="flex-1 flex flex-col min-h-0 px-3 pb-2">
          {/* Climate series toggles */}
          <div className="flex flex-wrap gap-1 mt-1 mb-1">
            {CLIMATE_SERIES.map(s => (
              <button
                key={s.key}
                onClick={() => toggleClimate(s.key)}
                className="px-1.5 py-0.5 rounded text-[9px] border transition-colors"
                style={{
                  borderColor: s.color,
                  background: enabledClimate.has(s.key) ? s.color : 'transparent',
                  color: enabledClimate.has(s.key) ? '#fff' : s.color,
                  opacity: enabledClimate.has(s.key) ? 1 : 0.5,
                }}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={climateAnnual} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                {CLIMATE_SERIES.filter(s => enabledClimate.has(s.key)).map(s => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={1.5} dot={false} />
                ))}
                <ReferenceLine x={currentYear} stroke="hsl(45, 90%, 60%)" strokeDasharray="3 3" strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {expanded && (
            <ScrollArea className="flex-1 max-h-[140px] mt-2">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-background/80 backdrop-blur">
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1 px-1">Year</th>
                    <th className="text-right py-1 px-1">Temp °C</th>
                    <th className="text-right py-1 px-1">Rain mm</th>
                    <th className="text-right py-1 px-1">Humid %</th>
                    <th className="text-right py-1 px-1">GW cm</th>
                  </tr>
                </thead>
                <tbody>
                  {climateAnnual.map(d => (
                    <tr key={d.year} className={d.year === currentYear ? 'bg-accent/20' : ''}>
                      <td className="py-0.5 px-1 font-mono">{d.year}</td>
                      <td className="text-right py-0.5 px-1">{d.temp}</td>
                      <td className="text-right py-0.5 px-1">{d.rainfall}</td>
                      <td className="text-right py-0.5 px-1">{d.humidity}</td>
                      <td className="text-right py-0.5 px-1">{d.groundwater}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataPanel;
