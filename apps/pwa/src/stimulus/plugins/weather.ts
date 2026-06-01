import { nanoid } from "nanoid";
import type { StimulusEvent, StimulusPlugin } from "../types";

const WEATHER_CACHE_KEY = "ambient-fm-last-weather";

function saveLastWeather(event: StimulusEvent) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(event));
  } catch {
    // ignore storage errors
  }
}

function readLastWeather(): StimulusEvent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StimulusEvent;
  } catch {
    return null;
  }
}

function mapWeatherToStrength(code: number, temp: number) {
  const base = code === 0 ? 0.8 : code <= 3 ? 0.6 : 0.4;
  const tempAdjustment = Math.max(0, Math.min(1, (temp - 5) / 30));
  return Math.min(1, base + tempAdjustment * 0.15);
}

export class WeatherStimulusPlugin implements StimulusPlugin {
  id = "weather";
  label = "Weather";
  enabled = true;
  weight = 1;

  async generate(): Promise<StimulusEvent[]> {
    const fallback = readLastWeather();

    try {
      const response = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=51.5072&longitude=-0.1276&current_weather=true&timezone=auto",
      );
      const data = await response.json();
      const current = data.current_weather ?? {};
      const temp = typeof current.temperature === "number" ? current.temperature : 15;
      const code = typeof current.weathercode === "number" ? current.weathercode : 0;

      let label = "Neutral Weather";
      if (code === 0) label = "Clear";
      else if (code <= 3) label = "Cloudy";
      else label = "Rainy";

      const strength = mapWeatherToStrength(code, temp);
      const event: StimulusEvent = {
        id: nanoid(),
        source: this.id,
        label,
        timestamp: Date.now(),
        strength,
        metadata: { temperature: temp, weatherCode: code },
      };

      saveLastWeather(event);
      return [event];
    } catch {
      if (fallback) {
        return [fallback];
      }
      return [
        {
          id: nanoid(),
          source: this.id,
          label: "Neutral Weather",
          timestamp: Date.now(),
          strength: 0.5,
        },
      ];
    }
  }
}
