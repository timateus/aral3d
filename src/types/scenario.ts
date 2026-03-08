export interface ForestAction {
  type: 'forest';
  lat: number;
  lon: number;
  radius: number; // km
  density?: number; // 0-1, default 0.5
}

export interface DamAction {
  type: 'dam';
  lat: number;
  lon: number;
  width?: number; // meters, default 200
  height?: number; // meters, default 30
  simulate?: boolean; // when true, trigger reservoir flood-fill simulation
  orientation?: number; // dam wall angle in degrees (default: auto-detect)
}

export interface WaterLevelAction {
  type: 'water_level';
  value: number; // meters
}

export interface CanalAction {
  type: 'canal';
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
  width?: number; // meters, default 50
}

export interface SettlementAction {
  type: 'settlement';
  lat: number;
  lon: number;
  name: string;
  size?: number; // 1-5, default 2
}

export interface LabelAction {
  type: 'label';
  lat: number;
  lon: number;
  text: string;
}

export type ScenarioAction =
  | ForestAction
  | DamAction
  | WaterLevelAction
  | CanalAction
  | SettlementAction
  | LabelAction;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: ScenarioAction[];
}
