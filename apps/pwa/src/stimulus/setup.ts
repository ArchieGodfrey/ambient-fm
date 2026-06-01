import { db } from "../db/db";
import { ManualMoodStimulusPlugin } from "./plugins/manual";
import { TimeStimulusPlugin } from "./plugins/time";
import { WeatherStimulusPlugin } from "./plugins/weather";
import type { StimulusConfig } from "./types";
import { StimulusRegistry } from "./registry";

const DEFAULT_CONFIGS: StimulusConfig[] = [
  {
    id: "time",
    label: "Time of Day",
    userWeight: 0.75,
    aiWeight: 0.25,
    enabled: true,
  },
  {
    id: "weather",
    label: "Weather",
    userWeight: 0.75,
    aiWeight: 0.25,
    enabled: true,
  },
  {
    id: "manual",
    label: "Mood",
    userWeight: 0.75,
    aiWeight: 0.25,
    enabled: true,
    manualValues: {
      energy: 0.5,
      calmness: 0.5,
      tension: 0.5,
      brightness: 0.5,
    },
  },
];

export async function loadStimulusConfigs(): Promise<StimulusConfig[]> {
  const configs = await db.stimulusConfigs.toArray();
  if (configs.length > 0) {
    return configs;
  }

  await Promise.all(DEFAULT_CONFIGS.map((config) => db.stimulusConfigs.put(config)));
  return [...DEFAULT_CONFIGS];
}

export async function saveStimulusConfig(config: StimulusConfig) {
  await db.stimulusConfigs.put(config);
}

export async function createStimulusRegistryFromConfig() {
  const configs = await loadStimulusConfigs();
  const registry = new StimulusRegistry();
  const time = new TimeStimulusPlugin();
  const weather = new WeatherStimulusPlugin();
  const manual = new ManualMoodStimulusPlugin();

  registry.register(time);
  registry.register(weather);
  registry.register(manual);

  configs.forEach((config) => {
    registry.setEnabled(config.id, config.enabled);
    registry.setWeight(config.id, config.userWeight * 0.75 + config.aiWeight * 0.25);
    if (config.id === "manual" && config.manualValues) {
      manual.setValues(config.manualValues);
    }
  });

  return { registry, configs, manual };
}
