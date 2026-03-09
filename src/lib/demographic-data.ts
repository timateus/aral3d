/** Generic demographic CSV loader with name mapping for GeoJSON integration */

export interface DemographicIndicator {
  id: string;
  name: string;
  nameRu: string;
  unit: string;
  file: string;
  colorMode: 'pct-good' | 'pct-bad' | 'count' | 'years';
}

export const INDICATORS: DemographicIndicator[] = [
  { id: 'sewage', name: 'Sewage Coverage', nameRu: 'Канализация', unit: '%', file: '', colorMode: 'pct-good' },
  { id: 'drinking_water', name: 'Drinking Water', nameRu: 'Питьевая вода', unit: '%', file: '/data/drinking_water.csv', colorMode: 'pct-good' },
  { id: 'natural_gas', name: 'Natural Gas', nameRu: 'Природный газ', unit: '%', file: '/data/natural_gas.csv', colorMode: 'pct-good' },
  { id: 'life_expectancy', name: 'Life Expectancy', nameRu: 'Прод. жизни', unit: 'yrs', file: '/data/life_expectancy.csv', colorMode: 'years' },
  { id: 'maternal_mortality', name: 'Maternal Mortality', nameRu: 'Материнская смертность', unit: 'per 100k', file: '/data/maternal_mortality.csv', colorMode: 'pct-bad' },
  { id: 'infant_mortality', name: 'Infant Mortality', nameRu: 'Младенч. смертность', unit: '‰', file: '/data/infant_mortality.csv', colorMode: 'pct-bad' },
  { id: 'child_mortality', name: 'Child Mortality (<5)', nameRu: 'Детская смертность (<5)', unit: '‰', file: '/data/child_mortality.csv', colorMode: 'pct-bad' },
  { id: 'adolescent_childbirth', name: 'Teen Childbirth (15-17)', nameRu: 'Рожд. подростков', unit: '‰', file: '/data/adolescent_childbirth.csv', colorMode: 'pct-bad' },
  { id: 'marriages', name: 'Marriages (Rural)', nameRu: 'Браки (село)', unit: '', file: '/data/arranged_marriages.csv', colorMode: 'count' },
  { id: 'arrivals', name: 'Immigration', nameRu: 'Иммиграция', unit: '', file: '/data/arrivals.csv', colorMode: 'count' },
  { id: 'emigrants', name: 'Emigration', nameRu: 'Эмиграция', unit: '', file: '/data/emigrants.csv', colorMode: 'count' },
  { id: 'housing_raw_brick', name: 'Housing: Raw Brick', nameRu: 'Жильё: сырцов. кирпич', unit: 'k m²', file: '/data/housing_raw_brick.csv', colorMode: 'count' },
  { id: 'housing_burnt_brick', name: 'Housing: Burnt Brick', nameRu: 'Жильё: жжён. кирпич', unit: 'k m²', file: '/data/housing_burnt_brick.csv', colorMode: 'count' },
  { id: 'housing_concrete', name: 'Housing: Concrete', nameRu: 'Жильё: ж/б панели', unit: 'k m²', file: '/data/housing_concrete.csv', colorMode: 'count' },
];

export const YEARS = [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024] as const;

export interface CsvRow {
  code: string;
  nameEn: string;
  nameRu: string;
  values: Record<number, number>;
}

export interface CsvData {
  rows: CsvRow[];
  byNormName: Map<string, CsvRow>;
  byCode: Map<string, CsvRow>;
  maxByYear: Record<number, number>;
  globalMax: number;
  /** Region codes that have at least one district with non-zero data for any year */
  regionsWithDistrictData: Set<string>;
}

const csvCache = new Map<string, CsvData>();

