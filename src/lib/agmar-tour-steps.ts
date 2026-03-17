export interface AgmarProposalSite {
  name: string;
  lat: number;
  lon: number;
  description: string;
}

export interface AgmarTourStep {
  id: number;
  title: string;
  subtitle: string;
  text: string;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  layers: {
    showBorders: boolean;
    showRivers: boolean;
    showWaterExtent: boolean;
    showKhorezm: boolean;
    showLandcover: boolean;
    showChoropleth: boolean;
    choroplethIndicator?: string;
  };
  year: number;
  /** If set, animate year from this value to `year` over step duration */
  animateYearFrom?: number;
  /** Enabled series keys to show in the 3D metrics overlay */
  enabledSeries?: string[];
  proposalSites?: AgmarProposalSite[];
}

export const AGMAR_PROPOSAL_SITES: AgmarProposalSite[] = [
  {
    name: 'Karauzyak',
    lat: 42.1,
    lon: 58.7,
    description: 'Proposed Ag-MAR pilot site — downstream Amu Darya, high water table potential',
  },
  {
    name: 'Taxtakupir',
    lat: 42.5,
    lon: 59.0,
    description: 'Proposed Ag-MAR pilot site — canal-fed agriculture zone with saline soils',
  },
];

export const AGMAR_TOUR_STEPS: AgmarTourStep[] = [
  {
    id: 1,
    title: 'Water Scarcity',
    subtitle: 'The Disappearing Sea',
    text: 'The Aral Sea was the world\'s fourth-largest lake. Since 1960, over 90% of its water has vanished — watch it shrink in real time.',
    camera: { position: [0, 18, 16], target: [0, 0, 0] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: false, showLandcover: false, showChoropleth: false },
    year: 2015,
    animateYearFrom: 1960,
    enabledSeries: ['seaLevel', 'volume', 'surfaceArea'],
  },
  {
    id: 2,
    title: 'Soil Degradation',
    subtitle: 'Salinized & Barren Landscapes',
    text: 'The exposed seabed and over-irrigated farmland have left vast areas salinized. Salt-tolerant scrubland now dominates where cotton fields once thrived.',
    camera: { position: [-4, 10, 8], target: [-2, 0, -2] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: true, showLandcover: true, showChoropleth: false },
    year: 2015,
  },
  {
    id: 3,
    title: 'Climate Change',
    subtitle: 'Rising Temperatures, Shifting Rainfall',
    text: 'Regional temperatures have risen steadily since the 1990s. The loss of the Aral Sea\'s moderating effect has intensified summers and destabilized precipitation patterns.',
    camera: { position: [2, 12, 10], target: [0, 0, -1] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: false, showLandcover: false, showChoropleth: false },
    year: 2024,
    animateYearFrom: 1996,
    enabledSeries: ['tempAnomaly'],
  },
  {
    id: 4,
    title: 'What is Ag-MAR?',
    subtitle: 'Agricultural Managed Aquifer Recharge',
    text: 'Ag-MAR is a nature-based strategy to bank excess winter river flows underground — replenishing aquifers, desalinating soils, and securing water for summer crops.',
    camera: { position: [-3, 10, 8], target: [-1, 0, -2] },
    layers: { showBorders: false, showRivers: true, showWaterExtent: true, showKhorezm: true, showLandcover: false, showChoropleth: false },
    year: 2024,
  },
  {
    id: 5,
    title: 'How It Works',
    subtitle: 'Infiltration, Recharge & Monitoring',
    text: 'During winter, surplus canal flows are diverted onto fields via check-dams and spreader canals. Water percolates through the soil, pushing saline groundwater deeper. IoT sensors monitor moisture, salinity, and water table levels in real time.',
    camera: { position: [-6, 8, 6], target: [-3, 0, -1] },
    layers: { showBorders: false, showRivers: true, showWaterExtent: true, showKhorezm: true, showLandcover: false, showChoropleth: false },
    year: 2024,
  },
  {
    id: 6,
    title: 'Implementation',
    subtitle: 'From Pilot to Scale',
    text: '1) Site selection using soil permeability and canal proximity data. 2) Pilot infrastructure — check-dams, spreader canals, monitoring wells. 3) IoT deployment. 4) Community training and water user association engagement. 5) Scaling based on results.',
    camera: { position: [0, 14, 12], target: [0, 0, 0] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: true, showLandcover: false, showChoropleth: false },
    year: 2024,
  },
  {
    id: 7,
    title: 'Proposal Sites',
    subtitle: 'Karauzyak & Taxtakupir Districts',
    text: 'Two pilot locations identified: Karauzyak (downstream Amu Darya, high water table) and Taxtakupir (canal-fed zone with severe salinity). These offer the best conditions for testing Ag-MAR at scale.',
    camera: { position: [-2, 10, 8], target: [-1, 0, -1] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: true, showLandcover: false, showChoropleth: false },
    year: 2024,
    proposalSites: AGMAR_PROPOSAL_SITES,
  },
];
