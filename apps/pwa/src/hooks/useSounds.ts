import { useCallback, useEffect, useState } from "react";
import { db } from "../db/db";
import { DEFAULT_COMPOSER_SETTINGS, type Sound, type SoundMood } from "../sounds/types";
import type { ComposerSettings } from "../features/composer/types";

const ACTIVE_KEY = "ambientfm-active-sound";
const SOUNDS_CHANGED = "sounds-changed";

const STARTERS: Array<{ name: string; mood: SoundMood }> = [
  { name: "Calm Commute", mood: { energy: 0.35, calmness: 0.8, tension: 0.15, brightness: 0.5 } },
  { name: "Focus", mood: { energy: 0.55, calmness: 0.5, tension: 0.35, brightness: 0.45 } },
  { name: "Late Night", mood: { energy: 0.25, calmness: 0.7, tension: 0.45, brightness: 0.25 } },
];

function makeSound(name: string, mood: SoundMood, composerSettings: ComposerSettings, parentId?: string): Sound {
  const ts = Date.now();
  return { id: crypto.randomUUID(), name, mood: { ...mood }, composerSettings: { ...composerSettings }, parentId, createdAt: ts, updatedAt: ts };
}

// Dedupe seeding across hook instances + StrictMode double-invocation.
let seedPromise: Promise<void> | null = null;
async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await db.sounds.count();
      if (count === 0) {
        await db.sounds.bulkAdd(STARTERS.map((s) => makeSound(s.name, s.mood, DEFAULT_COMPOSER_SETTINGS)));
      }
    })();
  }
  return seedPromise;
}

export default function useSounds() {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [activeSoundId, setActiveSoundId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY));

  const load = useCallback(async () => {
    await ensureSeeded();
    const all = await db.sounds.orderBy("updatedAt").reverse().toArray();
    setSounds(all);
    setActiveSoundId((current) => {
      if (current && all.some((s) => s.id === current)) return current;
      const next = all[0]?.id ?? null;
      if (next) localStorage.setItem(ACTIVE_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(SOUNDS_CHANGED, onChange);
    return () => window.removeEventListener(SOUNDS_CHANGED, onChange);
  }, [load]);

  const notify = () => window.dispatchEvent(new CustomEvent(SOUNDS_CHANGED));

  const setActiveSound = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_KEY, id);
    setActiveSoundId(id);
  }, []);

  const createSound = useCallback(async (name: string, mood: SoundMood, composerSettings: ComposerSettings, parentId?: string) => {
    const sound = makeSound(name, mood, composerSettings, parentId);
    await db.sounds.add(sound);
    setActiveSound(sound.id);
    notify();
    return sound;
  }, [setActiveSound]);

  const updateSound = useCallback(async (id: string, patch: Partial<Pick<Sound, "name" | "mood" | "composerSettings">>) => {
    await db.sounds.update(id, { ...patch, updatedAt: Date.now() });
    notify();
  }, []);

  const deleteSound = useCallback(async (id: string) => {
    await db.sounds.delete(id);
    notify();
  }, []);

  const branchSound = useCallback(async (id: string) => {
    const parent = await db.sounds.get(id);
    if (!parent) return null;
    const copy = makeSound(`${parent.name} variant`, parent.mood, parent.composerSettings, parent.id);
    await db.sounds.add(copy);
    setActiveSound(copy.id);
    notify();
    return copy;
  }, [setActiveSound]);

  const activeSound = sounds.find((s) => s.id === activeSoundId) ?? null;

  return { sounds, activeSound, activeSoundId, setActiveSound, createSound, updateSound, deleteSound, branchSound };
}
