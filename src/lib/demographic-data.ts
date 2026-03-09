/** Generic demographic CSV loader with name mapping for GeoJSON integration */

export interface DemographicIndicator {
  id: string;
  name: string;
  nameRu: string;
  unit: string;
  file: string;
  colorMode: 'pct-good' | 'pct-bad' | 'count' | 'years';
  // pct-good: higher % is green (water, gas, sewage)
  // pct-bad: higher rate is red (childbirth)
  // count: blue gradient normalized per-year
  // years: life expectancy scale
}

export const INDICATORS: DemographicIndicator[] = [
  { id: 'sewage', name: 'Sewage Coverage', nameRu: 'Канализация', unit: '%', file: '', colorMode: 'pct-good' },
  { id: 'drinking_water', name: 'Drinking Water', nameRu: 'Питьевая вода', unit: '%', file: '/data/drinking_water.csv', colorMode: 'pct-good' },
  { id: 'natural_gas', name: 'Natural Gas', nameRu: 'Природный газ', unit: '%', file: '/data/natural_gas.csv', colorMode: 'pct-good' },
  { id: 'adolescent_childbirth', name: 'Teen Childbirth (15-17)', nameRu: 'Рожд. подростков', unit: '‰', file: '/data/adolescent_childbirth.csv', colorMode: 'pct-bad' },
  { id: 'life_expectancy', name: 'Life Expectancy', nameRu: 'Прод. жизни', unit: 'yrs', file: '/data/life_expectancy.csv', colorMode: 'years' },
  { id: 'marriages', name: 'Marriages (Rural)', nameRu: 'Браки (село)', unit: '', file: '/data/arranged_marriages.csv', colorMode: 'count' },
  { id: 'arrivals', name: 'Immigration', nameRu: 'Иммиграция', unit: '', file: '/data/arrivals.csv', colorMode: 'count' },
  { id: 'emigrants', name: 'Emigration', nameRu: 'Эмиграция', unit: '', file: '/data/emigrants.csv', colorMode: 'count' },
  { id: 'housing_raw_brick', name: 'Housing: Raw Brick', nameRu: 'Жильё: сырцов. кирпич', unit: 'k m²', file: '/data/housing_raw_brick.csv', colorMode: 'count' },
  { id: 'housing_burnt_brick', name: 'Housing: Burnt Brick', nameRu: 'Жильё: жжён. кирпич', unit: 'k m²', file: '/data/housing_burnt_brick.csv', colorMode: 'count' },
  { id: 'housing_concrete', name: 'Housing: Concrete', nameRu: 'Жильё: ж/б панели', unit: 'k m²', file: '/data/housing_concrete.csv', colorMode: 'count' },
];

export const YEARS = [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024] as const;

interface CsvRow {
  code: string;
  nameEn: string;
  nameRu: string;
  values: Record<number, number>;
}

interface CsvData {
  rows: CsvRow[];
  byNormName: Map<string, CsvRow>;
  maxByYear: Record<number, number>;
}

// Cache loaded CSVs
const csvCache = new Map<string, CsvData>();

function normalizeName(name: string): string {
  return name.toLowerCase()
    .replace(/\s+(district|city|region|province|republic of|respublikasi)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Hard-coded alias map for mismatches between GeoJSON shapeName and CSV Klassifikator_en
const ALIASES: Record<string, string> = {
  'takhtakupir': 'takhtakupyr',
  'nukus district': 'nukus',  // CSV has "Nukus district" which normalizes to "nukus"
  'urgench district': 'urgench', // same pattern
  'khiva city': 'khiva',
  'tuprakkala': 'tuprakkala',
  'shumanai': 'shumanay', // CSV has "Shumanai" vs GeoJSON "Shumanay"
};

// Region name mapping: GeoJSON ADM1_EN → CSV Klassifikator_en (normalized)
const REGION_ALIASES: Record<string, string> = {
  'kashkadarya province': 'kashkadarya',
};

function parseCsv(text: string): CsvData {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { rows: [], byNormName: new Map(), maxByYear: {} };

  const header = lines[0].split(',');
  const yearCols = header.slice(5).map(h => parseInt(h.trim()));

  const rows: CsvRow[] = [];
  const byNormName = new Map<string, CsvRow>();
  const maxByYear: Record<number, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 6) continue;
    const code = cols[0].trim();
    const nameEn = cols[3].trim();
    const nameRu = cols[2].trim();
    const values: Record<number, number> = {};
    for (let j = 0; j < yearCols.length; j++) {
      const v = parseFloat(cols[5 + j]);
      values[yearCols[j]] = isNaN(v) ? 0 : v;
      if (!isNaN(v) && v > 0) {
        maxByYear[yearCols[j]] = Math.max(maxByYear[yearCols[j]] || 0, v);
      }
    }
    const row: CsvRow = { code, nameEn, nameRu, values };
    rows.push(row);

    // Index by normalized name (strip "district"/"city"/"region" suffix)
    const norm = normalizeName(nameEn);
    byNormName.set(norm, row);
  }

  return { rows, byNormName, maxByYear };
}