/** Aggressively normalize a name for matching */
function normalizeName(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*(district|city|region|province|republic of|respublikasi|tumani|viloyati|shahri|shahar)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Even more aggressive: strip all non-alpha and collapse */
function superNormalize(name: string): string {
  return normalizeName(name).replace(/[^a-z]/g, '');
}

/**
 * Comprehensive alias map: GeoJSON shapeName (normalized) → CSV Klassifikator_en (normalized)
 * Handles transliteration differences between GeoJSON and CSV sources
 */
const ALIASES: Record<string, string[]> = {
  // Karakalpakstan
  'takhtakupir': ['takhtakupyr'],
  'shumanai': ['shumanay'],
  'kungrad': ['qongirot', 'kungrad'],
  'chimbay': ['chimboy'],
  'khojeyli': ['khojayli', 'xojayli'],
  'ellikkala': ['ellikqala'],
  'turtkul': ['tortkol', 'turtkul'],
  'bozatau': ['bozatov'],
  'karauzak': ['qarauzak'],
  'kanlykul': ['qanlikol'],
  'takhiatash': ['taxiatosh'],
  
  // Andijan
  'altinkul': ['altynkul'],
  'izboskan': ['izbaskan'],
  'paxtaabad': ['pakhtaabad'],
  'khanabad': ['xonobod', 'khanabad'],
  'bustan': ['boston'],
  'bulakbashi': ['buloqboshi'],
  'jalaquduk': ['jalakuduk'],
  'ulugnor': ['ulugnar'],
  'kurgantepa': ['qorgontepa'],
  'shakhrikhan': ['shaxrixon'],
  'khojaabad': ['xojaobod'],
  'balykchi': ['baliqchi'],
  
  // Bukhara
  'alat': ['olot'],
  'gijduvan': ['gijduvon', 'ghijduvon'],
  'kagan': ['kogon'],
  'karakul': ['qarakol', 'qarakul'],
  'qorovulbozor': ['qarovulbozor'],
  'peshkun': ['peshku'],
  'shafirkan': ['shofirkon'],
  
  // Jizzakh
  'jizzakh': ['jizzax'],
  'arnasay': ['arnasoy'],
  'bakhmal': ['baxmal'],
  'gallaaral': ['gallaorol'],
  'sharofrashidov': ['sharofrashidov'],
  'dustlik': ['dostlik'],
  'zomin': ['zamin'],
  'zarbdar': ['zarbdor'],
  'mirzachul': ['mirzachol'],
  'zafarabad': ['zafarobod'],
  'pakhtakor': ['paxtakor'],
  'farish': ['forish'],
  'yangiabad': ['yangiobod'],
  
  // Kashkadarya
  'karshi': ['qarshi'],
  'shakhrisabz': ['shahrisabz'],
  'gissar': ['guzor', 'ghuzor'],
  'dehkanabad': ['dehqonobod'],
  'kamashi': ['qamashi'],
  'kasan': ['koson'],
  'kitab': ['kitob'],
  'mubarek': ['muborak'],
  'nishon': ['nishon'],
  'kasbi': ['kasbi'],
  'chirakchi': ['chiroqchi'],
  'yakkabag': ['yakkabog'],
  'kukdala': ['kokdala'],
  
  // Navoi
  'navoi': ['navoiy'],
  'zarafshan': ['zarafshon'],
  'gazgan': ['gozgon'],
  'kanimekh': ['konimex'],
  'kyzyltepa': ['qiziltepa'],
  'navbahor': ['navbahor'],
  'nurota': ['nurata'],
  'tomdy': ['tomdi'],
  'uchkuduk': ['uchquduq'],
  'khatyrchi': ['xatirchi'],
  
  // Namangan
  'mingbulak': ['mingbuloq'],
  'kasansay': ['kosonsoy'],
  'naryn': ['norin'],
  'turakurgan': ['toraqorgon'],
  'uchkurgan': ['uchqorgon'],
  'chartak': ['chortoq'],
  'chust': ['chust'],
  'yangikurgan': ['yangiqqorgon'],
  
  // Samarkand
  'akdarya': ['oqdaryo'],
  'bulungur': ['bulungur'],
  'jomboy': ['jomboy'],
  'ishtykhan': ['ishtixon'],
  'kattakurgan': ['kattaqorgon'],
  'koshrabad': ['qoshrabot'],
  'narpai': ['narpay'],
  'payaryk': ['payariq'],
  'pastdargom': ['pastdargom'],
  'pakhtachi': ['paxtachi'],
  'nurabad': ['nurobod'],
  'urgut': ['urgut'],
  'tailak': ['tayloq'],
  
  // Surkhandarya
  'termez': ['termiz'],
  'altynsay': ['oltinsoy'],
  'angor': ['angor'],
  'bandykhan': ['bandixon'],
  'baysun': ['boysun'],
  'muzrabad': ['muzrabot'],
  'denau': ['denov'],
  'jarkurgan': ['jarqorgon'],
  'kumkurgan': ['qumqorgon'],
  'kizirik': ['qiziriq'],
  'sariosia': ['sariosiyo'],
  'uzun': ['uzun'],
  'sherabad': ['sherobod'],
  'shurchi': ['shorchi'],
  
  // Syrdarya
  'gulistan': ['guliston'],
  'shirin': ['shirin'],
  'yangier': ['yangiyer'],
  'akaltyn': ['oqoltin'],
  'bayaut': ['boyovut'],
  'saykhunabad': ['sayxunobod'],
  'sardoba': ['sardoba'],
  'mirzaabad': ['mirzaobod'],
  'khovos': ['xovos'],
  
  // Tashkent region
  'nurafshon': ['nurafshan'],
  'almalyk': ['olmaliq'],
  'angren': ['angren'],
  'bekabad': ['bekobod'],
  'chirchik': ['chirchiq'],
  'akhangaran': ['ohangaron'],
  'yangiyul': ['yangiyo l', 'yangiyol'],
  'akkurgan': ['oqqorgon'],
  'bostanlyk': ['bostonliq'],
  'buka': ['boka'],
  'kuyichirchik': ['quyichirchiq'],
  'zangiata': ['zangiota'],
  'yukorichirchik': ['yuqorichirchiq'],
  'kibray': ['qibray'],
  'parkent': ['parkent'],
  'piskent': ['piskent'],
  'urtachirchik': ['ortachirchiq'],
  'chinaz': ['chinoz'],
  
  // Fergana
  'fergana': ['fargona'],
  'kokand': ['qoqon'],
  'kuvasay': ['quvasoy'],
  'margilan': ['margilon'],
  'altyaryk': ['oltiariq'],
  'kushtepa': ['qoshtepa'],
  'baghdad': ['bogdod'],
  'besharik': ['beshariq'],
  'kuva': ['quva'],
  'uchkuprik': ['uchkoprik'],
  'rishtan': ['rishton'],
  'sokh': ['sox'],
  'tashlak': ['toshloq'],
  'dangara': ['dangara'],
  'furkat': ['furqat'],
  'yazyavan': ['yozyovon'],
  
  // Khorezm
  'urgench': ['urganch'],
  'khiva': ['xiva'],
  'bagat': ['bogot'],
  'gurlan': ['gurlan'],
  'kushkupyr': ['qoshkopir'],
  'khazarasp': ['xazarasp'],
  'tuprakkala': ['tuproqqala', 'tuprakkala'],
  'khanka': ['xonqa'],
  'shavat': ['shovot'],
  'yangiaryk': ['yangiariaq'],
  'yangibazar': ['yangibozor'],
  
  // Tashkent city districts
  'uchtepa': ['uchtepa'],
  'bektemir': ['bektemir'],
  'yunusabad': ['yunusobod'],
  'mirzoulugbek': ['mirzoulugbek'],
  'mirabad': ['mirobod'],
  'shaykhantakhur': ['shayxontoxur'],
  'almazar': ['olmazor'],
  'sergeli': ['sirgali'],
  'yakkasaray': ['yakkasaroy'],
  'yashnabad': ['yashnobod'],
  'yangikhayot': ['yangihayot'],
  'chilanzar': ['chilonzor'],
};

// Build reverse alias map for fast lookup
const reverseAliases = new Map<string, string>();
for (const [key, aliases] of Object.entries(ALIASES)) {
  for (const alias of aliases) {
    const normAlias = alias.replace(/[^a-z]/g, '');
    reverseAliases.set(normAlias, key);
  }
}

/** Region code → ADM1 shapeName mapping for hierarchy detection */
const REGION_CODE_PREFIX: Record<string, string> = {
  '1735': 'karakalpakstan',
  '1703': 'andijan',
  '1706': 'bukhara',
  '1708': 'jizzakh',
  '1710': 'kashkadarya',
  '1712': 'navoi',
  '1714': 'namangan',
  '1718': 'samarkand',
  '1722': 'surkhandarya',
  '1724': 'syrdarya',
  '1727': 'tashkent',
  '1730': 'fergana',
  '1733': 'khorezm',
  '1726': 'tashkent city',
};

/** Map ADM1 shapeName (super-normalized) → region code prefix.
 *  Includes GeoJSON transliteration variants (e.g. "xorazm" for Khorezm) */
const ADM1_TO_CODE: Record<string, string> = {
  'karakalpakstan': '1735',
  'republicofkarakalpakstan': '1735',
  'andijan': '1703',
  'andijon': '1703',
  'bukhara': '1706',
  'buxoro': '1706',
  'jizzakh': '1708',
  'jizzax': '1708',
  'kashkadarya': '1710',
  'qashqadaryo': '1710',
  'navoi': '1712',
  'navoiy': '1712',
  'namangan': '1714',
  'samarkand': '1718',
  'samarqand': '1718',
  'surkhandarya': '1722',
  'surxondaryo': '1722',
  'syrdarya': '1724',
  'sirdaryo': '1724',
  'tashkent': '1727',
  'toshkent': '1727',
  'fergana': '1730',
  'fargona': '1730',
  'khorezm': '1733',
  'xorazm': '1733',
  'tashkentcity': '1726',
  'toshkentcity': '1726',
};

function parseCsv(text: string): CsvData {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { rows: [], byNormName: new Map(), byCode: new Map(), maxByYear: {}, globalMax: 0, regionsWithDistrictData: new Set() };

  const header = lines[0].split(',');
  const yearCols = header.slice(5).map(h => parseInt(h.trim()));

  const rows: CsvRow[] = [];
  const byNormName = new Map<string, CsvRow>();
  const byCode = new Map<string, CsvRow>();
  const maxByYear: Record<number, number> = {};
  let globalMax = 0;
  const regionsWithDistrictData = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 6) continue;
    const code = cols[0].trim();
    const nameEn = cols[3].trim();
    const nameRu = cols[2].trim();
    const values: Record<number, number> = {};
    let hasNonZero = false;
    for (let j = 0; j < yearCols.length; j++) {
      const v = parseFloat(cols[5 + j]);
      values[yearCols[j]] = isNaN(v) ? 0 : v;
      if (!isNaN(v) && v > 0) {
        hasNonZero = true;
        maxByYear[yearCols[j]] = Math.max(maxByYear[yearCols[j]] || 0, v);
        globalMax = Math.max(globalMax, v);
      }
    }
    const row: CsvRow = { code, nameEn, nameRu, values };
    rows.push(row);

    // Index by normalized name (with suffix stripped)
    const norm = normalizeName(nameEn);
    byNormName.set(norm, row);
    // Also index by super-normalized (alpha-only)
    const sn = superNormalize(nameEn);
    if (!byNormName.has(sn)) byNormName.set(sn, row);
    
    // Also index by the raw English name lowercased for direct matching
    const rawLower = nameEn.toLowerCase().trim();
    if (!byNormName.has(rawLower)) byNormName.set(rawLower, row);

    // Index by code
    byCode.set(code, row);

    // Track regions with district data
    if (code.length >= 7 && hasNonZero) {
      const regionCode = code.substring(0, 4);
      regionsWithDistrictData.add(regionCode);
    }
  }

  return { rows, byNormName, byCode, maxByYear, globalMax, regionsWithDistrictData };
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

