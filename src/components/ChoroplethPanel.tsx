import { useState, useEffect, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { SEWAGE_YEARS, REGION_SEWAGE, getSewageValue, sewageColor } from '@/lib/sewage-data';

interface GeoFeature {
  type: string;
  properties: { ADM1_EN: string; ADM1_RU: string; ADM1_UZ: string; id: number };
  geometry: { geometries?: any[]; type?: string; coordinates?: any };
}

interface ChoroplethPanelProps {
  year: number;
  onClose: () => void;
}

/** Simple Mercator projection for Uzbekistan bounds */
const UZB_BOUNDS = { minLon: 55.9, maxLon: 73.2, minLat: 37.1, maxLat: 45.6 };
const SVG_W = 600;
const SVG_H = 380;

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - UZB_BOUNDS.minLon) / (UZB_BOUNDS.maxLon - UZB_BOUNDS.minLon)) * SVG_W;
  const y = ((UZB_BOUNDS.maxLat - lat) / (UZB_BOUNDS.maxLat - UZB_BOUNDS.minLat)) * SVG_H;
  return [x, y];
}

function polygonToPath(coords: number[][][]): string {
  return coords.map(ring => {
    const pts = ring.map(([lon, lat]) => {
      const [x, y] = project(lon, lat);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${pts.join('L')}Z`;
  }).join(' ');
}

function getCentroid(coords: number[][][]): [number, number] {
  const ring = coords[0];
  if (!ring || ring.length === 0) return [0, 0];
  let sumLon = 0, sumLat = 0;
  for (const [lon, lat] of ring) { sumLon += lon; sumLat += lat; }
  return project(sumLon / ring.length, sumLat / ring.length);
}

function extractPolygons(geometry: any): { path: string; centroid: [number, number] }[] {
  const results: { path: string; centroid: [number, number] }[] = [];

  const processMultiPolygon = (coords: number[][][][]) => {
    for (const polygon of coords) {
      const path = polygonToPath(polygon);
      const centroid = getCentroid(polygon);
      results.push({ path, centroid });
    }
  };

  if (geometry.geometries) {
    for (const geom of geometry.geometries) {
      if (geom.type === 'MultiPolygon') processMultiPolygon(geom.coordinates);
      else if (geom.type === 'Polygon') processMultiPolygon([geom.coordinates]);
    }
  } else if (geometry.type === 'MultiPolygon') {
    processMultiPolygon(geometry.coordinates);
  } else if (geometry.type === 'Polygon') {
    processMultiPolygon([geometry.coordinates]);
  }

  return results;
}

const ChoroplethPanel = ({ year, onClose }: ChoroplethPanelProps) => {
  const [geojson, setGeojson] = useState<{ features: GeoFeature[] } | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/uzbekistan_regions.geojson')
      .then(r => r.json())
      .then(setGeojson)
      .catch(err => console.warn('Failed to load Uzbekistan GeoJSON:', err));
  }, []);

  const activeYear = useMemo(() => {
    if (year >= 2010 && year <= 2024) return year;
    return year < 2010 ? 2010 : 2024;
  }, [year]);

  const regions = useMemo(() => {
    if (!geojson) return [];
    return geojson.features.map(f => {
      const name = f.properties.ADM1_EN;
      const polys = extractPolygons(f.geometry);
      const value = getSewageValue(name, activeYear);
      const color = value !== null ? sewageColor(value) : '#555';
      // Use the largest polygon's centroid for label
      let mainCentroid: [number, number] = [0, 0];
      let maxArea = 0;
      for (const p of polys) {
        const pathLen = p.path.length; // rough proxy for polygon size
        if (pathLen > maxArea) {
          maxArea = pathLen;
          mainCentroid = p.centroid;
        }
      }
      return { name, nameRu: f.properties.ADM1_RU, polys, value, color, centroid: mainCentroid };
    });
  }, [geojson, activeYear]);

  const handleClick = useCallback((name: string) => {
    setSelectedRegion(prev => prev === name ? null : name);
  }, []);

  const infoRegion = hoveredRegion || selectedRegion;
  const infoData = infoRegion ? REGION_SEWAGE[infoRegion] : null;
  const infoValue = infoRegion ? getSewageValue(infoRegion, activeYear) : null;

  // Short labels for display on the map
  const shortLabel = (name: string) => {
    return name
      .replace(' region', '')
      .replace(' province', '')
      .replace('Republic of ', '')
      .replace(' city', '');
  };

  return (
    <div className="glass-panel p-4 w-[660px] max-h-[520px] overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Sewage Coverage by Region</h3>
          <p className="text-[10px] text-muted-foreground">
            % of homes with sewage connection, {activeYear}
          </p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full border border-border/30 rounded bg-black/20">
        {regions.map((r, i) => (
          <g key={i}>
            {r.polys.map((p, j) => (
              <path
                key={j}
                d={p.path}
                fill={r.color}
                stroke={infoRegion === r.name ? '#fff' : 'rgba(255,255,255,0.3)'}
                strokeWidth={infoRegion === r.name ? 1.5 : 0.5}
                opacity={infoRegion && infoRegion !== r.name ? 0.5 : 0.85}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => setHoveredRegion(r.name)}
                onMouseLeave={() => setHoveredRegion(null)}
                onClick={() => handleClick(r.name)}
              />
            ))}
            {/* Region label */}
            <text
              x={r.centroid[0]}
              y={r.centroid[1]}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none"
              style={{
                fontSize: r.name === 'Tashkent city' ? '6px' : '8px',
                fill: '#fff',
                fontWeight: 600,
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              }}
            >
              {r.value !== null ? `${r.value.toFixed(0)}%` : '—'}
            </text>
          </g>
        ))}
      </svg>

      {/* Info tooltip */}
      {infoData && infoValue !== null && (
        <div className="mt-2 p-2 rounded bg-black/40 border border-border/30">
          <div className="text-xs font-semibold text-foreground">{infoData.nameEn}</div>
          <div className="text-[10px] text-muted-foreground">{infoData.nameRu}</div>
          <div className="text-sm font-bold mt-1" style={{ color: sewageColor(infoValue) }}>
            {infoValue.toFixed(1)}%
          </div>
          <div className="text-[9px] text-muted-foreground mt-1">
            sewage coverage in {activeYear}
          </div>
        </div>
      )}

      {/* Color legend */}
      <div className="flex items-center gap-2 mt-2">
        <div
          className="h-2 flex-1 rounded-sm"
          style={{ background: 'linear-gradient(to right, rgb(220,60,50), rgb(220,220,50), rgb(40,200,50))' }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
};

export default ChoroplethPanel;
