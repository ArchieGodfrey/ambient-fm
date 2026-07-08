import { useCallback, useEffect, useRef, useState } from "react";
import useSounds from "./useSounds";
import usePreference from "./usePreference";
import type useAudioComposer from "./useAudioComposer";
import type useModelManager from "./useModelManager";
import { prepareLine, cancelHost, voiceAudible, maybeAutoLoadVoice } from "../audio/host";
import { duckTo, unduck } from "../audio/toneEngine";
import { takeFloor, releaseFloor } from "../audio/playbackFloor";
import { startBackgroundKeepAlive } from "../audio/backgroundAudio";
import { hostWelcome, hostFiller, hostIntro } from "../ai/hostScript";
import { soundToDirection } from "../sounds/soundDirection";
import { recordFeedback, type TrackRef } from "../feedback/feedback";
import { blendLean } from "../themes/presets";
import { isModelLoaded } from "../ai/composer";
import { generateTrackName } from "../ai/trackName";
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
// A track that has played (saved, has a sessionId) — the back/forward history.
type PlayedItem = QueueItem & { sessionId: string | null };

// The station. A playlist model: `played` is the history of tracks heard (each
// saved), `cursor` is where we are in it, and `queue` is a buffer of
// pre-generated (unsaved) future tracks. Advancing past the history pulls from
// the buffer (instant, gapless); skip/previous move the cursor. The model stays
// loaded only while a batch generates (keepAudio reload — no mid-session gap) and
// is freed between batches / on idle. Host lines are deterministic (no inference).
const MIN_TRACK_MS = 120_000;
const FRESH_CAPTURE_MS = 15 * 60 * 1000;
const BUFFER_SIZE = 5;        // a batch fills the buffer to this
const LOW_WATER = 1;          // reload + refill once the buffer drops to this
const UNLOAD_GRACE_MS = 45_000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function useRadio(audio: AudioComposer, events: StimulusEvent[], model: ModelManager) {
  const { sounds } = useSounds();
  const { preference, yourSound } = usePreference();
  const soundsRef = useRef(sounds); soundsRef.current = sounds;
  const prefRef = useRef({ preference, yourSound }); prefRef.current = { preference, yourSound };
  const eventsRef = useRef(events); eventsRef.current = events;

  const runningRef = useRef(false);
  const runIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const unloadTimerRef = useRef<number | null>(null);
  const playingRef = useRef<TrackRef | null>(null);
  const playedRef = useRef<PlayedItem[]>([]);   // history (saved)
  const cursorRef = useRef(-1);                  // index into played
  const queueRef = useRef<QueueItem[]>([]);      // future buffer (unsaved)
  const fillingRef = useRef(false);
  const genRef = useRef(0);                      // bumped to discard a stale fill (lean-in change)
  const usedTitlesRef = useRef<Set<string>>(new Set());
  const leanIn = useAppStore((s) => s.leanIn);
  const [state, setState] = useState<RadioState>("idle");
  const [hostText, setHostText] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [canPrev, setCanPrev] = useState(false);

  // Stable public handles (so takeFloor/MediaSession keep one identity).
  const apiRef = useRef<Record<string, (...a: never[]) => unknown>>({});
  const tuneIn = useCallback(() => apiRef.current.tuneIn?.(), []);
  const tuneOut = useCallback(() => apiRef.current.tuneOut?.(), []);
  const skip = useCallback(() => apiRef.current.skip?.(), []);
  const previous = useCallback(() => apiRef.current.previous?.(), []);

  const pickSource = (): { sound?: Partial<Sound>; name?: string; yours?: boolean } => {
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
  };

  // Top the buffer up to `target`. Reloads the model gaplessly (keepAudio) if it
  // was freed between batches, then frees it again once the batch is generated.
  const fill = async (rid: number, target: number) => {
    if (fillingRef.current || queueRef.current.length >= target) return;
    fillingRef.current = true;
    const gen = genRef.current;
    const live = () => runIdRef.current === rid && runningRef.current && genRef.current === gen;
    try {
      if (!isModelLoaded()) {
        const ok = await model.loadModelAction({ keepAudio: true });
        if (ok === false || !live()) return;
      }
      while (queueRef.current.length < target && live() && isModelLoaded()) {
        const src = pickSource();
        const direction = src.sound ? soundToDirection(src.sound) : undefined;
        const composed = await audio.composeTrack(undefined, direction, src.sound, { save: false });
        if (!composed || !live()) break;
        let title = composed.title;
        if (usedTitlesRef.current.has(title.toLowerCase())) title = generateTrackName(composed.plan); // dedupe identical titles
        usedTitlesRef.current.add(title.toLowerCase());
        queueRef.current.push({ plan: composed.plan, intent: composed.intent, title, name: src.name, yours: src.yours });
      }
    } finally {
      if (isModelLoaded()) await model.unloadModelAction();
      fillingRef.current = false;
    }
  };

  // Play whatever the cursor points at. announce → the DJ intros it (natural
  // transitions / first tune-in); manual skip/prev are snappy (no voice).
  const playCurrent = async (rid: number, opts: { announce: boolean; first?: boolean }) => {
    const live = () => runIdRef.current === rid && runningRef.current;
    const item = playedRef.current[cursorRef.current];
    if (!item || !live()) return;
    setCanPrev(cursorRef.current > 0);
    duckTo(-16);
    setNowPlaying({ title: item.title, mood: String(item.plan.globalMood ?? "ambient"), key: item.plan.key });
    if (opts.announce) {
      setState("announcing");
      const line = opts.first ? hostWelcome(eventsRef.current) : hostIntro(item.title, item.plan, { soundName: item.name, yours: item.yours });
      setHostText(line);
      const playLine = await prepareLine(line);
      if (!live()) return;
      await playLine();
      if (!live()) return;
    }
    setHostText(null);
    setState("playing");
    await audio.playComposed(item.plan, item.intent, item.title, item.sessionId);
    // If a tune-out raced in while playComposed was starting audio, it just
    // un-stopped us — stop again so playback doesn't linger for a few seconds.
    if (!live()) { audio.stopPlayback(); return; }
    playingRef.current = { sessionId: item.sessionId ?? "", mood: String(item.plan.globalMood ?? ""), key: item.plan.key, bpm: item.plan.bpm };
    unduck();
    if (timerRef.current) clearTimeout(timerRef.current);
    const ms = Math.max(MIN_TRACK_MS, Math.round((item.plan.duration ?? 120) * 1000));
    timerRef.current = window.setTimeout(() => void apiRef.current.toNext?.(rid as never, { auto: true } as never), ms);
  };

  const toNext = async (rid: number, opts: { auto?: boolean; first?: boolean }) => {
    const live = () => runIdRef.current === rid && runningRef.current;
    if (!live()) return;
    if (opts.auto && playingRef.current) void recordFeedback("complete", playingRef.current); // natural end only
    playingRef.current = null;

    if (queueRef.current.length <= LOW_WATER && !fillingRef.current) void fill(rid, BUFFER_SIZE);

    if (cursorRef.current < playedRef.current.length - 1) {
      cursorRef.current += 1; // forward through history — already heard, so quick
      await playCurrent(rid, { announce: false });
      return;
    }

    // Need a fresh track from the buffer. If it isn't ready, cover the wait with a
    // spoken line — and if we do, don't ALSO play an intro below (one line, no
    // double announcement).
    let didFiller = false;
    if (queueRef.current.length === 0) {
      duckTo(-16);
      setState("generating");
      const line = opts.first ? hostWelcome(eventsRef.current) : hostFiller(eventsRef.current);
      setHostText(line);
      const voiceP = (await prepareLine(line))();
      while (queueRef.current.length === 0 && live()) await wait(200);
      await voiceP;
      if (!live()) return;
      didFiller = true;
    }
    const q = queueRef.current.shift();
    if (!q) { apiRef.current.tuneOut?.(); return; }
    const sessionId = await audio.persistComposed(eventsRef.current, q.plan, q.title);
    if (!live()) return;
    playedRef.current.push({ ...q, sessionId });
    cursorRef.current = playedRef.current.length - 1;
    await playCurrent(rid, { announce: (!!opts.auto || !!opts.first) && !didFiller, first: opts.first });
  };

  const toPrev = async (rid: number) => {
    const live = () => runIdRef.current === rid && runningRef.current;
    if (!live() || cursorRef.current <= 0) return;
    playingRef.current = null; // going back isn't a "complete"
    cursorRef.current -= 1;
    await playCurrent(rid, { announce: false });
  };

  function doTuneOut() {
    runningRef.current = false;
    runIdRef.current += 1;
    genRef.current += 1;
    queueRef.current = [];
    playedRef.current = [];
    cursorRef.current = -1;
    usedTitlesRef.current.clear();
    playingRef.current = null;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    cancelHost();
    setHostText(null); setNowPlaying(null); setState("idle"); setCanPrev(false);
    releaseFloor(tuneOut);
    audio.stopPlayback();
    unduck(0.3);
    if (unloadTimerRef.current) clearTimeout(unloadTimerRef.current);
    unloadTimerRef.current = window.setTimeout(() => {
      unloadTimerRef.current = null;
      if (!runningRef.current) void model.unloadModelAction();
    }, UNLOAD_GRACE_MS);
  }

  function doTuneIn() {
    if (runningRef.current) return;
    if (unloadTimerRef.current) { clearTimeout(unloadTimerRef.current); unloadTimerRef.current = null; }
    runningRef.current = true;
    runIdRef.current += 1;
    genRef.current += 1;
    queueRef.current = []; playedRef.current = []; cursorRef.current = -1;
    usedTitlesRef.current.clear();
    const rid = runIdRef.current;
    maybeAutoLoadVoice();
    takeFloor(tuneOut);
    startBackgroundKeepAlive();
    void toNext(rid, { first: true });
  }

  function doSkip() {
    if (!runningRef.current) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    void toNext(runIdRef.current, { auto: false });
  }
  function doPrevious() {
    if (!runningRef.current) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    void toPrev(runIdRef.current);
  }

  apiRef.current = {
    tuneIn: doTuneIn as never, tuneOut: doTuneOut as never, skip: doSkip as never,
    previous: doPrevious as never, toNext: toNext as never, fill: fill as never,
  };

  // A new lean-in target: drop the buffered (old-lean) future tracks and bump the
  // fill generation so any in-flight fill is discarded. History stays; the next
  // new track regenerates with the new lean (gaplessly — model reloads keepAudio).
  useEffect(() => {
    if (!runningRef.current) return;
    genRef.current += 1;
    queueRef.current = [];
    if (!fillingRef.current) void apiRef.current.fill?.(runIdRef.current as never, BUFFER_SIZE as never);
  }, [leanIn]);

  return { state, hostText, nowPlaying, tuneIn, tuneOut, skip, previous, canPrev, isOn: state !== "idle", voiceAudible: voiceAudible() };
}
