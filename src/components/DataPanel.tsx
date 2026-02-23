import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
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

const DataPanel = ({ currentYear, onClose }: DataPanelProps) => {
  const [annualData, setAnnualData] = useState<AralAnnual[]>([]);
  const [monthlyData, setMonthlyData] = useState<ClimateMonthly[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/data/aral_sea_annual.json').then(r => r.json()).then(setAnnualData);
    fetch('/data/karakalpakstan_monthly.json').then(r => r.json()).then(setMonthlyData);
  }, []);

  const climateYear = useMemo(() => {
    if (monthlyData.length === 0) return [];
    const years = [...new Set(monthlyData.map(d => d.year))];
    const closest = years.reduce((prev, curr) =>
      Math.abs(curr - currentYear) < Math.abs(prev - currentYear) ? curr : prev
    );
    return monthlyData.filter(d => d.year === closest).map((d, i) => ({
      ...d,
      monthShort: MONTHS_SHORT[i] || d.month.slice(0, 3),
    }));
  }, [monthlyData, currentYear]);

  const climateDisplayYear = climateYear[0]?.year ?? currentYear;

  return (
    <div className="glass-panel w-[420px] max-h-[500px] flex flex-col text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="font-semibold text-foreground text-sm">📊 Data Panel</span>
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
          <TabsTrigger value="sea" className="text-xs h-6 px-3">Sea History</TabsTrigger>
          <TabsTrigger value="climate" className="text-xs h-6 px-3">Climate ({climateDisplayYear})</TabsTrigger>
        </TabsList>

        {/* Sea History Tab */}
        <TabsContent value="sea" className="flex-1 flex flex-col min-h-0 px-3 pb-2">
          <div className="h-[180px] mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={annualData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis yAxisId="level" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} hide />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area yAxisId="level" type="monotone" dataKey="seaLevel" name="Sea Level (m)" stroke="hsl(200, 80%, 60%)" fill="hsl(200, 80%, 60%)" fillOpacity={0.15} strokeWidth={1.5} />
                <Area yAxisId="volume" type="monotone" dataKey="volume" name="Volume (km³)" stroke="hsl(170, 70%, 50%)" fill="hsl(170, 70%, 50%)" fillOpacity={0.1} strokeWidth={1.5} />
                <ReferenceLine yAxisId="level" x={currentYear} stroke="hsl(45, 90%, 60%)" strokeDasharray="3 3" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {expanded && (
            <ScrollArea className="flex-1 max-h-[140px] mt-2">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-background/80 backdrop-blur">
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1 px-1">Year</th>
                    <th className="text-right py-1 px-1">Level (m)</th>
                    <th className="text-right py-1 px-1">Area (km²)</th>
                    <th className="text-right py-1 px-1">Vol (km³)</th>
                    <th className="text-right py-1 px-1">Sal (g/L)</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Climate Tab */}
        <TabsContent value="climate" className="flex-1 flex flex-col min-h-0 px-3 pb-2">
          <div className="h-[180px] mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={climateYear} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="monthShort" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line type="monotone" dataKey="temp" name="Temp (°C)" stroke="hsl(0, 70%, 60%)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="rainfall" name="Rainfall (mm)" stroke="hsl(210, 80%, 60%)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke="hsl(170, 60%, 50%)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {expanded && (
            <ScrollArea className="flex-1 max-h-[140px] mt-2">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-background/80 backdrop-blur">
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1 px-1">Month</th>
                    <th className="text-right py-1 px-1">Temp °C</th>
                    <th className="text-right py-1 px-1">Rain mm</th>
                    <th className="text-right py-1 px-1">Humid %</th>
                    <th className="text-right py-1 px-1">GW cm</th>
                  </tr>
                </thead>
                <tbody>
                  {climateYear.map(d => (
                    <tr key={d.month}>
                      <td className="py-0.5 px-1">{d.monthShort}</td>
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
