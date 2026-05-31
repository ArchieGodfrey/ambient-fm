export interface SessionSummary {
  id: string;
  timestamp: number;

  dominantMood: string;

  avgBpm: number;
  avgEnergy: number;

  key: string;

  layerProfile: {
    drone: number;
    pad: number;
    texture: number;
    pulse: number;
  };
}
