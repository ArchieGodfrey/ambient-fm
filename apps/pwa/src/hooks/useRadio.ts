import { useCallback, useRef, useState } from "react";
import useSounds from "./useSounds";
import type useAudioComposer from "./useAudioComposer";
import { speak, cancelHost, hostAvailable } from "../audio/host";
import { duckTo, unduck } from "../audio/toneEngine";
import { hostWelcome, hostGreeting, hostFiller, hostIntro } from "../ai/hostScript";
import { soundToDirection } from "../sounds/soundDirection";
import type { StimulusEvent } from "../types";

type AudioComposer = ReturnType<typeof useAudioComposer>;
export type RadioState = "idle" | "announcing" | "generating" | "playing";
export type NowPlaying = { title: string; mood: string; key: string } | null;

// The station: an autonomous generate → announce → play loop. The host talks
// WHILE the next track composes (composeTrack suspends the audio context; the
// voice is independent), so the spoken segment covers the generation gap — a
// host-bridged transition, no cross-fade needed. Full time/weather greetings
// come every other track; a short filler covers the gap on the rest.
const HOST_GREETING_EVERY = 2;

export default function useRadio(audio: AudioComposer, events: StimulusEvent[]) {
  const { activeSound } = useSounds();
  const soundRef = useRef(activeSound);
  soundRef.current = activeSound;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const [state, setState] = useState<RadioState>("idle");
  const [hostText, setHostText] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);

  const say = useCallback(async (text: string) => {
    setHostText(text);
    if (hostAvailable()) await speak(text);
    // Even without TTS, pace the transition so captions are readable.
    else await new Promise((r) => setTimeout(r, Math.min(6000, 1400 + text.length * 45)));
  }, []);

  const tuneOut = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    cancelHost();
    unduck(0.25);
    setHostText(null);
    setNowPlaying(null);
    setState("idle");
    audio.stopPlayback();
  }, [audio]);

  const cycle = useCallback(async (first: boolean) => {
    if (!runningRef.current) return;
    const sound = soundRef.current ?? undefined;
    const direction = sound ? soundToDirection(sound) : undefined;
    const greetingDue = first || countRef.current % HOST_GREETING_EVERY === 0;

    // Duck the outgoing track to a bed and start the host line — it plays over
    // the generation that follows (audio suspends during infer; voice does not).
    duckTo(-16);
    setState("announcing");
    const preLine = first ? hostWelcome(eventsRef.current) : greetingDue ? hostGreeting(eventsRef.current) : hostFiller(eventsRef.current);
    const speaking = say(preLine);

    setState("generating");
    const result = await audio.composeTrack(undefined, direction, sound);
    await speaking; // usually finishes during/just after generation
    if (!runningRef.current) return;
    if (!result) { tuneOut(); return; }

    // Introduce the new track over the bed, then bring it up to full.
    setNowPlaying({ title: result.title, mood: String(result.plan.globalMood ?? "ambient"), key: result.plan.key });
    setState("announcing");
    await say(hostIntro(result.title, result.plan));
    if (!runningRef.current) return;

    setHostText(null);
    setState("playing");
    await audio.playComposed(result.plan, result.intent, result.title);
    unduck();
    countRef.current += 1;

    // Move to the next track at this one's natural length.
    const ms = Math.max(30000, Math.round((result.plan.duration ?? 90) * 1000));
    timerRef.current = window.setTimeout(() => void cycle(false), ms);
  }, [audio, say, tuneOut]);

  const tuneIn = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    countRef.current = 0;
    void cycle(true);
  }, [cycle]);

  return { state, hostText, nowPlaying, tuneIn, tuneOut, isOn: state !== "idle", ttsAvailable: hostAvailable() };
}
