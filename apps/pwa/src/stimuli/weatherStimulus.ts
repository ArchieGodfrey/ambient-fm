import { nanoid } from "nanoid";
import type { StimulusEvent } from "../types";

const WEATHER_CACHE_KEY = "ambient-fm-last-weather";

function createWeatherEvent(label: string, value: number): StimulusEvent {
  return {
    id: nanoid(),
    timestamp: Date.now(),
    source: "weather",
    label: `${label} ${value}°C`,
    value,
  };
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

function saveLastWeather(event: StimulusEvent) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(event));
  } catch {
    // ignore storage errors
  }
}

export async function getWeatherStimulus(): Promise<StimulusEvent> {
  const fallback = readLastWeather();

  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=51.5072&longitude=-0.1276&current_weather=true&timezone=auto"
    );
    const data = await res.json();
    const current = data.current_weather ?? {};
    const temp = typeof current.temperature === "number" ? current.temperature : 15;
    const code = typeof current.weathercode === "number" ? current.weathercode : 0;

    let label = "Neutral Weather";

    if (code === 0) label = "Clear";
    else if (code <= 3) label = "Cloudy";
    else label = "Rainy";

    const event = createWeatherEvent(label, temp);
    saveLastWeather(event);
    return event;
  } catch {
    if (fallback) {
      return fallback;
    }
    return createWeatherEvent("Neutral Weather", 15);
  }
}