/** Find the closest available year in the data */
function closestYear(values: Record<number, number>, targetYear: number): number {
  const years = Object.keys(values).map(Number).filter(y => values[y] > 0);
  if (years.length === 0) return targetYear;
  return years.reduce((best, y) => Math.abs(y - targetYear) < Math.abs(best - targetYear) ? y : best);
}

/** Look up a CSV row by GeoJSON shapeName (district-level) */
export function lookupByShapeName(
  data: CsvData, shapeName: string, year: number
): { nameEn: string; nameRu: string; value: number } | null {
  const norm = normalizeName(shapeName);
  const sn = superNormalize(shapeName);

  // Direct lookup
  let row = data.byNormName.get(norm) || data.byNormName.get(sn);

  // Try with suffixes
  if (!row) {
    for (const suffix of ['district', 'city']) {
      row = data.byNormName.get(norm + ' ' + suffix) ||
            data.byNormName.get(sn + suffix);
      if (row) break;
    }
  }

  // Try aliases
  if (!row) {
    const aliasTarget = reverseAliases.get(sn);
    if (aliasTarget) {
      row = data.byNormName.get(aliasTarget);
      if (!row) {
        for (const suffix of ['district', 'city']) {
          row = data.byNormName.get(aliasTarget + ' ' + suffix) ||
                data.byNormName.get(aliasTarget + suffix);
          if (row) break;
        }
      }
    }
    // Also try the shapeName as an alias key
    const directAliases = ALIASES[sn];
    if (!row && directAliases) {
      for (const alias of directAliases) {
        const aSn = alias.replace(/[^a-z]/g, '');
        row = data.byNormName.get(aSn);
        if (!row) {
          for (const suffix of ['district', 'city']) {
            row = data.byNormName.get(aSn + suffix) ||
                  data.byNormName.get(alias + ' ' + suffix);
            if (row) break;
          }
        }
        if (row) break;
      }
    }
  }

  if (!row) return null;
  // Use exact year or closest available year
  let val = row.values[year] ?? 0;
  if (val === 0) {
    const cy = closestYear(row.values, year);
    val = row.values[cy] ?? 0;
  }
  return { nameEn: row.nameEn, nameRu: row.nameRu, value: val };
}