export async function loadIndicatorData(indicator: DemographicIndicator): Promise<CsvData | null> {
  if (!indicator.file) return null;
  const cached = csvCache.get(indicator.id);
  if (cached) return cached;

  try {
    const resp = await fetch(indicator.file);
    const text = await resp.text();
    const data = parseCsv(text);
    csvCache.set(indicator.id, data);
    return data;
  } catch {
    return null;
  }
}

/** Look up a value by GeoJSON shapeName (for KK/Khorezm districts) */
export function lookupByShapeName(
  data: CsvData, shapeName: string, year: number
): { nameEn: string; nameRu: string; value: number } | null {
  let norm = normalizeName(shapeName);

  // Check aliases
  const alias = ALIASES[norm];

  // Try direct lookup
  let row = data.byNormName.get(norm);
  if (!row && alias) row = data.byNormName.get(alias);

  // Try appending common suffixes
  if (!row) {
    for (const suffix of ['district', 'city']) {
      const candidate = data.byNormName.get(norm + ' ' + suffix) ||
                         data.byNormName.get((alias || norm) + ' ' + suffix);
      if (candidate) { row = candidate; break; }
    }
  }

  if (!row) return null;
  return { nameEn: row.nameEn, nameRu: row.nameRu, value: row.values[year] ?? 0 };
}

/** Look up a value by region ADM1_EN name */
export function lookupByRegionName(
  data: CsvData, regionName: string, year: number
): { nameEn: string; nameRu: string; value: number } | null {
  let norm = normalizeName(regionName);
  const alias = REGION_ALIASES[norm];

  let row = data.byNormName.get(norm);
  if (!row && alias) row = data.byNormName.get(alias);

  // Try with "region" suffix
  if (!row) {
    row = data.byNormName.get(norm + ' region') ||
          data.byNormName.get((alias || norm) + ' region');
  }

  if (!row) return null;
  return { nameEn: row.nameEn, nameRu: row.nameRu, value: row.values[year] ?? 0 };
}

/** Get max value for a year (for normalizing count data) */
export function getMaxForYear(data: CsvData, year: number): number {
  return data.maxByYear[year] || 1;
}

/** Color for percentage data (higher = better): red→yellow→green */
export function colorPctGood(value: number): string {
  const t = Math.max(0, Math.min(100, value)) / 100;
  if (t < 0.5) {
    const r = 220;
    const g = Math.round(60 + t * 2 * 160);
    return `rgb(${r},${g},50)`;
  }
  const r = Math.round(220 - (t - 0.5) * 2 * 180);
  return `rgb(${r},200,50)`;
}

/** Color for rate data (higher = worse): green→yellow→red */
export function colorPctBad(value: number, maxVal: number): string {
  if (maxVal <= 0) return 'rgb(40,200,50)';
  const t = Math.max(0, Math.min(1, value / maxVal));
  if (t < 0.5) {
    const r = Math.round(40 + t * 2 * 180);
    const g = 200;
    return `rgb(${r},${g},50)`;
  }
  const g = Math.round(200 - (t - 0.5) * 2 * 140);
  return `rgb(220,${g},50)`;
}

/** Color for count data: light blue → dark blue */
export function colorCount(value: number, maxVal: number): string {
  if (maxVal <= 0) return 'rgb(100,150,220)';
  const t = Math.max(0, Math.min(1, value / maxVal));
  const r = Math.round(100 - t * 70);
  const g = Math.round(150 - t * 80);
  const b = Math.round(220 - t * 60);
  return `rgb(${r},${g},${b})`;
}

/** Color for life expectancy: 60-80 years scale, blue→green */
export function colorYears(value: number): string {
  if (value <= 0) return 'rgb(80,80,80)';
  const t = Math.max(0, Math.min(1, (value - 60) / 20));
  const r = Math.round(60 - t * 30);
  const g = Math.round(100 + t * 120);
  const b = Math.round(200 - t * 100);
  return `rgb(${r},${g},${b})`;
}

/** Get the color for a given indicator and value */
export function getIndicatorColor(indicator: DemographicIndicator, value: number, maxVal: number = 100): string {
  switch (indicator.colorMode) {
    case 'pct-good': return colorPctGood(value);
    case 'pct-bad': return colorPctBad(value, maxVal);
    case 'count': return colorCount(value, maxVal);
    case 'years': return colorYears(value);
    default: return colorPctGood(value);
  }
}

/** Get normalized height (0-1) for a given indicator and value */
export function getIndicatorHeight(indicator: DemographicIndicator, value: number, maxVal: number = 100): number {
  switch (indicator.colorMode) {
    case 'pct-good': return Math.max(0, Math.min(1, value / 100));
    case 'pct-bad': return maxVal > 0 ? Math.max(0, Math.min(1, value / maxVal)) : 0;
    case 'count': return maxVal > 0 ? Math.max(0, Math.min(1, value / maxVal)) : 0;
    case 'years': return value > 0 ? Math.max(0, Math.min(1, (value - 60) / 20)) : 0;
    default: return 0;
  }
}
