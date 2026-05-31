import { nanoid } from "nanoid";
import type { StimulusEvent } from "../types";

export async function getWeatherStimulus(): Promise<StimulusEvent> {
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

  return {
    id: nanoid(),
    timestamp: Date.now(),
    source: "weather",
    label: `${label} ${temp}°C`,
    value: temp,
  };
}
