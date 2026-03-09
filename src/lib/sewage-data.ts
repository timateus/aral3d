/** Sewage/canalization coverage data by region, parsed from SDMX CSV */

export const SEWAGE_YEARS = [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024] as const;

export interface RegionSewage {
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  values: Record<number, number>;
}

/** Regional-level data (viloyat aggregates) mapped to GeoJSON ADM1_EN names */
const REGION_MAP: Record<string, { code: string; nameEn: string; nameRu: string; vals: number[] }> = {
  'Republic of Karakalpakstan': { code: '1735', nameEn: 'Republic of Karakalpakstan', nameRu: 'Республика Каракалпакстан', vals: [11.0,11.1,11.2,11.2,10.5,10.5,10.1,10.7,10.7,9.9,11.4,15.6,33.3,36.8,38.2] },
  'Andijan region': { code: '1703', nameEn: 'Andijan region', nameRu: 'Андижанская область', vals: [25.6,27.2,27.2,27.2,27.4,27.5,27.8,27.9,27.9,27.9,28.3,28.5,31.4,31.5,32.2] },
  'Bukhara region': { code: '1706', nameEn: 'Bukhara region', nameRu: 'Бухарская область', vals: [26.1,27.5,27.8,28.0,27.5,27.9,28.1,27.6,24.8,25.7,26.2,27.0,33.4,34.8,42.4] },
  'Jizzakh region': { code: '1708', nameEn: 'Jizzakh region', nameRu: 'Джизакская область', vals: [23.0,22.7,22.3,22.5,22.6,22.6,22.3,22.0,21.9,22.2,24.5,28.5,35.5,36.3,37.6] },
  'Kashkadarya province': { code: '1710', nameEn: 'Kashkadarya region', nameRu: 'Кашкадарьинская область', vals: [23.1,22.6,22.9,23.0,22.8,21.3,20.3,19.2,17.9,18.5,22.4,22.5,33.0,33.2,34.1] },
  'Navoi region': { code: '1712', nameEn: 'Navoi region', nameRu: 'Навоийская область', vals: [39.9,39.8,39.5,39.7,39.7,40.0,40.2,37.9,37.9,38.7,38.9,36.5,44.8,47.1,49.0] },
  'Namangan region': { code: '1714', nameEn: 'Namangan region', nameRu: 'Наманганская область', vals: [30.8,39.6,39.2,38.6,38.9,38.5,38.2,39.9,39.7,40.2,40.4,40.7,48.7,50.2,52.3] },
  'Samarkand region': { code: '1718', nameEn: 'Samarkand region', nameRu: 'Самаркандская область', vals: [27.3,27.0,26.6,26.7,26.3,26.0,25.7,25.2,25.6,26.1,26.9,42.2,43.5,42.3,42.9] },
  'Surkhandarya region': { code: '1722', nameEn: 'Surkhandarya region', nameRu: 'Сурхандарьинская область', vals: [20.9,22.4,22.6,22.6,22.7,23.0,23.1,26.2,26.0,25.3,23.6,35.4,35.7,36.4,37.1] },
  'Syrdarya region': { code: '1724', nameEn: 'Syrdarya region', nameRu: 'Сырдарьинская область', vals: [58.3,58.1,57.1,57.1,56.5,56.2,41.3,37.9,35.8,35.7,39.2,36.8,47.2,56.6,58.3] },
  'Tashkent region': { code: '1727', nameEn: 'Tashkent region', nameRu: 'Ташкентская область', vals: [45.0,44.1,43.2,42.6,42.6,42.7,42.9,42.6,42.7,44.0,48.1,63.8,66.4,69.0,69.9] },
  'Fergana region': { code: '1730', nameEn: 'Fergana region', nameRu: 'Ферганская область', vals: [27.9,28.1,28.1,29.4,31.2,31.9,32.4,34.5,35.2,35.6,36.1,52.7,53.1,53.6,54.2] },
  'Khorezm region': { code: '1733', nameEn: 'Khorezm region', nameRu: 'Хорезмская область', vals: [13.1,12.8,13.3,13.4,13.9,14.3,15.6,16.8,20.7,25.3,26.3,29.0,31.1,32.3,33.9] },
  'Tashkent city': { code: '1726', nameEn: 'Tashkent city', nameRu: 'город Ташкент', vals: [99.7,99.8,99.3,100.0,100.0,100.0,100.0,100.0,100.0,100.0,98.6,100.0,100.0,100.0,94.8] },
};

export const REGION_SEWAGE: Record<string, RegionSewage> = {};
for (const [geoKey, data] of Object.entries(REGION_MAP)) {
  REGION_SEWAGE[geoKey] = {
    code: data.code,
    nameUz: geoKey,
    nameRu: data.nameRu,
    nameEn: data.nameEn,
    values: Object.fromEntries(SEWAGE_YEARS.map((y, i) => [y, data.vals[i]])),
  };
}

export function getSewageValue(regionName: string, year: number): number | null {
  const entry = REGION_SEWAGE[regionName];
  if (!entry) return null;
  return entry.values[year] ?? null;
}

/** Color scale: red (0%) → yellow (50%) → green (100%) */
export function sewageColor(value: number): string {
  const t = Math.max(0, Math.min(100, value)) / 100;
  if (t < 0.5) {
    const r = 220;
    const g = Math.round(60 + t * 2 * 160);
    const b = 50;
    return `rgb(${r},${g},${b})`;
  } else {
    const r = Math.round(220 - (t - 0.5) * 2 * 180);
    const g = 200;
    const b = 50;
    return `rgb(${r},${g},${b})`;
  }
}
