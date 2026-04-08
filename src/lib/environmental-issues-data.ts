/**
 * Environmental & health issues data for the Aral Sea region.
 * Each issue has a location, category, and values that interpolate
 * between pre-crisis (before 1960) and current (2024) conditions.
 */

export interface EnvironmentalIssue {
  id: string;
  category: string;
  emoji: string;
  location: string;
  lat: number;
  lon: number;
  /** Value in 1960 (0–1 severity scale, 0 = no issue) */
  severity1960: number;
  /** Value in 2024 (0–1 severity scale, 1 = critical) */
  severity2024: number;
  descBefore: string;
  descAfter: string;
  impactLevel: 'critical' | 'high' | 'medium';
}

export const ENVIRONMENTAL_ISSUES: EnvironmentalIssue[] = [
  // Water
  {
    id: 'salinity-muynak',
    category: 'Water Salinity',
    emoji: '🧂',
    location: 'Muynak',
    lat: 43.77, lon: 58.69,
    severity1960: 0.05,
    severity2024: 0.95,
    descBefore: '~500 mg/L TDS',
    descAfter: '3,852 mg/L TDS (7× WHO limit)',
    impactLevel: 'critical',
  },
  {
    id: 'drinking-water-nukus',
    category: 'Drinking Water',
    emoji: '💧',
    location: 'Nukus',
    lat: 42.46, lon: 59.60,
    severity1960: 0.02,
    severity2024: 0.9,
    descBefore: 'Clean river water',
    descAfter: '100% pesticide contamination',
    impactLevel: 'critical',
  },
  {
    id: 'water-infra-kungrad',
    category: 'Water Infrastructure',
    emoji: '🚰',
    location: 'Kungrad',
    lat: 43.00, lon: 58.69,
    severity1960: 0.1,
    severity2024: 0.7,
    descBefore: 'River dependence',
    descAfter: '~40% centralized clean water access',
    impactLevel: 'high',
  },
  // Health
  {
    id: 'health-karakalpakstan',
    category: 'Public Health',
    emoji: '🏥',
    location: 'Karakalpakstan',
    lat: 42.80, lon: 59.60,
    severity1960: 0.05,
    severity2024: 0.92,
    descBefore: 'Low chronic disease burden',
    descAfter: 'High anemia, kidney, respiratory, cancer',
    impactLevel: 'critical',
  },
  {
    id: 'children-takhtakupir',
    category: 'Child Health',
    emoji: '👶',
    location: 'Takhtakupir',
    lat: 42.50, lon: 58.75,
    severity1960: 0.03,
    severity2024: 0.88,
    descBefore: 'Normal child health',
    descAfter: 'Congenital issues, immune disorders',
    impactLevel: 'critical',
  },
  // Environment
  {
    id: 'dust-aralkum',
    category: 'Toxic Dust',
    emoji: '🌬',
    location: 'Aralkum Desert',
    lat: 44.50, lon: 59.00,
    severity1960: 0.0,
    severity2024: 0.85,
    descBefore: 'Sea floor, no dust',
    descAfter: 'Toxic dust storms up to 500 km',
    impactLevel: 'high',
  },
  {
    id: 'soil-khorezm',
    category: 'Soil Quality',
    emoji: '🌱',
    location: 'Khorezm',
    lat: 41.55, lon: 60.63,
    severity1960: 0.05,
    severity2024: 0.78,
    descBefore: 'Fertile, balanced salinity',
    descAfter: '>50% saline soils, pesticide residues',
    impactLevel: 'critical',
  },
  {
    id: 'pesticide-turtkul',
    category: 'Pesticide Exposure',
    emoji: '☣️',
    location: 'Turtkul',
    lat: 41.55, lon: 60.95,
    severity1960: 0.0,
    severity2024: 0.9,
    descBefore: 'Near zero pesticides',
    descAfter: '90% exceed safety levels for HCH/DDE',
    impactLevel: 'critical',
  },
  {
    id: 'ecosystem-aral',
    category: 'Ecosystem',
    emoji: '🌍',
    location: 'Aral Sea (center)',
    lat: 45.0, lon: 59.5,
    severity1960: 0.0,
    severity2024: 1.0,
    descBefore: 'World\'s 4th largest lake',
    descAfter: 'Ecological collapse, desertification',
    impactLevel: 'critical',
  },
  {
    id: 'agriculture-bukhara',
    category: 'Agriculture',
    emoji: '🌾',
    location: 'Bukhara',
    lat: 39.77, lon: 64.42,
    severity1960: 0.05,
    severity2024: 0.65,
    descBefore: 'Sustainable agriculture',
    descAfter: 'Declining productivity, salinity',
    impactLevel: 'high',
  },
  {
    id: 'climate-aral-south',
    category: 'Climate',
    emoji: '🌡',
    location: 'South Aral',
    lat: 44.0, lon: 58.5,
    severity1960: 0.02,
    severity2024: 0.72,
    descBefore: 'Stable regional climate',
    descAfter: 'Increased aridity, extreme conditions',
    impactLevel: 'high',
  },
  {
    id: 'economy-navoi',
    category: 'Economic Impact',
    emoji: '📉',
    location: 'Navoi',
    lat: 40.10, lon: 65.38,
    severity1960: 0.02,
    severity2024: 0.6,
    descBefore: 'Stable workforce',
    descAfter: 'Reduced productivity, illness, disability',
    impactLevel: 'high',
  },
];

/** Interpolate severity for a given year (linear 1960–2024) */
export function getSeverityAtYear(issue: EnvironmentalIssue, year: number): number {
  if (year <= 1960) return issue.severity1960;
  if (year >= 2024) return issue.severity2024;
  const t = (year - 1960) / (2024 - 1960);
  // Use ease-in curve: most damage accelerated after 1970s
  const curved = t * t;
  return issue.severity1960 + (issue.severity2024 - issue.severity1960) * curved;
}

/** Map severity (0–1) to a color from green → yellow → red */
export function severityColor(severity: number): string {
  const s = Math.max(0, Math.min(1, severity));
  if (s < 0.5) {
    // green → yellow
    const t = s / 0.5;
    const r = Math.round(50 + 205 * t);
    const g = Math.round(200 - 50 * t);
    const b = Math.round(50 * (1 - t));
    return `rgb(${r},${g},${b})`;
  }
  // yellow → red
  const t = (s - 0.5) / 0.5;
  const r = Math.round(255);
  const g = Math.round(150 * (1 - t));
  const b = Math.round(0);
  return `rgb(${r},${g},${b})`;
}
