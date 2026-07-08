import { useCallback, useEffect, useRef, useState } from "react";
import useSounds from "./useSounds";
import usePreference from "./usePreference";
import type useAudioComposer from "./useAudioComposer";
import type useModelManager from "./useModelManager";
import { prepareLine, cancelHost, voiceAudible, maybeAutoLoadVoice } from "../audio/host";
import { duckTo, unduck } from "../audio/toneEngine";
import { takeFloor, releaseFloor } from "../audio/playbackFloor";
import { renderTrack } from "../audio/renderTrack";
import { duckRendered } from "../audio/renderedPlayer";
import { getBed } from "../audio/djBed";
import { playBed, fadeOutBed, stopBed } from "../audio/bedPlayer";
import { hostIntroSegment, hostExtraLine, hostFiller, hostIntro, hostBackAnnounce, hostRequestAck } from "../ai/hostScript";
import { maybeRefreshHostPool } from "../ai/hostLines";
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

// A pre-generated, not-yet-saved track waiting in the buffer. `blob` is the track
// rendered to audio during buffering — played through a media element so it keeps
// going when the phone is locked (the live Web Audio context is suspended on lock).
type QueueItem = { plan: CompositionPlan; intent: CompositionIntent; title: string; name?: string; yours?: boolean; blob: Blob };
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
  const writeIn = useCallback((text: string) => apiRef.current.writeIn?.(text as never), []);

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
        // Pre-render the track to audio while it's buffering, so playback can run
        // through a media element (backgroundable). Skip a track that fails to render.
        let blob: Blob;
        try {
          blob = await renderTrack(composed.plan);
        } catch (e) {
          console.error("Track render failed, skipping", e);
          continue;
        }
        if (!live()) break;
        queueRef.current.push({ plan: composed.plan, intent: composed.intent, title, name: src.name, yours: src.yours, blob });
      }
      // Buffer's full and the model's still loaded — refresh the personality
      // host-line pool now (won't delay tracks; ready for later transitions).
      if (live() && isModelLoaded()) await maybeRefreshHostPool(eventsRef.current);
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
      duckRendered(true); // fade the outgoing track under the DJ line
      // Back-announce the track that just played, then intro this one.
      const prevTitle = cursorRef.current > 0 ? playedRef.current[cursorRef.current - 1]?.title : null;
      const back = hostBackAnnounce(prevTitle);
      const intro = hostIntro(item.title, item.plan, { soundName: item.name, yours: item.yours, events: eventsRef.current });
      const line = [back, intro].filter(Boolean).join(" ");
      setHostText(line);
      const playLine = await prepareLine(line);
      if (!live()) return;
      await playLine();
      if (!live()) return;
    }
    setHostText(null);
    setState("playing");
    fadeOutBed(); // bring the ambient bed down as the track comes in (no-op if idle)
    // Play the pre-rendered blob through a media element (survives lock). This
    // replaces the previous track's element, so the new track starts at full volume.
    await audio.playRenderedTrack(item.plan, item.blob, item.title, item.sessionId);
    // If a tune-out raced in while playback was starting, it just un-stopped us —
    // stop again so playback doesn't linger for a few seconds.
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

    // Need a fresh track from the buffer. If it isn't ready, cover the wait with the
    // DJ over a soft ambient bed: keep talking (intro segment → rotating
    // observations) until the track is ready, then name it. If we announced here,
    // don't ALSO announce in playCurrent below.
    let didAnnounceInGap = false;
    if (queueRef.current.length === 0) {
      duckTo(-16);
      setState("generating");
      // Ambient bed under the DJ — renders once (~1s) then loops quietly.
      void getBed().then((bed) => { if (live() && queueRef.current.length === 0) playBed(bed); }).catch(() => { /* bed is optional */ });
      const segment = opts.first ? hostIntroSegment(eventsRef.current) : [hostFiller(eventsRef.current)];
      let i = 0;
      while (queueRef.current.length === 0 && live()) {
        const line = i < segment.length ? segment[i] : hostExtraLine(eventsRef.current, i);
        setHostText(line);
        const playLine = await prepareLine(line);
        if (!live()) return;
        await playLine();
        if (!live()) return;
        i += 1;
        if (queueRef.current.length === 0 && live()) await wait(500); // a beat between lines
      }
      // Track is ready — name it as the hand-off line, then let it play.
      const upcoming = queueRef.current[0];
      if (upcoming && live()) {
        const introLine = hostIntro(upcoming.title, upcoming.plan, { soundName: upcoming.name, yours: upcoming.yours, events: eventsRef.current });
        setHostText(introLine);
        const playIntro = await prepareLine(introLine);
        if (!live()) return;
        await playIntro();
        if (!live()) return;
        didAnnounceInGap = true;
      }
    }
    const q = queueRef.current.shift();
    if (!q) { apiRef.current.tuneOut?.(); return; }
    const sessionId = await audio.persistComposed(eventsRef.current, q.plan, q.title);
    if (!live()) return;
    playedRef.current.push({ ...q, sessionId });
    cursorRef.current = playedRef.current.length - 1;
    await playCurrent(rid, { announce: (!!opts.auto || !!opts.first) && !didAnnounceInGap, first: opts.first });
  };

  const toPrev = async (rid: number) => {
    const live = () => runIdRef.current === rid && runningRef.current;
    if (!live() || cursorRef.current <= 0) return;
    playingRef.current = null; // going back isn't a "complete"
    cursorRef.current -= 1;
    await playCurrent(rid, { announce: false });
  };

  // A listener write-in request: the host reads it out over the bed while a bespoke
  // track is generated from the request text, then plays it next (interrupts the
  // current track). Self-contained so it doesn't tangle with the pre-gen buffer.
  type Gen = { composed: NonNullable<Awaited<ReturnType<typeof audio.composeTrack>>>; blob: Blob } | null;
  const playRequest = async (rid: number, text: string) => {
    const live = () => runIdRef.current === rid && runningRef.current;
    if (!live()) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    playingRef.current = null;
    duckTo(-16);
    duckRendered(true);
    setState("generating");
    void getBed().then((bed) => { if (live()) playBed(bed); }).catch(() => { /* bed optional */ });

    let loadedHere = false;
    if (!isModelLoaded()) {
      const ok = await model.loadModelAction({ keepAudio: true });
      if (ok === false || !live()) return;
      loadedHere = true;
    }
    // Generate the bespoke track from the request (direction = the request text).
    const genP: Promise<Gen> = (async () => {
      try {
        const composed = await audio.composeTrack(undefined, { vibe: text, instruction: text }, undefined, { save: false });
        if (!composed) return null;
        const blob = await renderTrack(composed.plan);
        return { composed, blob };
      } catch (e) { console.error("Request generation failed", e); return null; }
    })();

    // Read the request aloud over the bed until the track is ready.
    const ack = hostRequestAck(text, eventsRef.current);
    let result: Gen = null; let done = false;
    void genP.then((r) => { result = r; done = true; });
    let i = 0;
    while (!done && live()) {
      const line = i < ack.length ? ack[i] : hostExtraLine(eventsRef.current, i);
      setHostText(line);
      const playLine = await prepareLine(line);
      if (!live()) return;
      await playLine();
      if (!live()) return;
      i += 1;
      if (!done && live()) await wait(500);
    }
    if (!result) await genP; // ensure settled if the loop exited on the last line
    result = result ?? (await genP);
    if (loadedHere && isModelLoaded()) await model.unloadModelAction();
    if (!live()) return;
    if (!result) { setHostText(null); void toNext(rid, { auto: false }); return; } // gen failed → normal next

    const { composed, blob } = result;
    const sessionId = await audio.persistComposed(eventsRef.current, composed.plan, composed.title);
    if (!live()) return;
    playedRef.current.push({ plan: composed.plan, intent: composed.intent, title: composed.title, name: "your request", blob, sessionId });
    cursorRef.current = playedRef.current.length - 1;
    setCanPrev(cursorRef.current > 0);
    setNowPlaying({ title: composed.title, mood: String(composed.plan.globalMood ?? "ambient"), key: composed.plan.key });
    setHostText(null);
    setState("playing");
    fadeOutBed();
    await audio.playRenderedTrack(composed.plan, blob, composed.title, sessionId);
    if (!live()) { audio.stopPlayback(); return; }
    playingRef.current = { sessionId: sessionId ?? "", mood: String(composed.plan.globalMood ?? ""), key: composed.plan.key, bpm: composed.plan.bpm };
    unduck();
    if (timerRef.current) clearTimeout(timerRef.current);
    const ms = Math.max(MIN_TRACK_MS, Math.round((composed.plan.duration ?? 120) * 1000));
    timerRef.current = window.setTimeout(() => void apiRef.current.toNext?.(rid as never, { auto: true } as never), ms);
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
    stopBed();
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
    // No silent keep-alive element: the pre-rendered track's own media element is
    // what keeps playback (and the lock-screen controls) alive when locked.
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
  function doWriteIn(text: string) {
    const t = text.trim();
    if (!t || !runningRef.current) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    void playRequest(runIdRef.current, t);
  }

  apiRef.current = {
    tuneIn: doTuneIn as never, tuneOut: doTuneOut as never, skip: doSkip as never,
    previous: doPrevious as never, toNext: toNext as never, fill: fill as never,
    writeIn: doWriteIn as never,
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

  return { state, hostText, nowPlaying, tuneIn, tuneOut, skip, previous, writeIn, canPrev, isOn: state !== "idle", voiceAudible: voiceAudible() };
}
