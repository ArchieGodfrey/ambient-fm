import { useCallback, useRef, useState } from "react";
import useSounds from "./useSounds";
import type useAudioComposer from "./useAudioComposer";
import { prepareLine, cancelHost, hostAvailable, preloadKokoro } from "../audio/host";
import { duckTo, unduck } from "../audio/toneEngine";
import { hostWelcome, hostGreeting, hostFiller, hostIntro } from "../ai/hostScript";
import { soundToDirection } from "../sounds/soundDirection";
import type { Sound } from "../sounds/types";
import type { StimulusEvent } from "../types";

type AudioComposer = ReturnType<typeof useAudioComposer>;
export type RadioState = "idle" | "announcing" | "generating" | "playing";
export type NowPlaying = { title: string; mood: string; key: string } | null;

// The station: an autonomous generate → announce → play loop. The DJ picks what
// to compose from — a fresh capture if the mic's been used recently, otherwise a
// random one of your saved Sounds (bespoke/manual generation lives in the Studio
// now). The host talks WHILE the next track composes: for Kokoro we pre-render
// the line to a clip (GPU) before generation starts, then play it during (via
// HTMLAudio, no GPU); speechSynthesis just speaks live. Either way the voice
// covers the audio-context suspension — a host-bridged transition.
const HOST_GREETING_EVERY = 2;
const MIN_TRACK_MS = 120_000; // tracks run at least two minutes (loop if shorter)
const FRESH_CAPTURE_MS = 15 * 60 * 1000;

export default function useRadio(audio: AudioComposer, events: StimulusEvent[]) {
  const { sounds } = useSounds();
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const [state, setState] = useState<RadioState>("idle");
  const [hostText, setHostText] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);

  // Fresh capture → compose from the moment; else a random saved Sound.
  const pickSource = useCallback((): { sound?: Partial<Sound>; name?: string } => {
    const hasFreshCapture = eventsRef.current.some((e) => e.source === "audio" && Date.now() - e.timestamp < FRESH_CAPTURE_MS);
    if (hasFreshCapture) return {}; // the audio stimulus in events drives it
    const list = soundsRef.current;
    if (!list.length) return {};
    const pick = list[Math.floor(Math.random() * list.length)];
    return { sound: pick, name: pick.name };
  }, []);

  const tuneOut = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    cancelHost();
    setHostText(null);
    setNowPlaying(null);
    setState("idle");
    // Soft sign-off: fade the music down before cutting it, rather than a hard stop.
    duckTo(-50, 1.1);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      audio.stopPlayback();
      unduck(0);
    }, 1150);
  }, [audio]);

  const cycle = useCallback(async (first: boolean) => {
    if (!runningRef.current) return;
    const { sound, name } = pickSource();
    const direction = sound ? soundToDirection(sound) : undefined;
    const greetingDue = first || countRef.current % HOST_GREETING_EVERY === 0;

    // Duck the outgoing track to a bed; prepare the host line (Kokoro renders
    // here, before generation grabs the GPU).
    duckTo(-16);
    setState("announcing");
    const preLine = first ? hostWelcome(eventsRef.current) : greetingDue ? hostGreeting(eventsRef.current) : hostFiller(eventsRef.current);
    setHostText(preLine);
    const playPre = await prepareLine(preLine);
    if (!runningRef.current) return;

    // Generate the next track; the pre-rendered voice plays over it.
    setState("generating");
    const genPromise = audio.composeTrack(undefined, direction, sound);
    const voicePromise = playPre();
    const result = await genPromise;
    await voicePromise;
    if (!runningRef.current) return;
    if (!result) { tuneOut(); return; }

    // Introduce the new track over the bed, then bring it up to full.
    setNowPlaying({ title: result.title, mood: String(result.plan.globalMood ?? "ambient"), key: result.plan.key });
    setState("announcing");
    const introLine = hostIntro(result.title, result.plan, name);
    setHostText(introLine);
    const playIntro = await prepareLine(introLine);
    if (!runningRef.current) return;
    await playIntro();
    if (!runningRef.current) return;

    setHostText(null);
    setState("playing");
    await audio.playComposed(result.plan, result.intent, result.title);
    unduck();
    countRef.current += 1;

    const ms = Math.max(MIN_TRACK_MS, Math.round((result.plan.duration ?? 120) * 1000));
    timerRef.current = window.setTimeout(() => void cycle(false), ms);
  }, [audio, pickSource, tuneOut]);

  const tuneIn = useCallback(() => {
    if (runningRef.current) return;
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    runningRef.current = true;
    countRef.current = 0;
    preloadKokoro(); // warm the neural voice while the first track composes
    void cycle(true);
  }, [cycle]);

  return { state, hostText, nowPlaying, tuneIn, tuneOut, isOn: state !== "idle", ttsAvailable: hostAvailable() };
}
