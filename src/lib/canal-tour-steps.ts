export interface CanalEntry {
  canal: string;
  otherName: string;
  geography: string;
  ancientIrrigation: string;
  event: string;
  date: string;
  ethnicity: string;
  lat: number;
  lon: number;
}

export interface CanalTourStep {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  canals: CanalEntry[];
  camera: { position: [number, number, number]; target: [number, number, number] };
  layers: {
    showBorders: boolean;
    showRivers: boolean;
    show13thBasin: boolean;
    show19thBasin: boolean;
    show21stBasin: boolean;
    showWaterExtent: boolean;
  };
  year: number;
}

// Ethnicity color map
export const ETHNICITY_COLORS: Record<string, string> = {
  'Uzbeks': '#e6a23c',
  'Turkmens': '#f56c6c',
  'Qaraqalpaqs': '#409eff',
  'Qazaqs': '#67c23a',
};

export function getEthnicityColor(ethnicity: string): string {
  for (const [key, color] of Object.entries(ETHNICITY_COLORS)) {
    if (ethnicity.includes(key.replace('s', ''))) return color;
  }
  return '#909399';
}

export function getUniqueEthnicities(canals: CanalEntry[]): string[] {
  const all = new Set<string>();
  for (const c of canals) {
    for (const e of c.ethnicity.split(/,\s*/)) {
      const trimmed = e.trim();
      if (trimmed) all.add(trimmed);
    }
  }
  return Array.from(all);
}

