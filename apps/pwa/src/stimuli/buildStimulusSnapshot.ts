import { getTimeStimulus } from "./timeStimulus";
import { getWeatherStimulus } from "./weatherStimulus";

export async function buildStimulusSnapshot() {
  const time = getTimeStimulus();
  const weather = await getWeatherStimulus();

  return [time, weather];
}
