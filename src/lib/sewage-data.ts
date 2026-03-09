/** Sewage/canalization coverage data by region and district */

export const SEWAGE_YEARS = [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024] as const;

export interface SewageEntry {
  nameEn: string;
  nameRu: string;
  values: Record<number, number>;
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

function mkEntry(nameEn: string, nameRu: string, vals: number[]): SewageEntry {
  return { nameEn, nameRu, values: Object.fromEntries(SEWAGE_YEARS.map((y, i) => [y, vals[i]])) };
}

// ─── Regional aggregates (for non-KK/Khorezm regions) ───
export const REGION_SEWAGE: Record<string, SewageEntry> = {
  'Andijan region': mkEntry('Andijan region', 'Андижанская область', [25.6,27.2,27.2,27.2,27.4,27.5,27.8,27.9,27.9,27.9,28.3,28.5,31.4,31.5,32.2]),
  'Bukhara region': mkEntry('Bukhara region', 'Бухарская область', [26.1,27.5,27.8,28.0,27.5,27.9,28.1,27.6,24.8,25.7,26.2,27.0,33.4,34.8,42.4]),
  'Jizzakh region': mkEntry('Jizzakh region', 'Джизакская область', [23.0,22.7,22.3,22.5,22.6,22.6,22.3,22.0,21.9,22.2,24.5,28.5,35.5,36.3,37.6]),
  'Kashkadarya province': mkEntry('Kashkadarya region', 'Кашкадарьинская область', [23.1,22.6,22.9,23.0,22.8,21.3,20.3,19.2,17.9,18.5,22.4,22.5,33.0,33.2,34.1]),
  'Navoi region': mkEntry('Navoi region', 'Навоийская область', [39.9,39.8,39.5,39.7,39.7,40.0,40.2,37.9,37.9,38.7,38.9,36.5,44.8,47.1,49.0]),
  'Namangan region': mkEntry('Namangan region', 'Наманганская область', [30.8,39.6,39.2,38.6,38.9,38.5,38.2,39.9,39.7,40.2,40.4,40.7,48.7,50.2,52.3]),
  'Samarkand region': mkEntry('Samarkand region', 'Самаркандская область', [27.3,27.0,26.6,26.7,26.3,26.0,25.7,25.2,25.6,26.1,26.9,42.2,43.5,42.3,42.9]),
  'Surkhandarya region': mkEntry('Surkhandarya region', 'Сурхандарьинская область', [20.9,22.4,22.6,22.6,22.7,23.0,23.1,26.2,26.0,25.3,23.6,35.4,35.7,36.4,37.1]),
  'Syrdarya region': mkEntry('Syrdarya region', 'Сырдарьинская область', [58.3,58.1,57.1,57.1,56.5,56.2,41.3,37.9,35.8,35.7,39.2,36.8,47.2,56.6,58.3]),
  'Tashkent region': mkEntry('Tashkent region', 'Ташкентская область', [45.0,44.1,43.2,42.6,42.6,42.7,42.9,42.6,42.7,44.0,48.1,63.8,66.4,69.0,69.9]),
  'Fergana region': mkEntry('Fergana region', 'Ферганская область', [27.9,28.1,28.1,29.4,31.2,31.9,32.4,34.5,35.2,35.6,36.1,52.7,53.1,53.6,54.2]),
  'Tashkent city': mkEntry('Tashkent city', 'город Ташкент', [99.7,99.8,99.3,100.0,100.0,100.0,100.0,100.0,100.0,100.0,98.6,100.0,100.0,100.0,94.8]),
};

// ─── District-level data for Karakalpakstan ───
// Keyed by shapeName from karakalpakstan_adm2.geojson
export const KK_DISTRICT_SEWAGE: Record<string, SewageEntry> = {
  'Nukus': mkEntry('Nukus city', 'Город Нукус', [0,0,0,0,0,0,32.9,37.1,36.3,31.7,32.7,47.5,57.6,61.6,61.7]),
  'Amudarya': mkEntry('Amudarya district', 'Амударьинский район', [0,0,0,0,0,0,0.4,0.3,0.5,0.5,1.7,2.2,21.5,23.9,26.0]),
  'Beruniy': mkEntry('Beruniy district', 'Берунийский район', [0,0,0,0,0,0,2.1,2.7,2.6,3.5,6.2,6.4,25.0,28.2,29.5]),
  'Bozatau': mkEntry('Bozatau district', 'Бозатауский район', [0,0,0,0,0,0,0,0,0,0.2,3.4,4.3,21.4,22.7,25.2]),
  'Karauzak': mkEntry('Karauzak district', 'Караузякский район', [0,0,0,0,0,0,0,0,0,0,2.8,3.4,25.2,26.9,29.1]),
  'Kegeyli': mkEntry('Kegeyli district', 'Кегейлийский район', [0,0,0,0,0,0,0.2,0.2,0.2,0,2.4,3.6,29.2,33.1,35.2]),
  'Kungrad': mkEntry('Kungrad district', 'Кунградский район', [0,0,0,0,0,0,15.6,19.3,19.0,22.1,21.9,28.4,37.6,39.2,38.1]),
  'Kanlykul': mkEntry('Kanlykul district', 'Канлыкульский район', [0,0,0,0,0,0,0.1,0.2,0.2,0.3,4.6,5.6,28.3,30.4,32.6]),
  'Muynak': mkEntry('Muynak district', 'Муйнакский район', [0,0,0,0,0,0,2.3,2.3,2.2,0,6.8,8.8,28.7,30.4,32.2]),
  'Nukus District': mkEntry('Nukus district', 'Нукусский район', [0,0,0,0,0,0,0.4,0.4,0.4,0.8,4.0,5.1,25.1,28.3,30.9]),
  'Takhiatash': mkEntry('Takhiatash district', 'Тахиаташский район', [0,0,0,0,0,0,0,0,30.1,23.8,23.4,23.3,34.9,40.3,41.3]),
  'Takhtakupyr': mkEntry('Takhtakupyr district', 'Тахтакупырский район', [0,0,0,0,0,0,0.1,0.1,0.1,0.5,5.1,6.7,28.3,28.4,31.4]),
  'Turtkul': mkEntry('Turtkul district', 'Турткульский район', [0,0,0,0,0,0,5.9,5.5,5.5,5.4,5.3,7.1,25.6,29.3,33.3]),
  'Khojeyli': mkEntry('Khojeyli district', 'Ходжейлийский район', [0,0,0,0,0,0,15.4,15.1,7.5,0,1.0,1.9,32.2,33.3,34.3]),
  'Chimbay': mkEntry('Chimbay district', 'Чимбайский район', [0,0,0,0,0,0,0.1,0.5,0.4,0.5,2.9,3.7,27.7,32.9,34.3]),
  'Shumanay': mkEntry('Shumanay district', 'Шуманайский район', [0,0,0,0,0,0,1.1,0.9,0.9,1.5,4.3,6.0,25.8,30.5,31.7]),
  'Ellikkala': mkEntry('Ellikkala district', 'Элликкалинский район', [0,0,0,0,0,0,0.2,0.9,0.9,0.8,3.1,3.9,21.5,28.7,29.8]),
};

// ─── District-level data for Khorezm ───
export const KHOREZM_DISTRICT_SEWAGE: Record<string, SewageEntry> = {
  'Urgench': mkEntry('Urgench city', 'Город Ургенч', [0,0,0,0,0,0,61.7,62.7,65.9,66.4,67.1,68.4,70.0,71.3,72.5]),
  'Khiva city': mkEntry('Khiva city', 'Город Хива', [0,0,0,0,0,0,0,32.2,37.9,33.8,34.6,35.8,38.6,40.8,42.9]),
  'Bagat': mkEntry('Bagat district', 'Багатский район', [0,0,0,0,0,0,1.8,1.8,5.4,11.5,12.8,15.0,16.7,18.4,19.5]),
  'Gurlan': mkEntry('Gurlan district', 'Гурленский район', [0,0,0,0,0,0,6.6,6.6,8.5,12.6,13.8,16.6,17.8,19.7,21.0]),
  'Kushkupyr': mkEntry('Kushkupyr district', 'Кошкупырский район', [0,0,0,0,0,0,5.9,9.4,11.1,14.1,14.8,16.8,18.9,21.0,22.5]),
  'Urgench District': mkEntry('Urgench district', 'Ургенчский район', [0,0,0,0,0,0,22.1,22.8,29.2,30.6,31.9,34.6,35.3,38.4,41.0]),
  'Khazarasp': mkEntry('Khazarasp district', 'Хазараспский район', [0,0,0,0,0,0,11.5,12.7,15.2,29.6,22.2,22.9,29.7,21.6,23.4]),
  'Tuprakkala': mkEntry('Tuprakkala district', 'Тупроккалинский район', [0,0,0,0,0,0,0,0,0,0,0,62.5,63.4,64.3,64.9]),
  'Khanka': mkEntry('Khanka district', 'Ханкинский район', [0,0,0,0,0,0,10.9,11.7,17.8,21.2,22.1,27.6,28.2,30.1,32.1]),
  'Khiva': mkEntry('Khiva district', 'Хивинский район', [0,0,0,0,0,0,14.6,2.2,7.7,11.2,12.0,14.2,15.1,17.6,18.4]),
  'Shavat': mkEntry('Shavat district', 'Шаватский район', [0,0,0,0,0,0,7.2,7.8,8.1,16.3,17.3,18.1,19.6,21.5,23.4]),
  'Yangiarik': mkEntry('Yangiarik district', 'Янгиарыкский район', [0,0,0,0,0,0,6.4,11.0,19.5,24.0,25.5,29.4,31.4,33.4,34.2]),
  'Yangibazar': mkEntry('Yangibazar district', 'Янгибазарский район', [0,0,0,0,0,0,5.1,9.7,14.5,15.9,19.2,21.6,22.7,24.8,26.4]),
};

/** Lookup sewage value: tries district maps first, then region */
export function getSewageForDistrict(shapeName: string, year: number): { entry: SewageEntry; value: number } | null {
  const kk = KK_DISTRICT_SEWAGE[shapeName];
  if (kk) return { entry: kk, value: kk.values[year] ?? 0 };
  const kh = KHOREZM_DISTRICT_SEWAGE[shapeName];
  if (kh) return { entry: kh, value: kh.values[year] ?? 0 };
  return null;
}

export function getSewageForRegion(regionName: string, year: number): { entry: SewageEntry; value: number } | null {
  const r = REGION_SEWAGE[regionName];
  if (!r) return null;
  return { entry: r, value: r.values[year] ?? 0 };
}