export const CANAL_TOUR_STEPS: CanalTourStep[] = [
  {
    id: 1,
    title: 'Ancient Waterways',
    subtitle: '17th Century — Qaraqalpaq Floodplains',
    description: 'The earliest canals followed the shifting paths of the Amu Darya. Qaraqalpaqs practiced semi-nomadic livelihoods along these floodplains to the north of Nukus.',
    canals: [
      { canal: 'Kegeyli Canal', otherName: 'Kerder', geography: 'Nukus-Kegeyli-Chimbay', ancientIrrigation: 'Yes - was Amu Darya', event: 'An ancient riverbank revived as a canal when the Amu Darya shifted westwards in the 9th century.', date: '17-18 cent', ethnicity: 'Qaraqalpaqs', lat: 42.78, lon: 59.61 },
      { canal: 'Qizketken Canal', otherName: 'Kok Ózák, Dosliq', geography: 'Kokuzak, Nukus, Tawkara', ancientIrrigation: 'Yes - was Amu Darya', event: 'A floodplain where Qaraqalpaqs conducted semi-nomadic livelihoods.', date: '17th cent', ethnicity: 'Qaraqalpaqs', lat: 42.50, lon: 59.30 },
      { canal: 'Kók uzak', otherName: 'Qizketken, Dosliq', geography: 'Kokuzak, Nukus, Tawkara', ancientIrrigation: 'Yes - was Amu Darya', event: 'A floodplain where Qaraqalpaqs conducted semi-nomadic livelihoods.', date: '17th cent', ethnicity: 'Qaraqalpaqs', lat: 42.48, lon: 59.28 },
      { canal: 'Aq yaqish', otherName: '', geography: 'Tawkara', ancientIrrigation: 'Yes - was Amu Darya', event: 'Part of the Qaraqalpaq floodplain system for mixed pastoral and agricultural use.', date: '17th cent', ethnicity: 'Qaraqalpaqs', lat: 42.30, lon: 59.40 },
    ],
    camera: { position: [2, 8, 10], target: [0, 0, 1] },
    layers: { showBorders: true, showRivers: true, show13thBasin: true, show19thBasin: false, show21stBasin: false, showWaterExtent: true },
    year: 1960,
  },
  {
    id: 2,
    title: 'Khorezm Canal Settlements',
    subtitle: '17th Century — Uzbek & Turkmen Territories',
    description: 'The Khorezmian heartland was divided by its canals: Uzbeks occupied the fertile upper reaches while Turkmens were settled at the canal ends.',
    canals: [
      { canal: 'Shavat Canal', otherName: 'Vadak', geography: 'Honqa Urgench', ancientIrrigation: 'Possibly (Dawdan canal)', event: 'Xorezmians on the best land and Turkmens at the ends of the canals.', date: '17th cent', ethnicity: 'Uzbeks', lat: 41.55, lon: 60.63 },
      { canal: 'Yarmish', otherName: 'Buve', geography: 'Katqala', ancientIrrigation: 'Possibly (Buve canal)', event: 'Xorezmians on the best land and Turkmens at the ends of the canals.', date: '17th cent', ethnicity: 'Uzbeks', lat: 41.50, lon: 60.30 },
      { canal: 'Xorasan (Pahlavan) Canal', otherName: 'Heykanik', geography: 'Xiva', ancientIrrigation: 'Yes', event: 'Xorezmians on the best land and Turkmens at the ends of the canals.', date: '17th cent', ethnicity: 'Uzbeks', lat: 41.38, lon: 60.36 },
      { canal: 'Ataliq Arna', otherName: 'Mangit arna', geography: 'Mangit', ancientIrrigation: 'No', event: 'The frontier city of the Uzbek territory of Khorezm, included Manghit Qaraqalpaqs.', date: '17th cent', ethnicity: 'Uzbeks, Qaraqalpaqs', lat: 41.78, lon: 60.06 },
      { canal: 'Sevgenli', otherName: 'Leninabad, Sowyet Yab', geography: 'Khojaeli', ancientIrrigation: 'No', event: 'For irrigation of lands of the Uzbeks and Qaraqalpaqs of the Khojaeli tribe.', date: '17th cent', ethnicity: 'Qaraqalpaqs, Uzbeks', lat: 42.40, lon: 59.45 },
    ],
    camera: { position: [-5, 6, 8], target: [-1, 0, 2] },
    layers: { showBorders: true, showRivers: true, show13thBasin: false, show19thBasin: true, show21stBasin: false, showWaterExtent: true },
    year: 1960,
  },
  {
    id: 3,
    title: '18th Century Expansion',
    subtitle: 'Qaraqalpaqs & Turkmens Push Northward',
    description: 'New canals extended irrigation into previously unfarmed territory. The Ghazavat Canal encouraged Turkmen sedentary life.',
    canals: [
      { canal: 'Quwanishjarma', otherName: '', geography: 'Chimbay, Qarauzak', ancientIrrigation: 'No', event: 'Named after a Qaraqalpaq Quwanish. An extension of the Kok Uzak.', date: '18th cent', ethnicity: 'Qaraqalpaqs', lat: 42.93, lon: 59.65 },
      { canal: 'Ghazavat Canal', otherName: '', geography: "Qo'shko'pir", ancientIrrigation: 'No', event: 'Built in the 17th cent. Turkmens were settled here in the 18th century to encourage their loyalty and sedentary life.', date: '18th cent', ethnicity: 'Turkmens', lat: 41.52, lon: 60.32 },
      { canal: 'Esim Kanal', otherName: '', geography: 'Qaraózek, Tawkara', ancientIrrigation: 'No', event: 'Built in 1715 by the Karakalpaks to irrigate upstream pastures.', date: '18th cent', ethnicity: 'Qaraqalpaqs', lat: 42.40, lon: 59.20 },
    ],
    camera: { position: [6, 10, 6], target: [0, 0, 1] },
    layers: { showBorders: false, showRivers: true, show13thBasin: true, show19thBasin: true, show21stBasin: false, showWaterExtent: true },
    year: 1960,
  },
  {
    id: 4,
    title: 'The Khivan Khan\'s Canals',
    subtitle: '19th Century — Forced Labor & Water Politics',
    description: 'The 19th century saw the Khivan Khanate weaponize water. Thousands of Karakalpaks were sent as forced laborers while Turkmens were cut off from water.',
    canals: [
      { canal: 'Qilichbay arna', otherName: 'Qiliich Niyaz', geography: 'Gurlen', ancientIrrigation: 'No', event: 'Uzbeks. Thousands of Karakalpaks were sent to build it in 1815.', date: '19th cent', ethnicity: 'Uzbeks', lat: 41.56, lon: 60.48 },
      { canal: 'Lawdan', otherName: '', geography: 'Gurlen - Köne Gurganj', ancientIrrigation: 'Yes', event: 'Turkmens cut off from water by the Khivan Khan\'s dam in the 1840s.', date: '19th cent', ethnicity: 'Turkmens', lat: 42.33, lon: 59.15 },
      { canal: 'Shahmurad', otherName: '', geography: 'Gurlen - Köne Gurganj', ancientIrrigation: 'Yes', event: 'Turkmens cut off from water by the Khivan Khan\'s dam in the 1840s.', date: '19th cent', ethnicity: 'Turkmens', lat: 42.30, lon: 59.10 },
      { canal: 'Daryaliq', otherName: 'Kunya Darya', geography: 'Saryqamysh, Köne Gurganj', ancientIrrigation: 'Yes', event: 'The former Amu Darya river towards the Caspian. Inhabited by Yomud Turkmens, but cut off by the Khan.', date: '19th cent', ethnicity: 'Turkmens', lat: 42.00, lon: 57.50 },
      { canal: 'Khanabad Canals', otherName: 'Sapay, Shahmurad Yab', geography: 'Dashawuz', ancientIrrigation: 'Yes', event: 'Karakalpaks sent here annually to build the canals.', date: '19th cent', ethnicity: 'Turkmens', lat: 41.84, lon: 59.97 },
    ],
    camera: { position: [-8, 12, 10], target: [-1, 0, 0] },
    layers: { showBorders: true, showRivers: true, show13thBasin: false, show19thBasin: true, show21stBasin: false, showWaterExtent: true },
    year: 1960,
  },
  {
    id: 5,
    title: 'Late Imperial Resettlement',
    subtitle: '19th–20th Century — Multiethnic Frontiers',
    description: 'Formerly abandoned medieval canal systems were revived. Qazaqs, Qaraqalpaqs, Turkmens, and Uzbeks resettled — including Qazaq refugees fleeing the 1930s famine.',
    canals: [
      { canal: 'Pakhtaarna (Buz Yab/Shuraxan)', otherName: '', geography: 'Beruni', ancientIrrigation: 'Yes', event: 'Part of Medieval Kat canal system. Multiethnic resettlement in late 19th c.', date: '19-20th cent', ethnicity: 'Uzbeks, Qaraqalpaqs, Qazaqs, Turkmens', lat: 41.69, lon: 60.75 },
      { canal: 'Kelteminar Canal', otherName: '', geography: 'Turtkul', ancientIrrigation: 'Yes', event: 'Part of Medieval Gavkhare canal system. Similar multiethnic resettlement pattern.', date: '19-20th cent', ethnicity: 'Uzbeks, Qaraqalpaqs, Qazaqs, Turkmens', lat: 41.55, lon: 60.95 },
    ],
    camera: { position: [4, 8, 14], target: [0, 0, -1] },
    layers: { showBorders: true, showRivers: true, show13thBasin: true, show19thBasin: true, show21stBasin: false, showWaterExtent: true },
    year: 1970,
  },
  {
    id: 6,
    title: 'Soviet-Era Canals',
    subtitle: '20th Century — Industrial Irrigation',
    description: 'The Soviet period brought massive canal construction for cotton. Canals reached Kungrad and Moynaq — infrastructure that would drain the sea.',
    canals: [
      { canal: 'Shumanay Canal', otherName: '', geography: 'Shumanay', ancientIrrigation: 'No', event: 'Historic region of estuary irrigation in the Quygun depression by Qaraqalpaqs.', date: '20th cent', ethnicity: 'Qaraqalpaqs', lat: 42.35, lon: 59.00 },
      { canal: 'Qońírat Canal', otherName: '', geography: 'Kungrad', ancientIrrigation: 'No', event: 'Modern canal to supply Qaraqalpaqs.', date: '20th cent', ethnicity: 'Qaraqalpaqs', lat: 43.00, lon: 58.69 },
      { canal: 'Qonirat-Moynaq Canal', otherName: '', geography: 'Kungrad Moynaq', ancientIrrigation: 'No', event: 'Modern canal to supply Qaraqalpaqs.', date: '20th cent', ethnicity: 'Qaraqalpaqs, Qazaqs', lat: 43.40, lon: 58.69 },
      { canal: 'Qazaqdarya Canal', otherName: '', geography: 'Moynaq', ancientIrrigation: 'No', event: 'Modern canal to supply Qaraqalpaqs.', date: '20th cent', ethnicity: 'Qaraqalpaqs, Qazaqs', lat: 43.77, lon: 58.69 },
    ],
    camera: { position: [0, 18, 2], target: [0, 0, -1] },
    layers: { showBorders: true, showRivers: true, show13thBasin: false, show19thBasin: false, show21stBasin: true, showWaterExtent: true },
    year: 1990,
  },
];