/** Look up a region-level CSV row by ADM1 shapeName */
export function lookupByRegionName(
  data: CsvData, regionName: string, year: number
): { nameEn: string; nameRu: string; value: number } | null {
  const norm = normalizeName(regionName);
  const sn = superNormalize(regionName);

  let row = data.byNormName.get(norm) || data.byNormName.get(sn);
  if (!row) {
    row = data.byNormName.get(norm + ' region') || data.byNormName.get(sn + 'region');
  }
  // Try "republic of" prefix for Karakalpakstan
  if (!row && /karakalpakstan/i.test(regionName)) {
    row = data.byNormName.get('republic of karakalpakstan') ||
          data.byNormName.get('republicofkarakalpakstan');
    if (!row) row = data.byCode.get('1735');
  }
  // Try by code
  if (!row) {
    const code = ADM1_TO_CODE[sn];
    if (code) row = data.byCode.get(code);
  }

  if (!row) return null;
  // Use exact year or closest available year
  let val = row.values[year] ?? 0;
  if (val === 0) {
    const cy = closestYear(row.values, year);
    val = row.values[cy] ?? 0;
  }
  return { nameEn: row.nameEn, nameRu: row.nameRu, value: val };
}

/** Check if a region has district-level data in this dataset */
export function regionHasDistrictData(data: CsvData, regionName: string): boolean {
  const sn = superNormalize(regionName);
  const code = ADM1_TO_CODE[sn];
  if (!code) return false;
  return data.regionsWithDistrictData.has(code);
}

export function getMaxForYear(data: CsvData, year: number): number {
  return data.maxByYear[year] || 1;
}

export function getGlobalMax(data: CsvData): number {
  return data.globalMax || 1;
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

/** Get normalized height (0-1) for a given indicator and value, proportional to global max */
export function getIndicatorHeight(indicator: DemographicIndicator, value: number, maxVal: number = 100): number {
  if (maxVal <= 0 || value <= 0) return 0;
  return Math.max(0, Math.min(1, value / maxVal));
}
