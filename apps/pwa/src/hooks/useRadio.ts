import { useCallback, useEffect, useRef, useState } from "react";
import useSounds from "./useSounds";
import usePreference from "./usePreference";
import type useAudioComposer from "./useAudioComposer";
import type useModelManager from "./useModelManager";
import { prepareLine, cancelHost, voiceAudible, maybeAutoLoadVoice } from "../audio/host";
import { duckTo, unduck } from "../audio/toneEngine";
import { takeFloor, releaseFloor } from "../audio/playbackFloor";
import {
  startBackgroundKeepAlive, stopBackgroundKeepAlive,
  setMediaSessionPlaying, setMediaSessionTrack, setMediaSessionHandlers, clearMediaSession,
} from "../audio/backgroundAudio";
import { hostWelcome, hostFiller, hostIntro } from "../ai/hostScript";
import { soundToDirection } from "../sounds/soundDirection";
import { recordFeedback, type TrackRef } from "../feedback/feedback";
import { blendLean } from "../themes/presets";
import { isModelLoaded } from "../ai/composer";
import { useAppStore } from "../store/useAppStore";
import type { Sound } from "../sounds/types";
import type { CompositionPlan } from "../ai/types";
import type { CompositionIntent } from "../ai/intentSchema";
import type { StimulusEvent } from "../types";

type AudioComposer = ReturnType<typeof useAudioComposer>;
type ModelManager = ReturnType<typeof useModelManager>;
export type RadioState = "idle" | "announcing" | "generating" | "playing";
export type NowPlaying = { title: string; mood: string; key: string } | null;

// A pre-generated, not-yet-saved track waiting in the buffer.
type QueueItem = { plan: CompositionPlan; intent: CompositionIntent; title: string; name?: string; yours?: boolean };

