import type { StimulusEvent, StimulusPlugin } from "./types";

const DEFAULT_WEIGHT = 1;
const MAX_EVENTS = 200;

export class StimulusRegistry {
  private plugins: StimulusPlugin[] = [];

  register(plugin: StimulusPlugin) {
    this.plugins.push(plugin);
  }

  getPlugins() {
    return [...this.plugins];
  }

  setEnabled(id: string, enabled: boolean) {
    const plugin = this.plugins.find((entry) => entry.id === id);
    if (plugin) {
      plugin.enabled = enabled;
    }
  }

  setWeight(id: string, weight: number) {
    const plugin = this.plugins.find((entry) => entry.id === id);
    if (plugin) {
      plugin.weight = weight;
    }
  }

  getWeight(id: string) {
    const plugin = this.plugins.find((entry) => entry.id === id);
    return plugin?.weight ?? DEFAULT_WEIGHT;
  }

  async collect(): Promise<StimulusEvent[]> {
    const enabledPlugins = this.plugins.filter((plugin) => plugin.enabled);
    const results = await Promise.all(enabledPlugins.map((plugin) => plugin.generate()));
    const events = results.flat();
    if (events.length <= MAX_EVENTS) {
      return events;
    }
    return events.slice(0, MAX_EVENTS);
  }
}

export function getPluginWeight(registry: StimulusRegistry, id: string) {
  return registry.getWeight(id);
}
