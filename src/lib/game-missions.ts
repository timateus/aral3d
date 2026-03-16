import { TerrainData } from '@/lib/geotiff-loader';

export interface Mission {
  id: string;
  level: number;
  title: string;
  description: string;
  hint: string;
  targetLat: number;
  targetLon: number;
  radius: number;
  validate?: (terrain: TerrainData, avatarWorldX: number, avatarWorldZ: number) => boolean;
  reward: string;
  emoji: string;
  funFact: string;
  requiresWater?: boolean;
  requiresKhorezm?: boolean;
  requiresInspector?: boolean;
}

export function findHighestPoint(terrain: TerrainData): { lat: number; lon: number; elev: number } {
  const { elevations, width, height, bounds, noDataValue } = terrain;
  if (!bounds) return { lat: 0, lon: 0, elev: 0 };

  let maxElev = -Infinity;
  let maxIdx = 0;
  for (let i = 0; i < elevations.length; i++) {
    const e = elevations[i];
    if (noDataValue !== null && e === noDataValue) continue;
    if (isNaN(e)) continue;
    if (e > maxElev) {
      maxElev = e;
      maxIdx = i;
    }
  }

  const row = Math.floor(maxIdx / width);
  const col = maxIdx % width;
  const nx = col / (width - 1);
  const ny = 1 - row / (height - 1);
  const lat = bounds.minLat + ny * (bounds.maxLat - bounds.minLat);
  const lon = bounds.minLon + nx * (bounds.maxLon - bounds.minLon);

  return { lat, lon, elev: maxElev };
}

