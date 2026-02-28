import { useMemo, useState, useEffect, useCallback } from 'react';
import { Html, Line } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface GeoFeaturesProps {
  terrain: TerrainData;
  exaggeration: number;
  showBorders: boolean;
  showRivers: boolean;
  show13thBasin: boolean;
  show19thBasin: boolean;
  show21stBasin: boolean;
  showLakes: boolean;
  riverInflow?: number;
  userLocation?: { lat: number; lon: number } | null;
}

interface City {
  name: string;
  lat: number;
  lon: number;
}

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][] | number[][][][];
  };
  properties: Record<string, unknown>;
}

interface GeoJSONCollection {
  type: string;
  features: GeoJSONFeature[];
}

interface NamedLabel {
  name: string;
  pos: [number, number, number];
  color: string;
}

const CITIES: City[] = [
  { name: 'Nukus', lat: 42.462, lon: 59.603 },
  { name: 'Moynaq', lat: 43.773, lon: 58.690 },
  { name: 'Aral', lat: 46.790, lon: 61.660 },
  { name: 'Kungrad', lat: 43.005, lon: 58.690 },
  { name: 'Chimbay', lat: 42.930, lon: 59.770 },
  { name: 'Takhtakupir', lat: 43.015, lon: 59.826 },
  { name: 'Qazaly', lat: 45.763, lon: 62.110 },
  { name: 'Urgench', lat: 41.550, lon: 60.633 },
  { name: 'Khiva', lat: 41.379, lon: 60.356 },
];

interface Lake {
  id: number;
  name: string;
  lat: number;
  lon: number;
  area_ha: number; // total area in hectares
  district: string;
  massiv: string;
  organization: string;
}

