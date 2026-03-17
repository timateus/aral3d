export interface AgmarProposalSite {
  name: string;
  lat: number;
  lon: number;
  description: string;
}

export interface AgmarTourStep {
  id: number;
  title: string;
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
  };
  year: number;
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
    title: 'Implementing Ag-MAR in Karakalpakstan',
    text: 'Agricultural Managed Aquifer Recharge (Ag-MAR) is a nature-based strategy to bank excess winter river flows underground — replenishing aquifers, desalinating soils, and securing water for summer crops.',
    camera: { position: [0, 18, 16], target: [0, 0, 0] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: false },
    year: 2024,
  },
  {
    id: 2,
    title: 'The Challenge — Why Now?',
    text: 'Karakalpakstan faces acute water scarcity: the Amu Darya delivers less water each decade, soils are increasingly salinized, and climate change intensifies droughts. Over 1.8 million people depend on irrigated agriculture in a region where groundwater is often too salty to use.',
    camera: { position: [-4, 12, 10], target: [-2, 0, -2] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: false },
    year: 2020,
  },
  {
    id: 3,
    title: 'The Mechanics — Infiltration & Recharge',
    text: 'Ag-MAR uses infiltration basins and fields to spread excess canal water during winter months. Water percolates through the soil, recharging the shallow aquifer. This stored water becomes available during the dry growing season — a natural underground reservoir.',
    camera: { position: [-6, 8, 6], target: [-3, 0, -1] },
    layers: { showBorders: false, showRivers: true, showWaterExtent: true, showKhorezm: true },
    year: 2024,
  },
  {
    id: 4,
    title: 'Ag-MAR: How It Works',
    text: 'During winter, surplus canal flows are diverted onto agricultural fields via check-dams and spreader canals. Water slowly infiltrates, pushing saline groundwater deeper and replacing it with fresh recharge. IoT sensors monitor soil moisture, salinity, and water table levels in real time.',
    camera: { position: [-3, 10, 8], target: [-1, 0, -2] },
    layers: { showBorders: false, showRivers: true, showWaterExtent: true, showKhorezm: true },
    year: 2024,
  },
  {
    id: 5,
    title: 'Core Questions',
    text: 'Can Ag-MAR scale in Karakalpakstan\'s flat, clay-heavy soils? Who are the key stakeholders — farmers, water user associations, government? Can desalinated fields support salt-tolerant crops like mungbean during transition years?',
    camera: { position: [2, 10, 10], target: [0, 0, -1] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: true },
    year: 2024,
  },
  {
    id: 6,
    title: 'Steps of Implementation',
    text: '1) Site selection using soil permeability and canal proximity data. 2) Pilot infrastructure — check-dams, spreader canals, monitoring wells. 3) IoT deployment for real-time aquifer tracking. 4) Community training and water user association engagement. 5) Scaling based on results.',
    camera: { position: [0, 14, 12], target: [0, 0, 0] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: true },
    year: 2024,
  },
  {
    id: 7,
    title: 'Proposal Sites',
    text: 'Two pilot locations have been identified: Karauzyak district (downstream Amu Darya, high water table) and Taxtakupir district (canal-fed zone with severe salinity). These sites offer the best conditions for testing Ag-MAR at scale in Karakalpakstan.',
    camera: { position: [-2, 10, 8], target: [-1, 0, -1] },
    layers: { showBorders: true, showRivers: true, showWaterExtent: true, showKhorezm: true },
    year: 2024,
    proposalSites: AGMAR_PROPOSAL_SITES,
  },
];
