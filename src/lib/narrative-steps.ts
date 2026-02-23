export interface NarrativeStep {
  id: number;
  title: string;
  text: string;
  year: number;
  camera: { position: [number, number, number]; target: [number, number, number] };
  layers: {
    showBorders: boolean;
    showRivers: boolean;
    show13thBasin: boolean;
    show19thBasin: boolean;
    show21stBasin: boolean;
    showWaterExtent: boolean;
  };
  enabledSeries: string[];
  duration?: number;
}

export const NARRATIVE_STEPS: NarrativeStep[] = [
  {
    id: 1,
    title: 'The Fourth-Largest Lake',
    text: 'In 1960, the Aral Sea was the world\'s fourth-largest lake — 68,000 km² of water sustaining an entire region.',
    year: 1960,
    camera: { position: [18, 16, 18], target: [0, 0, 0] },
    layers: {
      showBorders: true,
      showRivers: true,
      show13thBasin: false,
      show19thBasin: false,
      show21stBasin: false,
      showWaterExtent: true,
    },
    enabledSeries: ['seaLevel', 'volume'],
  },
  {
    id: 2,
    title: 'The Rivers That Fed It',
    text: 'The Amu Darya and Syr Darya rivers delivered ~55 km³ of water annually, following ancient basin paths carved over centuries.',
    year: 1960,
    camera: { position: [5, 8, 15], target: [0, 0, 2] },
    layers: {
      showBorders: false,
      showRivers: true,
      show13thBasin: true,
      show19thBasin: true,
      show21stBasin: false,
      showWaterExtent: true,
    },
    enabledSeries: ['riverInflow'],
  },
  {
    id: 3,
    title: 'The Soviet Cotton Plan',
    text: 'In the 1960s, Soviet planners diverted river water to irrigate cotton fields. By 1970, inflow had dropped dramatically.',
    year: 1970,
    camera: { position: [-10, 14, 16], target: [0, 0, 0] },
    layers: {
      showBorders: false,
      showRivers: true,
      show13thBasin: false,
      show19thBasin: false,
      show21stBasin: false,
      showWaterExtent: true,
    },
    enabledSeries: ['cottonHarvest', 'irrigatedArea', 'riverInflow'],
  },
  {
    id: 4,
    title: 'The Shrinking Begins',
    text: 'By 1990, the sea had lost 60% of its volume. Salinity tripled, devastating fisheries and ecosystems.',
    year: 1990,
    camera: { position: [3, 6, 8], target: [0, 0, -1] },
    layers: {
      showBorders: true,
      showRivers: true,
      show13thBasin: false,
      show19thBasin: false,
      show21stBasin: false,
      showWaterExtent: true,
    },
    enabledSeries: ['seaLevel', 'volume', 'salinity'],
  },
  {
    id: 5,
    title: 'The Sea Splits',
    text: 'By 2005, the Aral Sea had split into separate bodies. The Eastern basin was nearly gone.',
    year: 2005,
    camera: { position: [0, 18, 2], target: [0, 0, -1] },
    layers: {
      showBorders: true,
      showRivers: false,
      show13thBasin: false,
      show19thBasin: false,
      show21stBasin: true,
      showWaterExtent: true,
    },
    enabledSeries: ['seaLevel', 'volume'],
  },
  {
    id: 6,
    title: 'Climate Consequences',
    text: 'The exposed seabed became a source of toxic dust storms. Regional temperatures shifted, rainfall patterns changed.',
    year: 2015,
    camera: { position: [-6, 8, 10], target: [0, 0, -1] },
    layers: {
      showBorders: false,
      showRivers: false,
      show13thBasin: false,
      show19thBasin: false,
      show21stBasin: false,
      showWaterExtent: true,
    },
    enabledSeries: ['tempAnomaly', 'salinity'],
  },
  {
    id: 7,
    title: 'The Aral Sea Today',
    text: 'Today, only fragments remain. The Northern Aral has partially recovered thanks to the Kok-Aral Dam, but the Southern basin continues to shrink.',
    year: 2024,
    camera: { position: [0, 10, 12], target: [0, 0, -1] },
    layers: {
      showBorders: true,
      showRivers: true,
      show13thBasin: true,
      show19thBasin: true,
      show21stBasin: true,
      showWaterExtent: true,
    },
    enabledSeries: ['seaLevel', 'volume', 'salinity', 'riverInflow'],
  },
];