export function buildMissions(terrain: TerrainData): Mission[] {
  const highest = findHighestPoint(terrain);

  return [
    {
      id: 'mission-1',
      level: 1,
      title: 'Welcome to Nukus',
      description: 'Travel to the capital city of Karakalpakstan.',
      hint: 'Head towards the center of the map — look for the river bend.',
      targetLat: 42.46,
      targetLon: 59.6,
      radius: 0.4,
      reward: '🏙️ Welcome to Nukus!',
      emoji: '🏙️',
      funFact: 'Nukus is home to the Savitsky Museum, which houses one of the world\'s largest collections of banned Soviet avant-garde art — rescued from destruction by Igor Savitsky.',
    },
    {
      id: 'mission-2',
      level: 2,
      title: 'Reach the Summit',
      description: 'Find the highest point in the region.',
      hint: `Head towards elevation ${Math.round(highest.elev)}m — the tallest peak on the map!`,
      targetLat: highest.lat,
      targetLon: highest.lon,
      radius: 0.5,
      reward: '🏔️ Summit conquered!',
      emoji: '🏔️',
      funFact: `At ${Math.round(highest.elev)}m, this is the highest point in the dataset. The Ustyurt Plateau to the west of the Aral Sea rises to over 300m and was once an ancient seabed itself.`,
    },
    {
      id: 'mission-3',
      level: 3,
      title: 'Ghost Port of Muynak',
      description: 'Visit the former fishing harbor of Muynak.',
      hint: 'Head northwest — Muynak once sat on the Aral Sea coast.',
      targetLat: 43.77,
      targetLon: 58.69,
      radius: 0.4,
      reward: '⚓ You found Muynak!',
      emoji: '⚓',
      funFact: 'In the 1960s, Muynak was a thriving fishing port producing 1/6 of the Soviet fish catch. Today, rusting ship hulls sit in the desert over 100 km from the nearest water.',
    },
    {
      id: 'mission-4',
      level: 4,
      title: 'The Aral Shore',
      description: 'Reach the former northern coastline of the Aral Sea.',
      hint: 'Head far north toward the dried basin edge.',
      targetLat: 44.5,
      targetLon: 58.8,
      radius: 0.5,
      reward: '🏖️ You stand where waves once crashed.',
      emoji: '🏖️',
      funFact: 'The Aral Sea was once the 4th largest lake in the world at 68,000 km². By 2014, its eastern basin had completely dried up for the first time in 600 years.',
    },
    {
      id: 'mission-5',
      level: 5,
      title: 'Into the Depths',
      description: 'Find the deepest point of the old seabed — around -8m elevation.',
      hint: 'The deepest point is at 45.1°N, 58.5°E — in the western basin of the former Aral Sea.',
      targetLat: 45.1098,
      targetLon: 58.4530,
      radius: 0.6,
      reward: '🕳️ Seabed discovered!',
      emoji: '🕳️',
      requiresInspector: true,
      funFact: 'The deepest point of the former Aral Sea reached about 68 meters below the original surface level. The exposed seabed has become a source of toxic dust storms carrying salt and pesticides across the region.',
    },
    {
      id: 'mission-6',
      level: 6,
      title: 'Amu Darya Delta',
      description: 'Explore the river delta where the Amu Darya once fed the Aral Sea.',
      hint: 'Follow the river north from Nukus toward the old shoreline.',
      targetLat: 43.3,
      targetLon: 58.9,
      radius: 0.5,
      reward: '🌿 Delta explored!',
      emoji: '🌿',
      funFact: 'The Amu Darya delta once supported 500,000 hectares of wetlands and reed beds. Today, less than 10% remains. The delta\'s lakes were critical breeding grounds for dozens of fish and bird species.',
    },
    {
      id: 'mission-7',
      level: 7,
      title: 'Cotton Kingdom',
      description: 'Visit the irrigated farmlands southeast of Nukus — explore Khorezm.',
      hint: 'Head southeast — the flat lands along the river are intensively farmed.',
      targetLat: 41.8,
      targetLon: 60.2,
      radius: 0.5,
      requiresKhorezm: true,
      reward: '🌾 Welcome to the cotton belt!',
      emoji: '🌾',
      funFact: 'Soviet planners diverted the Amu Darya and Syr Darya rivers to irrigate 7 million hectares of cotton. Uzbekistan became the world\'s 5th largest cotton producer — but at the cost of the Aral Sea.',
    },
    {
      id: 'mission-8',
      level: 8,
      title: 'Kungrad Junction',
      description: 'Find the industrial city of Kungrad, a key railway hub.',
      hint: 'Head north from Nukus — Kungrad sits on the rail line to the Aral coast.',
      targetLat: 43.0,
      targetLon: 58.7,
      radius: 0.4,
      reward: '🚂 Kungrad reached!',
      emoji: '🚂',
      funFact: 'Kungrad is a key junction on the railway that once connected Aral Sea ports to the rest of the Soviet Union. The city has a large chemical plant that processes sodium sulfate from the dried seabed.',
    },
    {
      id: 'mission-9',
      level: 9,
      title: 'Edge of the Ustyurt',
      description: 'Reach the western plateau cliffs — the Ustyurt Plateau edge.',
      hint: 'Head far west to find the steep cliffs of the plateau.',
      targetLat: 43.5,
      targetLon: 57.5,
      radius: 0.5,
      reward: '🏜️ Standing on the Ustyurt!',
      emoji: '🏜️',
      funFact: 'The Ustyurt Plateau is an ancient limestone tableland that extends between the Caspian and Aral Seas. Its dramatic "chink" (cliff edges) drop 100-200m and harbor rare species including the Ustyurt mouflon.',
    },
    {
      id: 'mission-10',
      level: 10,
      title: 'Salt Flats',
      description: 'Explore the exposed salt flats of the eastern Aral basin.',
      hint: 'Head northeast — the vast white salt plains stretch for miles.',
      targetLat: 44.8,
      targetLon: 59.5,
      radius: 0.5,
      requiresInspector: true,
      reward: '🧂 The white desert!',
      emoji: '🧂',
      funFact: 'The Aralkum — the desert that replaced the Aral Sea — is one of the youngest deserts on Earth. Wind carries an estimated 75 million tons of toxic salt and dust from the dried seabed each year, contaminating farmland up to 500 km away.',
    },
    {
      id: 'mission-11',
      level: 11,
      title: 'Health Crisis Zone',
      description: 'Visit the region most affected by the ecological disaster.',
      hint: 'The communities near the former shoreline suffer the most.',
      targetLat: 43.4,
      targetLon: 58.3,
      radius: 0.5,
      reward: '🏥 A sobering discovery.',
      emoji: '🏥',
      funFact: 'Karakalpakstan has some of the highest rates of throat cancer, anemia, and kidney disease in the world. Infant mortality is 5x the European average. Pesticides from cotton farming accumulated in the seabed and are now airborne.',
    },
    {
      id: 'mission-12',
      level: 12,
      title: 'The Exodus',
      description: 'Visit the area where most young people leave for work.',
      hint: 'Southern Karakalpakstan — economic hardship drives out-migration.',
      targetLat: 42.1,
      targetLon: 59.2,
      radius: 0.5,
      reward: '✈️ Stories of migration.',
      emoji: '✈️',
      funFact: 'Over 30% of working-age adults in Karakalpakstan migrate seasonally to Kazakhstan and Russia for work. Many villages are left with only the elderly and children. Remittances make up a significant share of household income.',
    },
    {
      id: 'mission-13',
      level: 13,
      title: 'Gas Fields',
      description: 'Find the natural gas extraction area on the Ustyurt.',
      hint: 'The western plateau holds significant gas reserves.',
      targetLat: 43.8,
      targetLon: 57.8,
      radius: 0.5,
      reward: '⛽ Gas fields found!',
      emoji: '⛽',
      funFact: 'The Ustyurt Plateau contains the Surgil gas field, one of Central Asia\'s largest. A $4 billion processing plant was built here. Ironically, the region with destroyed water resources now exports fossil fuels.',
    },
    {
      id: 'mission-14',
      level: 14,
      title: 'Kok-Aral Dam',
      description: 'Find where the dam was built to save the North Aral Sea.',
      hint: 'The dam sits between the North and South Aral basins.',
      targetLat: 45.0,
      targetLon: 60.0,
      radius: 0.6,
      reward: '🔧 Dam site located!',
      emoji: '🔧',
      funFact: 'Built in 2005 with World Bank funding, the Kok-Aral Dam separated the North Aral from the South. Within 2 years, water levels rose 4 meters, salinity dropped from 30 to 8 g/L, and fish returned. It\'s one of the few environmental success stories.',
    },
    {
      id: 'mission-15',
      level: 15,
      title: 'Water Bringer',
      description: 'Pour water at the deepest basin to symbolically refill the Aral Sea!',
      hint: 'Go to the deepest point and hold SPACE to pour water.',
      targetLat: 45.1098,
      targetLon: 58.4530,
      radius: 0.6,
      requiresWater: true,
      reward: '💧 The waters return! You brought life back.',
      emoji: '💧',
      funFact: 'Complete restoration of the Aral Sea would require approximately 600 km³ of water — equivalent to the annual flow of the Amazon River for 3 days. While the South Aral may never fully recover, reforestation of the dried seabed with saxaul trees is helping stabilize the desert.',
    },
  ];
}