// The station: an autonomous generate → announce → play loop. It keeps a small
// BUFFER of pre-generated tracks so transitions are instant and gapless — the
// model stays loaded during a session (inference doesn't suspend audio; a model
// LOAD does, so we never reload mid-session). When you tune out we unload the
// model after a short grace period to free memory. Host lines are deterministic
// (no inference), and buffered tracks are saved only when they actually play.
const MIN_TRACK_MS = 120_000; // tracks run at least two minutes (loop if shorter)
const FRESH_CAPTURE_MS = 15 * 60 * 1000;
const BUFFER_SIZE = 5;        // how many tracks a batch fills the buffer to
const LOW_WATER = 1;         // reload + refill once the buffer drops to this
const UNLOAD_GRACE_MS = 45_000; // unload the model this long after tuning out

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function useRadio(audio: AudioComposer, events: StimulusEvent[], model: ModelManager) {
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
  const unloadTimerRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const playingRef = useRef<TrackRef | null>(null); // the track currently on air
  const queueRef = useRef<QueueItem[]>([]);           // pre-generated buffer
  const fillingRef = useRef(false);                   // a fill loop is in progress
  const genRef = useRef(0);                           // bumped to discard a stale fill (lean-in change)
  const leanIn = useAppStore((s) => s.leanIn);
  const [state, setState] = useState<RadioState>("idle");
  const [hostText, setHostText] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);

  // What the DJ composes from: a leaned-in target (explicit) → a fresh capture →
  // sometimes your emergent "Your Sound" → a random saved Sound.
  const pickSource = useCallback((): { sound?: Partial<Sound>; name?: string; yours?: boolean } => {
    const { preference: pref, yourSound: ys } = prefRef.current;
    const lean = useAppStore.getState().leanIn;
    if (lean) return { sound: blendLean(lean.sound, ys, pref.confidence), name: lean.name };
    const hasFreshCapture = eventsRef.current.some((e) => e.source === "audio" && Date.now() - e.timestamp < FRESH_CAPTURE_MS);
    if (hasFreshCapture) return {};
    if (pref.confidence >= 0.3 && Math.random() < 0.5) return { sound: ys, yours: true };
    const list = soundsRef.current;
    if (!list.length) return {};
    const pick = list[Math.floor(Math.random() * list.length)];
    return { sound: pick, name: pick.name };
  }, []);

  // Top the buffer up to `target` tracks. Runs while the model is already loaded
  // (during a session) so it never gaps audio. One fill at a time.
  const fill = useCallback(async (rid: number, target: number) => {
    if (fillingRef.current || queueRef.current.length >= target) return;
    fillingRef.current = true;
    const gen = genRef.current;
    const live = () => runIdRef.current === rid && runningRef.current && genRef.current === gen;
    try {
      // Reload the model if it was unloaded between batches — WITHOUT suspending
      // audio (keepAudio), so the currently-playing track keeps going while the
      // model loads in its worker. The reload is hidden behind the last buffered
      // track, so the batch is ready before it ends.
      if (!isModelLoaded()) {
        const ok = await model.loadModelAction({ keepAudio: true });
        if (ok === false || !live()) return;
      }
      while (queueRef.current.length < target && live() && isModelLoaded()) {
        const src = pickSource();
        const direction = src.sound ? soundToDirection(src.sound) : undefined;
        const composed = await audio.composeTrack(undefined, direction, src.sound, { save: false });
        if (!composed || !live()) break;
        queueRef.current.push({ plan: composed.plan, intent: composed.intent, title: composed.title, name: src.name, yours: src.yours });
      }
    } finally {
      // Free the model from memory between batches; the next low-water fill
      // reloads it gaplessly (keepAudio) while a track is still playing.
      if (isModelLoaded()) await model.unloadModelAction();
      fillingRef.current = false;
    }
  }, [audio, pickSource, model]);
  const fillRef = useRef(fill);
  fillRef.current = fill;

  const tuneOut = useCallback(() => {
    runningRef.current = false;
    runIdRef.current += 1;
    genRef.current += 1;
    queueRef.current = [];
    playingRef.current = null;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    cancelHost();
    setHostText(null);
    setNowPlaying(null);
    setState("idle");
    releaseFloor(tuneOut);
    audio.stopPlayback();
    unduck(0.3);
    stopBackgroundKeepAlive();
    setMediaSessionPlaying(false);
    clearMediaSession();
    // Free the model from memory shortly after tuning out (cancelled if you tune
    // back in first) — memory savings without ever gapping playback mid-session.
    if (unloadTimerRef.current) clearTimeout(unloadTimerRef.current);
    unloadTimerRef.current = window.setTimeout(() => {
      unloadTimerRef.current = null;
      if (!runningRef.current) void model.unloadModelAction();
    }, UNLOAD_GRACE_MS);
  }, [audio, model]);

  const cycle = useCallback(async (first: boolean, rid: number) => {
    const live = () => runIdRef.current === rid && runningRef.current;
    if (!live()) return;
    // The track that was on air played to its natural end → a "complete" signal.
    if (playingRef.current) { void recordFeedback("complete", playingRef.current); playingRef.current = null; }

    // At the low-water mark, reload (gaplessly) and refill the batch in the
    // background while the last buffered track plays.
    if (queueRef.current.length <= LOW_WATER && !fillingRef.current) void fill(rid, BUFFER_SIZE);

    // Nothing ready yet (cold start, or generation briefly fell behind) — narrate
    // while we wait for the first buffered track.
    if (queueRef.current.length === 0) {
      duckTo(-16);
      setState("generating");
      const line = first ? hostWelcome(eventsRef.current) : hostFiller(eventsRef.current);
      setHostText(line);
      const voicePromise = (await prepareLine(line))();
      while (queueRef.current.length === 0 && live()) await wait(200);
      await voicePromise;
      if (!live()) return;
    }

    const next = queueRef.current.shift();
    if (!next) { tuneOut(); return; }

    // Save the track now that it's actually playing, so the library reflects what
    // was heard (buffered/regenerated tracks are never saved unless they play).
    const sessionId = await audio.persistComposed(eventsRef.current, next.plan, next.title);
    if (!live()) return;

    setNowPlaying({ title: next.title, mood: String(next.plan.globalMood ?? "ambient"), key: next.plan.key });
    setMediaSessionTrack(next.title);
    setState("announcing");
    const introLine = hostIntro(next.title, next.plan, { soundName: next.name, yours: next.yours });
    setHostText(introLine);
    const playIntro = await prepareLine(introLine);
    if (!live()) return;
    await playIntro();
    if (!live()) return;

    setHostText(null);
    setState("playing");
    await audio.playComposed(next.plan, next.intent, next.title, sessionId);
    playingRef.current = { sessionId: sessionId ?? "", mood: String(next.plan.globalMood ?? ""), key: next.plan.key, bpm: next.plan.bpm };
    unduck();
    countRef.current += 1;

    const ms = Math.max(MIN_TRACK_MS, Math.round((next.plan.duration ?? 120) * 1000));
    timerRef.current = window.setTimeout(() => void cycle(false, rid), ms);
  }, [audio, fill, tuneOut]);

  const tuneIn = useCallback(() => {
    if (runningRef.current) return;
    if (unloadTimerRef.current) { clearTimeout(unloadTimerRef.current); unloadTimerRef.current = null; } // keep the model warm
    runningRef.current = true;
    runIdRef.current += 1;
    genRef.current += 1;
    queueRef.current = [];
    const rid = runIdRef.current;
    countRef.current = 0;
    maybeAutoLoadVoice();
    takeFloor(tuneOut);
    startBackgroundKeepAlive();
    setMediaSessionHandlers({ onPlay: tuneIn, onPause: tuneOut });
    setMediaSessionPlaying(true);
    void cycle(true, rid);
  }, [cycle, tuneOut]);

  // A new lean-in target: drop the buffered (old-lean) tracks and bump the fill
  // generation so any in-flight fill is discarded. The current track keeps playing
  // (model stays loaded → no gap); the next track regenerates with the new lean.
  useEffect(() => {
    if (!runningRef.current) return;
    genRef.current += 1;
    queueRef.current = [];
    if (!fillingRef.current) void fillRef.current(runIdRef.current, BUFFER_SIZE);
  }, [leanIn]);

  return { state, hostText, nowPlaying, tuneIn, tuneOut, isOn: state !== "idle", voiceAudible: voiceAudible() };
}
