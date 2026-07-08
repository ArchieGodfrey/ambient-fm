import { useCallback, useRef, useState } from "react";
import useSounds from "./useSounds";
import usePreference from "./usePreference";
import type useAudioComposer from "./useAudioComposer";
import { prepareLine, cancelHost, voiceAudible, maybeAutoLoadVoice } from "../audio/host";
import { duckTo, unduck } from "../audio/toneEngine";
import { takeFloor, releaseFloor } from "../audio/playbackFloor";
import { hostWelcome, hostGreeting, hostFiller, hostIntro } from "../ai/hostScript";
import { soundToDirection } from "../sounds/soundDirection";
import { recordFeedback, type TrackRef } from "../feedback/feedback";
import { blendThemeWithYourSound } from "../themes/presets";
import { useAppStore } from "../store/useAppStore";
import type { Sound } from "../sounds/types";
import type { StimulusEvent } from "../types";

type AudioComposer = ReturnType<typeof useAudioComposer>;
export type RadioState = "idle" | "announcing" | "generating" | "playing";
export type NowPlaying = { title: string; mood: string; key: string } | null;

// The station: an autonomous generate → announce → play loop. The DJ picks what
// to compose from — a fresh capture if the mic's been used recently, otherwise a
// random one of your saved Sounds (bespoke/manual generation lives in the Studio
// now). The host talks WHILE the next track composes: the voice line is
// pre-rendered (Piper, WASM/CPU) before generation starts, then played during it
// — a host-bridged transition. If the voice isn't downloaded, the line shows as
// an on-screen caption for a readable beat instead (no system voice).
const HOST_GREETING_EVERY = 2;
const MIN_TRACK_MS = 120_000; // tracks run at least two minutes (loop if shorter)
const FRESH_CAPTURE_MS = 15 * 60 * 1000;

export default function useRadio(audio: AudioComposer, events: StimulusEvent[]) {
  const { sounds } = useSounds();
  const { preference, yourSound } = usePreference();
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;
  const prefRef = useRef({ preference, yourSound });
  prefRef.current = { preference, yourSound };
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const runningRef = useRef(false);
  const runIdRef = useRef(0); // bumped on every tune in/out; a stale cycle bails
  const timerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const playingRef = useRef<TrackRef | null>(null); // the track currently on air
  const [state, setState] = useState<RadioState>("idle");
  const [hostText, setHostText] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);

  // The DJ picks what to compose from: a fresh capture → the moment; else, once
  // we know you a little, sometimes your emergent "Your Sound"; otherwise a
  // random saved Sound.
  const pickSource = useCallback((): { sound?: Partial<Sound>; name?: string; yours?: boolean } => {
    const { preference: pref, yourSound: ys } = prefRef.current;
    // A leaned-in theme is an explicit request — honour it above everything, but
    // blend it gently with the listener's emergent sound.
    const leanIn = useAppStore.getState().leanIn;
    if (leanIn) return { sound: blendThemeWithYourSound(leanIn, ys, pref.confidence), name: leanIn.name };
    const hasFreshCapture = eventsRef.current.some((e) => e.source === "audio" && Date.now() - e.timestamp < FRESH_CAPTURE_MS);
    if (hasFreshCapture) return {}; // the audio stimulus in events drives it
    if (pref.confidence >= 0.3 && Math.random() < 0.5) return { sound: ys, yours: true }; // steer by preference
    const list = soundsRef.current;
    if (!list.length) return {};
    const pick = list[Math.floor(Math.random() * list.length)];
    return { sound: pick, name: pick.name };
  }, []);

  const tuneOut = useCallback(() => {
    runningRef.current = false;
    runIdRef.current += 1; // invalidate any in-flight/scheduled cycle
    playingRef.current = null; // tuning out isn't a dislike — don't score it
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    cancelHost();
    setHostText(null);
    setNowPlaying(null);
    setState("idle");
    releaseFloor(tuneOut);
    audio.stopPlayback(); // stop the current track immediately
    unduck(0.3);          // reset the duck so the next tune-in isn't quiet
  }, [audio]);

  const cycle = useCallback(async (first: boolean, rid: number) => {
    const live = () => runIdRef.current === rid && runningRef.current;
    if (!live()) return;
    // The track that was on air played to its natural end → a "complete" signal.
    if (playingRef.current) { void recordFeedback("complete", playingRef.current); playingRef.current = null; }
    const { sound, name, yours } = pickSource();
    const direction = sound ? soundToDirection(sound) : undefined;
    const greetingDue = first || countRef.current % HOST_GREETING_EVERY === 0;

    // Duck the outgoing track to a bed; prepare the host line (the voice renders
    // here, before generation grabs the GPU).
    duckTo(-16);
    setState("announcing");
    const preLine = first ? hostWelcome(eventsRef.current) : greetingDue ? hostGreeting(eventsRef.current) : hostFiller(eventsRef.current);
    setHostText(preLine);
    const playPre = await prepareLine(preLine);
    if (!live()) return;

    // Generate the next track; the pre-rendered voice plays over it.
    setState("generating");
    const genPromise = audio.composeTrack(undefined, direction, sound);
    const voicePromise = playPre();
    const result = await genPromise;
    await voicePromise;
    if (!live()) return;
    if (!result) { tuneOut(); return; }

    // Introduce the new track over the bed, then bring it up to full.
    setNowPlaying({ title: result.title, mood: String(result.plan.globalMood ?? "ambient"), key: result.plan.key });
    setState("announcing");
    const introLine = hostIntro(result.title, result.plan, { soundName: name, yours });
    setHostText(introLine);
    const playIntro = await prepareLine(introLine);
    if (!live()) return;
    await playIntro();
    if (!live()) return;

    setHostText(null);
    setState("playing");
    await audio.playComposed(result.plan, result.intent, result.title, result.sessionId);
    playingRef.current = { sessionId: result.sessionId ?? "", mood: String(result.plan.globalMood ?? ""), key: result.plan.key, bpm: result.plan.bpm };
    unduck();
    countRef.current += 1;

    const ms = Math.max(MIN_TRACK_MS, Math.round((result.plan.duration ?? 120) * 1000));
    timerRef.current = window.setTimeout(() => void cycle(false, rid), ms);
  }, [audio, pickSource, tuneOut]);

  const tuneIn = useCallback(() => {
    if (runningRef.current) return;
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    runningRef.current = true;
    runIdRef.current += 1;
    const rid = runIdRef.current;
    countRef.current = 0;
    maybeAutoLoadVoice(); // warm (or first-time download) the DJ voice
    takeFloor(tuneOut);   // claim the playback floor — stops any preview/manual playback
    void cycle(true, rid);
  }, [cycle, tuneOut]);

  return { state, hostText, nowPlaying, tuneIn, tuneOut, isOn: state !== "idle", voiceAudible: voiceAudible() };
}
