import { useMemo, useState, useEffect } from 'react';
import { TerrainData } from '@/lib/geotiff-loader';
import { calcVolumeFromWaterLevel, calcVolumeFromExtent } from '@/lib/water-volume';

interface GeoJSONData {
  features: { geometry: { type: string; coordinates: any } }[];
}

interface YearFile {
  year: number;
  file: string;
}

const YEAR_FILES: YearFile[] = [
  { year: 1974, file: '/data/Area_1974_AG.geojson' },
  { year: 1989, file: '/data/Area_1989_AG.geojson' },
  { year: 1999, file: '/data/Area_1999_AG.geojson' },
  { year: 2004, file: '/data/Area_2004_AG.geojson' },
  { year: 2009, file: '/data/Area_2009_AG.geojson' },
  { year: 2015, file: '/data/Area_2015_AG.geojson' },
];

interface WaterVolumeDisplayProps {
  terrain: TerrainData;
  waterLevel: number;
  waterExtentYear: number;
  showWaterExtent: boolean;
}

const WaterVolumeDisplay = ({ terrain, waterLevel, waterExtentYear, showWaterExtent }: WaterVolumeDisplayProps) => {
  const [datasets, setDatasets] = useState<Map<number, GeoJSONData>>(new Map());

  useEffect(() => {
    for (const yf of YEAR_FILES) {
      fetch(yf.file)
        .then((r) => r.json())
        .then((data) => setDatasets((prev) => new Map(prev).set(yf.year, data)))
        .catch(() => {});
    }
  }, []);

  // Find nearest year with data
  const nearestYear = useMemo(() => {
    const years = YEAR_FILES.map((d) => d.year);
    let best = years[0];
    let bestDist = Math.abs(waterExtentYear - best);
    for (const y of years) {
      const d = Math.abs(waterExtentYear - y);
      if (d < bestDist) { best = y; bestDist = d; }
    }
    return best;
  }, [waterExtentYear]);

  const volumeSlider = useMemo(() => {
    return calcVolumeFromWaterLevel(terrain, waterLevel);
  }, [terrain, waterLevel]);

  const volumeExtent = useMemo(() => {
    if (!showWaterExtent) return null;
    const data = datasets.get(nearestYear);
    if (!data) return null;
    return calcVolumeFromExtent(terrain, waterLevel, data);
  }, [terrain, waterLevel, nearestYear, datasets, showWaterExtent]);

  return (
    <div className="glass-panel p-3 space-y-2 w-72">
      <h3 className="text-xs font-semibold text-foreground tracking-wide uppercase">
        Water Volume
      </h3>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            By water level ({waterLevel}m)
          </span>
          <span className="text-xs text-foreground font-mono font-semibold">
            {volumeSlider.toFixed(1)} km³
          </span>
        </div>
        {showWaterExtent && volumeExtent !== null && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono">
              By extent ({nearestYear})
            </span>
            <span className="text-xs text-foreground font-mono font-semibold">
              {volumeExtent.toFixed(1)} km³
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaterVolumeDisplay;