// All 31 lakes from the Moynaq district spreadsheet
// Lake #31 excluded: coordinates are in incomplete DMS format with no longitude
const LAKES: Lake[] = [
  { id: 1, name: "Moynaq qoltig'i ko'li", lat: 43.763841, lon: 58.964160, area_ha: 12338, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 2, name: 'Zakir ko\'li', lat: 43.531286, lon: 59.022702, area_ha: 330, district: 'Мойнак тумани', massiv: 'Бозатау ОФЙ Мойнак массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 3, name: "Go'nedariya ko'li", lat: 43.830093, lon: 59.590997, area_ha: 395, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 4, name: "Kishi Maqpal ko'li", lat: 43.697551, lon: 59.209823, area_ha: 203, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 5, name: "Qizil Keme ko'li", lat: 43.631329, lon: 59.203436, area_ha: 565, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 6, name: "Shege ko'l suv ombori", lat: 43.553596, lon: 59.075574, area_ha: 1660, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 7, name: 'Lake #7 (XXX)', lat: 44.021572, lon: 59.663175, area_ha: 58, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 8, name: 'Zhyltyrbas (protok levaya)', lat: 43.595506, lon: 59.855519, area_ha: 50, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 9, name: "Qaramollabas ko'li", lat: 43.521095, lon: 60.416966, area_ha: 102, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 10, name: "Taxtin Kut ko'li", lat: 43.590676, lon: 59.987829, area_ha: 125, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 11, name: "Sudochye-Aqpetkey ko'ller sistemasi", lat: 43.641446, lon: 60.379004, area_ha: 65, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 12, name: "Tog'izariq", lat: 43.916144, lon: 60.527130, area_ha: 158, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 13, name: 'Lake #13', lat: 43.309483, lon: 58.835091, area_ha: 90, district: 'Мойнак тумани', massiv: 'Дослық ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 14, name: 'Lake #14', lat: 43.660638, lon: 59.186010, area_ha: 3025, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 15, name: 'Lake #15', lat: 43.536801, lon: 59.204404, area_ha: 4458, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 16, name: 'Lake #16', lat: 43.879733, lon: 60.529911, area_ha: 150, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 17, name: 'Lake #17', lat: 43.686566, lon: 60.341457, area_ha: 237, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 18, name: 'Lake #18', lat: 43.727240, lon: 60.362598, area_ha: 30, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 19, name: 'Lake #19', lat: 43.664246, lon: 60.370959, area_ha: 51, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 20, name: 'Lake #20', lat: 43.631387, lon: 60.410786, area_ha: 47, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 21, name: 'Lake #21', lat: 43.293387, lon: 58.875336, area_ha: 400, district: 'Мойнак тумани', massiv: 'Дослық ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 22, name: 'Lake #22', lat: 43.259087, lon: 58.886452, area_ha: 900, district: 'Мойнак тумани', massiv: 'Дослық ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 23, name: 'Lake #23', lat: 43.313105, lon: 58.829010, area_ha: 220, district: 'Мойнак тумани', massiv: 'Дослық ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 24, name: 'Lake #24', lat: 43.693403, lon: 60.457166, area_ha: 150, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 25, name: 'Lake #25', lat: 43.644927, lon: 60.401481, area_ha: 103.1, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 26, name: 'Lake #26', lat: 43.650416, lon: 59.206249, area_ha: 300, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Қорақалпоқбалиқ уюшмаси' },
  { id: 27, name: 'Lake #27 (Meliorativ)', lat: 44.724393, lon: 58.353690, area_ha: 227077.5, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'Meliorativ Ekspeditsiya' },
  { id: 28, name: 'Lake #28 (Muynoq Akva Sanoat)', lat: 43.505066, lon: 59.797014, area_ha: 17248.3, district: 'Мойнак тумани', massiv: 'Казакдарья ОФЙ', organization: 'MUYNOQ AKVA SANOAT MCHJ' },
  { id: 29, name: 'Lake #29 (Muynoq Akva Sanoat)', lat: 43.557507, lon: 58.543366, area_ha: 18969.7, district: 'Мойнак тумани', massiv: 'Мадели ОФЙ Аккала массиви', organization: 'MUYNOQ AKVA SANOAT MCHJ' },
  { id: 30, name: 'Lake #30', lat: 43.743981, lon: 59.106235, area_ha: 2818.7, district: 'Мойнак тумани', massiv: 'Учсай ОФЙ', organization: 'MUYNOQ AKVA SANOAT MCHJ' },
];

// Convert area in hectares to mesh radius
// Terrain mesh is 10 units wide covering ~7° longitude (~550km at this latitude)
// 1 mesh unit ≈ 55 km
function areaHaToMeshRadius(area_ha: number): number {
  const area_km2 = area_ha / 100;
  const radius_km = Math.sqrt(area_km2 / Math.PI);
  const km_per_mesh_unit = 55;
  return Math.max(0.02, radius_km / km_per_mesh_unit);
}

function geoToMeshPos(
  lat: number,
  lon: number,
  bounds: GeoBounds,
  terrain: TerrainData,
  exaggeration: number,
  meshWidth: number,
  meshHeight: number,
): [number, number, number] | null {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const nx = (lon - minLon) / (maxLon - minLon);
  const ny = (lat - minLat) / (maxLat - minLat);

  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;

  const inBounds = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
  let zHeight = 0;

  if (inBounds) {
    const pixelX = Math.floor(nx * (terrain.width - 1));
    const pixelY = Math.floor((1 - ny) * (terrain.height - 1));
    const idx = pixelY * terrain.width + pixelX;
    let elev = terrain.elevations[idx] || terrain.minElevation;
    if (terrain.noDataValue !== null && elev === terrain.noDataValue) {
      elev = terrain.minElevation;
    }
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const normalized = (elev - terrain.minElevation) / elevRange;
    const maxMeshHeight = 10 * (exaggeration / 100);
    zHeight = normalized * maxMeshHeight;
  }

  return [x, zHeight, -planeY];
}

const GeoFeatures = ({ terrain, exaggeration, showBorders, showRivers, show13thBasin, show19thBasin, show21stBasin, showLakes, riverInflow, userLocation }: GeoFeaturesProps) => {
  const bounds = terrain.bounds;
  const w = terrain.width;
  const h = terrain.height;
  const meshWidth = 10;
  const meshHeight = 10 * (h / w);

  const [geoJsonData, setGeoJsonData] = useState<GeoJSONCollection | null>(null);
  const [countriesData, setCountriesData] = useState<GeoJSONCollection | null>(null);
  const [basin13Data, setBasin13Data] = useState<GeoJSONCollection | null>(null);
  const [basin19Data, setBasin19Data] = useState<GeoJSONCollection | null>(null);
  const [basin21Data, setBasin21Data] = useState<GeoJSONCollection | null>(null);

  useEffect(() => {
    fetch('/data/AmuRivers.geojson')
      .then((r) => r.json())
      .then((data) => setGeoJsonData(data))
      .catch((err) => console.warn('Failed to load river GeoJSON:', err));

    fetch('/data/countries.geojson')
      .then((r) => r.json())
      .then((data) => setCountriesData(data))
      .catch((err) => console.warn('Failed to load countries GeoJSON:', err));

    fetch('/data/13cent_basin.geojson')
      .then((r) => r.json())
      .then((data) => setBasin13Data(data))
      .catch((err) => console.warn('Failed to load 13th century basin GeoJSON:', err));

    fetch('/data/19cent_basin.geojson')
      .then((r) => r.json())
      .then((data) => setBasin19Data(data))
      .catch((err) => console.warn('Failed to load 19th century basin GeoJSON:', err));

    fetch('/data/21cent_basin.geojson')
      .then((r) => r.json())
      .then((data) => setBasin21Data(data))
      .catch((err) => console.warn('Failed to load 21st century basin GeoJSON:', err));
  }, []);

  const cityMarkers = useMemo(() => {
    if (!bounds) return [];
    return CITIES.map((city) => {
      const pos = geoToMeshPos(city.lat, city.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
      if (!pos) return null;
      return { ...city, pos: [pos[0], pos[1] + 0.15, pos[2]] as [number, number, number] };
    }).filter(Boolean) as (City & { pos: [number, number, number] })[];
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, w, h]);

  const basinLabels13 = useMemo(() => {
    if (!bounds || !basin13Data) return [];
    return extractNamedLabels(basin13Data, bounds, terrain, exaggeration, meshWidth, meshHeight, '#e8a838');
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin13Data]);

  const basinLabels19 = useMemo(() => {
    if (!bounds || !basin19Data) return [];
    return extractNamedLabels(basin19Data, bounds, terrain, exaggeration, meshWidth, meshHeight, '#38e8a8');
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin19Data]);


  const basinLabels21 = useMemo(() => {
    if (!bounds || !basin21Data) return [];
    return extractNamedLabels(basin21Data, bounds, terrain, exaggeration, meshWidth, meshHeight, '#e84038');
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin21Data]);

  const riverLines = useMemo(() => {
    if (!bounds || !geoJsonData) return [];

    const segments: { points: [number, number, number][]; width: number }[] = [];

    for (const feature of geoJsonData.features) {
      if (feature.geometry.type !== 'LineString') continue;
      const coords = feature.geometry.coordinates as number[][];
      const sorder = (feature.properties?.sorder as number) || 1;
      const points: [number, number, number][] = [];

      for (const coord of coords) {
        const lon = coord[0] as number;
        const lat = coord[1] as number;
        const pos = geoToMeshPos(lat, lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (pos) {
          points.push([pos[0], pos[1] + 0.03, pos[2]]);
        }
      }

      if (points.length >= 2) {
        // Scale line width by stream order and river inflow
        // Max historical inflow ~60 km³/yr (1960s), min ~5 km³/yr (2000s)
        const inflowScale = riverInflow != null
          ? Math.max(0.2, (riverInflow / 30) ** 0.7)
          : 1;
        const baseWidth = sorder * 3.6;
        const lineWidth = Math.max(0.3, baseWidth * inflowScale);
        segments.push({ points, width: lineWidth });
      }
    }

    return segments;
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, geoJsonData, riverInflow]);

  const BORDER_COUNTRIES = ['Uzbekistan'];

  const borderLines = useMemo(() => {
    if (!bounds || !countriesData) return [];

    const segments: [number, number, number][][] = [];

    for (const feature of countriesData.features) {
      const name = feature.properties?.name as string;
      if (!BORDER_COUNTRIES.includes(name)) continue;

      const geomType = feature.geometry.type;
      let rings: number[][][] = [];

      if (geomType === 'Polygon') {
        rings = feature.geometry.coordinates as number[][][];
      } else if (geomType === 'MultiPolygon') {
        const polys = feature.geometry.coordinates as number[][][][];
        for (const poly of polys) {
          rings.push(...poly);
        }
      }

      for (const ring of rings) {
        const points: [number, number, number][] = [];
        for (const coord of ring) {
          const lon = coord[0];
          const lat = coord[1];
          const pos = geoToMeshPos(lat, lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
          if (pos) {
            points.push([pos[0], pos[1] + 0.02, pos[2]]);
          }
        }
        if (points.length >= 2) {
          segments.push(points);
        }
      }
    }

    return segments;
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, countriesData]);

  const basinLines13 = useMemo(() => {
    if (!bounds || !basin13Data) return [];
    return extractMultiLineStrings(basin13Data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin13Data]);

  const basinLines19 = useMemo(() => {
    if (!bounds || !basin19Data) return [];
    return extractMultiLineStrings(basin19Data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin19Data]);

  const basinLines21 = useMemo(() => {
    if (!bounds || !basin21Data) return [];
    return extractMultiLineStrings(basin21Data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin21Data]);

  if (!bounds) return null;

  return (
    <group>
      {/* Country borders */}
      {showBorders && borderLines.map((points, i) => (
        <Line
          key={`border-${i}`}
          points={points}
          color="#ffffff"
          lineWidth={3}
          transparent
          opacity={0.4}
        />
      ))}

      {/* 13th century basin */}
      {show13thBasin && basinLines13.map((points, i) => (
        <Line
          key={`basin13-${i}`}
          points={points}
          color="#e8a838"
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}

      {/* 19th century basin */}
      {show19thBasin && basinLines19.map((points, i) => (
        <Line
          key={`basin19-${i}`}
          points={points}
          color="#38e8a8"
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}

      {/* 21st century basin */}
      {show21stBasin && basinLines21.map((points, i) => (
        <Line
          key={`basin21-${i}`}
          points={points}
          color="#e84038"
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}

      {/* City markers */}
      {cityMarkers.map((city) => (
        <group key={city.name} position={city.pos}>
          <mesh>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
          </mesh>
          <Html position={[0, 0.12, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <div style={{
              color: 'rgba(255, 255, 255, 0.9)',
              padding: '1px 4px',
              fontSize: '9px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 400,
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0px 2px rgba(0,0,0,0.6)',
            }}>
              {city.name}
            </div>
          </Html>
        </group>
      ))}

      {/* Basin hover labels - 13th century */}
      {show13thBasin && basinLabels13.map((label, i) => (
        <HoverLabel key={`label13-${i}`} label={label} />
      ))}

      {/* Basin hover labels - 19th century */}
      {show19thBasin && basinLabels19.map((label, i) => (
        <HoverLabel key={`label19-${i}`} label={label} />
      ))}

      {/* Basin hover labels - 21st century */}
      {show21stBasin && basinLabels21.map((label, i) => (
        <HoverLabel key={`label21-${i}`} label={label} />
      ))}

      {/* Rivers from GeoJSON */}
      {showRivers && riverLines.map((seg, i) => (
        <Line
          key={`river-${i}`}
          points={seg.points}
          color="#5b9bd5"
          lineWidth={seg.width}
          transparent
          opacity={0.7}
        />
      ))}

      {/* Lakes */}
      {showLakes && LAKES.map((lake) => {
        const pos = geoToMeshPos(lake.lat, lake.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (!pos) return null;
        const radius = areaHaToMeshRadius(lake.area_ha);
        return (
          <LakeMarker key={lake.id} lake={lake} pos={pos} radius={radius} />
        );
      })}
      {userLocation && (() => {
        const pos = geoToMeshPos(userLocation.lat, userLocation.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (!pos) return null;
        return (
          <group position={pos}>
            {/* Pin shaft */}
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
              <meshStandardMaterial color="#ff3b30" />
            </mesh>
            {/* Pin head */}
            <mesh position={[0, 0.35, 0]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={0.8} />
            </mesh>
            {/* Pulsing ring at base */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <ringGeometry args={[0.06, 0.1, 24]} />
              <meshStandardMaterial color="#ff3b30" transparent opacity={0.5} />
            </mesh>
            <Html position={[0, 0.5, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
              <div style={{
                color: '#ff3b30',
                padding: '1px 6px',
                fontSize: '10px',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 600,
                whiteSpace: 'nowrap',
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '4px',
              }}>
                📍 You are here
              </div>
            </Html>
          </group>
        );
      })()}
    </group>
  );
};

function extractMultiLineStrings(
  data: GeoJSONCollection,
  bounds: GeoBounds,
  terrain: TerrainData,
  exaggeration: number,
  meshWidth: number,
  meshHeight: number,
): [number, number, number][][] {
  const segments: [number, number, number][][] = [];
  for (const feature of data.features) {
    let lines: number[][][] = [];
    if (feature.geometry.type === 'LineString') {
      lines = [feature.geometry.coordinates as number[][]];
    } else if (feature.geometry.type === 'MultiLineString') {
      lines = feature.geometry.coordinates as number[][][];
    }
    for (const line of lines) {
      const points: [number, number, number][] = [];
      for (const coord of line) {
        const pos = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (pos) points.push([pos[0], pos[1] + 0.04, pos[2]]);
      }
      if (points.length >= 2) segments.push(points);
    }
  }
  return segments;
}

function extractNamedLabels(
  data: GeoJSONCollection,
  bounds: GeoBounds,
  terrain: TerrainData,
  exaggeration: number,
  meshWidth: number,
  meshHeight: number,
  color: string,
): NamedLabel[] {
  const labels: NamedLabel[] = [];
  for (const feature of data.features) {
    const name = feature.properties?.Name as string | null;
    if (!name) continue;

    // Collect all coordinates to find midpoint
    let allCoords: number[][] = [];
    if (feature.geometry.type === 'LineString') {
      allCoords = feature.geometry.coordinates as number[][];
    } else if (feature.geometry.type === 'MultiLineString') {
      const lines = feature.geometry.coordinates as number[][][];
      for (const line of lines) allCoords.push(...line);
    }

    if (allCoords.length === 0) continue;

    // Use midpoint of all coordinates
    const midIdx = Math.floor(allCoords.length / 2);
    const midCoord = allCoords[midIdx];
    const pos = geoToMeshPos(midCoord[1], midCoord[0], bounds, terrain, exaggeration, meshWidth, meshHeight);
    if (pos) {
      labels.push({ name, pos: [pos[0], pos[1] + 0.12, pos[2]], color });
    }
  }
  return labels;
}

const HoverLabel = ({ label }: { label: NamedLabel }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={label.pos}>
      {/* Invisible hover sphere */}
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {/* Small dot always visible */}
      <mesh>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color={label.color} emissive={label.color} emissiveIntensity={0.5} />
      </mesh>
      {/* Label on hover */}
      {hovered && (
        <Html position={[0, 0.1, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: label.color,
            padding: '2px 6px',
            fontSize: '9px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '3px',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          }}>
            {label.name}
          </div>
        </Html>
      )}
    </group>
  );
};

const LakeMarker = ({ lake, pos, radius }: { lake: Lake; pos: [number, number, number]; radius: number }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={pos}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <circleGeometry args={[radius, 24]} />
        <meshStandardMaterial color="#2d8fce" transparent opacity={0.6} emissive="#2d8fce" emissiveIntensity={0.3} />
      </mesh>
      <Html position={[0, 0.12, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#5bc0eb',
          padding: '1px 4px',
          fontSize: '8px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 400,
          fontStyle: 'italic',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}>
          {lake.name}
        </div>
      </Html>
      {hovered && (
        <Html position={[0, 0.3, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            color: '#e0f0ff',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '10px',
            fontFamily: "'Inter', system-ui, sans-serif",
            lineHeight: '1.5',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(91,192,235,0.3)',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontWeight: 600, fontSize: '11px', color: '#5bc0eb', marginBottom: '3px' }}>{lake.name}</div>
            <div>📐 Area: <b>{lake.area_ha.toLocaleString()} ha</b></div>
            <div>📍 {lake.lat.toFixed(4)}°N, {lake.lon.toFixed(4)}°E</div>
            <div>🏘️ {lake.district}</div>
            <div>🗺️ {lake.massiv}</div>
            <div>🏢 {lake.organization}</div>
          </div>
        </Html>
      )}
    </group>
  );
};

export default GeoFeatures;
