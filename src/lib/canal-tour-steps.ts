export interface CanalEntry {
  canal: string;
  otherName: string;
  geography: string;
  ancientIrrigation: string;
  event: string;
  date: string;
  ethnicity: string;
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
    description: 'The earliest canals followed the shifting paths of the Amu Darya. Qaraqalpaqs practiced semi-nomadic livelihoods along these ancient floodplains — grazing upstream in summer, fishing downstream in winter.',
    canals: [
      { canal: 'Kegeyli Canal', otherName: 'Kerder', geography: 'Nukus-Kegeyli-Chimbay', ancientIrrigation: 'Yes - was Amu Darya', event: 'An ancient riverbank revived as a canal when the Amu Darya shifted westwards in the 9th century. Mangit and On Tort Uriw Qaraqalpaqs settled along the canal as refugees and captives during the 17-18th centuries.', date: '17-18 cent', ethnicity: 'Qaraqalpaqs' },
      { canal: 'Qizketken Canal', otherName: 'Kok Ózák, Dosliq', geography: 'Kokuzak, Nukus, Tawkara', ancientIrrigation: 'Yes - was Amu Darya', event: 'A floodplain where Qaraqalpaqs conducted semi-nomadic livelihoods. Mixed use: grazing, farming, fishing and foraging.', date: '17th cent', ethnicity: 'Qaraqalpaqs' },
      { canal: 'Kók uzak', otherName: 'Qizketken, Dosliq', geography: 'Kokuzak, Nukus, Tawkara', ancientIrrigation: 'Yes - was Amu Darya', event: 'A floodplain where Qaraqalpaqs conducted semi-nomadic livelihoods.', date: '17th cent', ethnicity: 'Qaraqalpaqs' },
      { canal: 'Aq yaqish', otherName: '', geography: 'Tawkara', ancientIrrigation: 'Yes - was Amu Darya', event: 'Part of the Qaraqalpaq floodplain system for mixed pastoral and agricultural use.', date: '17th cent', ethnicity: 'Qaraqalpaqs' },
    ],
    camera: { position: [2, 8, 10], target: [0, 0, 1] },
    layers: { showBorders: true, showRivers: true, show13thBasin: true, show19thBasin: false, show21stBasin: false, showWaterExtent: true },
    year: 1960,
  },
  {
    id: 2,
    title: 'Khorezm Canal Settlements',
    subtitle: '17th Century — Uzbek & Turkmen Territories',
    description: 'The Khorezmian heartland was divided by its canals: Uzbeks occupied the fertile upper reaches while Turkmens were settled at the canal ends, often in less productive land.',
    canals: [
      { canal: 'Shavat Canal', otherName: 'Vadak', geography: 'Honqa Urgench', ancientIrrigation: 'Possibly (Dawdan canal)', event: 'Xorezmians on the best land and Turkmens at the ends of the canals.', date: '17th cent', ethnicity: 'Uzbeks' },
      { canal: 'Yarmish', otherName: 'Buve', geography: 'Katqala', ancientIrrigation: 'Possibly (Buve canal)', event: 'Xorezmians on the best land and Turkmens at the ends of the canals.', date: '17th cent', ethnicity: 'Uzbeks' },
      { canal: 'Xorasan (Pahlavan) Canal', otherName: 'Heykanik', geography: 'Xiva', ancientIrrigation: 'Yes', event: 'Xorezmians on the best land and Turkmens at the ends of the canals.', date: '17th cent', ethnicity: 'Uzbeks' },
      { canal: 'Ataliq Arna', otherName: 'Mangit arna', geography: 'Mangit', ancientIrrigation: 'No', event: 'The frontier city of the Uzbek territory of Khorezm, included Manghit Qaraqalpaqs.', date: '17th cent', ethnicity: 'Uzbeks, Qaraqalpaqs' },
      { canal: 'Sevgenli', otherName: 'Leninabad, Sowyet Yab', geography: 'Khojaeli', ancientIrrigation: 'No', event: 'For irrigation of lands of the Uzbeks and Qaraqalpaqs of the Khojaeli tribe.', date: '17th cent', ethnicity: 'Qaraqalpaqs, Uzbeks' },
    ],
    camera: { position: [-5, 6, 8], target: [-1, 0, 2] },
    layers: { showBorders: true, showRivers: true, show13thBasin: false, show19thBasin: true, show21stBasin: false, showWaterExtent: true },
    year: 1960,
  },
  {
    id: 3,
    title: '18th Century Expansion',
    subtitle: 'Qaraqalpaqs & Turkmens Push Northward',
    description: 'New canals extended irrigation into previously unfarmed territory. The Ghazavat Canal was built to encourage Turkmen sedentary life, while Qaraqalpaqs built the Esim Kanal to irrigate upstream pastures.',
    canals: [
      { canal: 'Quwanishjarma', otherName: '', geography: 'Chimbay, Qarauzak', ancientIrrigation: 'No', event: 'Named after a Qaraqalpaq Quwanish. An extension of the Kok Uzak.', date: '18th cent', ethnicity: 'Qaraqalpaqs' },
      { canal: 'Ghazavat Canal', otherName: '', geography: "Qo'shko'pir", ancientIrrigation: 'No', event: 'Built in the 17th cent. Turkmens were settled here in the 18th century to encourage their loyalty and sedentary life.', date: '18th cent', ethnicity: 'Turkmens' },
      { canal: 'Esim Kanal', otherName: '', geography: 'Qaraózek, Tawkara', ancientIrrigation: 'No', event: 'Built in 1715 by the Karakalpaks to irrigate upstream pastures.', date: '18th cent', ethnicity: 'Qaraqalpaqs' },
    ],
    camera: { position: [6, 10, 6], target: [0, 0, 1] },
    layers: { showBorders: false, showRivers: true, show13thBasin: true, show19thBasin: true, show21stBasin: false, showWaterExtent: true },
    year: 1960,
  },
  {
    id: 4,
    title: 'The Khivan Khan\'s Canals',
    subtitle: '19th Century — Forced Labor & Water Politics',
    description: 'The 19th century saw the Khivan Khanate weaponize water. Thousands of Karakalpaks were sent as forced laborers to build canals, while Turkmens were cut off from water by deliberate damming — an early form of hydraulic power.',
    canals: [
      { canal: 'Qilichbay arna', otherName: 'Qiliich Niyaz', geography: 'Gurlen', ancientIrrigation: 'No', event: 'Uzbeks. Thousands of Karakalpaks were sent to build it in 1815. Jamshidi Persians resettled in the 1840s.', date: '19th cent', ethnicity: 'Uzbeks' },
      { canal: 'Lawdan', otherName: '', geography: 'Gurlen - Köne Gurganj', ancientIrrigation: 'Yes', event: 'Named after a Karakalpak, Lawsan. Turkmens in the region were cut off from the water by the Khivan Khan when he built a dam in the 1840s.', date: '19th cent', ethnicity: 'Turkmens' },
      { canal: 'Shahmurad', otherName: '', geography: 'Gurlen - Köne Gurganj', ancientIrrigation: 'Yes', event: 'Turkmens cut off from water by the Khivan Khan\'s dam in the 1840s.', date: '19th cent', ethnicity: 'Turkmens' },
      { canal: 'Daryaliq', otherName: 'Kunya Darya', geography: 'Saryqamysh, Köne Gurganj', ancientIrrigation: 'Yes', event: 'The former Amu Darya river towards the Caspian. Inhabited by Yomud Turkmens, but cut off by the Khan.', date: '19th cent', ethnicity: 'Turkmens' },
      { canal: 'Khanabad Canals', otherName: 'Sapay, Shahmurad Yab', geography: 'Dashawuz', ancientIrrigation: 'Yes', event: 'Karakalpaks were sent here annually to build the canals. Turkmen inhabited the region.', date: '19th cent', ethnicity: 'Turkmens' },
    ],
    camera: { position: [-8, 12, 10], target: [-1, 0, 0] },
    layers: { showBorders: true, showRivers: true, show13thBasin: false, show19thBasin: true, show21stBasin: false, showWaterExtent: true },
    year: 1960,
  },
  {
    id: 5,
    title: 'Late Imperial Resettlement',
    subtitle: '19th–20th Century — Multiethnic Frontiers',
    description: 'As the Russian Empire expanded, formerly abandoned medieval canal systems were revived. Qazaqs, Qaraqalpaqs, Turkmens, and Uzbeks resettled along these canals — including Qazaq refugees fleeing the 1930s famine.',
    canals: [
      { canal: 'Pakhtaarna (Buz Yab/Shuraxan)', otherName: '', geography: 'Beruni', ancientIrrigation: 'Yes', event: 'Part of Medieval Kat canal system. Area resettled in the late 19th c. by Qazaqs, Qaraqalpaqs and Turkmens. During the 1930s, Qazaq refugees came here. Uzbeks came during canal expansion in the 1950s.', date: '19-20th cent', ethnicity: 'Uzbeks, Qaraqalpaqs, Qazaqs, Turkmens' },
      { canal: 'Kelteminar Canal', otherName: '', geography: 'Turtkul', ancientIrrigation: 'Yes', event: 'Part of Medieval Gavkhare canal system. Similar multiethnic resettlement pattern.', date: '19-20th cent', ethnicity: 'Uzbeks, Qaraqalpaqs, Qazaqs, Turkmens' },
    ],
    camera: { position: [4, 8, 14], target: [0, 0, -1] },
    layers: { showBorders: true, showRivers: true, show13thBasin: true, show19thBasin: true, show21stBasin: false, showWaterExtent: true },
    year: 1970,
  },
  {
    id: 6,
    title: 'Soviet-Era Canals',
    subtitle: '20th Century — Industrial Irrigation',
    description: 'The Soviet period brought massive canal construction to supply the growing cotton industry. Modern canals reached Kungrad and even Moynaq at the Aral Sea\'s edge — infrastructure that would ultimately drain the sea.',
    canals: [
      { canal: 'Shumanay Canal', otherName: '', geography: 'Shumanay', ancientIrrigation: 'No', event: 'A historic region of estuary irrigation in the swampy Quygun depression by Qaraqalpaqs. The canal was built recently.', date: '20th cent', ethnicity: 'Qaraqalpaqs' },
      { canal: 'Qońírat Canal', otherName: '', geography: 'Kungrad', ancientIrrigation: 'No', event: 'Modern canal to supply Qaraqalpaqs.', date: '20th cent', ethnicity: 'Qaraqalpaqs' },
      { canal: 'Qonirat-Moynaq Canal', otherName: '', geography: 'Kungrad Moynaq', ancientIrrigation: 'No', event: 'Modern canal to supply Qaraqalpaqs.', date: '20th cent', ethnicity: 'Qaraqalpaqs, Qazaqs' },
      { canal: 'Qazaqdarya Canal', otherName: '', geography: 'Moynaq', ancientIrrigation: 'No', event: 'Modern canal to supply Qaraqalpaqs.', date: '20th cent', ethnicity: 'Qaraqalpaqs, Qazaqs' },
    ],
    camera: { position: [0, 18, 2], target: [0, 0, -1] },
    layers: { showBorders: true, showRivers: true, show13thBasin: false, show19thBasin: false, show21stBasin: true, showWaterExtent: true },
    year: 1990,
  },
];
