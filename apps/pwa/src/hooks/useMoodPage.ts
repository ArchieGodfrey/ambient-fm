import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import { createStimulusRegistryFromConfig, saveStimulusConfig } from "../stimulus/setup";
import type { ManualMoodValues, StimulusConfig, StimulusEvent } from "../types";
import type { ManualMoodStimulusPlugin } from "../stimulus/plugins/manual";
import type { StimulusRegistry } from "../stimulus/registry";
import { postToast } from "../utils/toast";

const DEFAULT_MOOD_VALUES: ManualMoodValues = {
  energy: 0.5,
  calmness: 0.5,
  tension: 0.5,
  brightness: 0.5,
};

const CUSTOM_MOOD_STORAGE_KEY = "ambientfm-custom-moods";

type MoodPreset = {
  label: string;
  moodValues: ManualMoodValues;
};

const moodPresets: MoodPreset[] = [
  {
    label: "Focused",
    moodValues: {
      energy: 0.8,
      calmness: 0.3,
      tension: 0.7,
      brightness: 0.65,
    },
  },
  {
    label: "Calm",
    moodValues: {
      energy: 0.35,
      calmness: 0.85,
      tension: 0.25,
      brightness: 0.5,
    },
  },
  {
    label: "Energetic",
    moodValues: {
      energy: 0.9,
      calmness: 0.25,
      tension: 0.8,
      brightness: 0.9,
    },
  },
  {
    label: "Balanced",
    moodValues: {
      energy: 0.6,
      calmness: 0.6,
      tension: 0.55,
      brightness: 0.6,
    },
  },
];

function normalizeEventStrength(event: StimulusEvent): StimulusEvent {
  const strength =
    typeof event.strength === "number"
      ? event.strength
      : typeof (event as any).value === "number"
      ? Math.max(0, Math.min(1, (event as any).value))
      : 0.5;

  return { ...event, strength };
}

export default function useMoodPage() {
  const { setEvents } = useAppStore();
  const [events, setLocalEvents] = useState<StimulusEvent[]>([]);
  const [configs, setConfigs] = useState<StimulusConfig[]>([]);
  const [moodValues, setMoodValues] = useState<ManualMoodValues>(DEFAULT_MOOD_VALUES);
  const [customPresets, setCustomPresets] = useState<MoodPreset[]>([]);
  const [customMoodName, setCustomMoodName] = useState("");
  const [isSavingCustomMood, setIsSavingCustomMood] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const stimulusRegistry = useRef<StimulusRegistry | null>(null);
  const manualPluginRef = useRef<ManualMoodStimulusPlugin | null>(null);
  const initialConfigsRef = useRef<StimulusConfig[] | null>(null);

  const allMoodPresets = useMemo(() => [...moodPresets, ...customPresets], [customPresets]);

  const customMoodButtonVisible = useMemo(() => {
    const originalConfigs = initialConfigsRef.current;
    if (!originalConfigs) return false;

    const originalManual = originalConfigs.find((entry) => entry.id === "manual");
    const currentManual = configs.find((entry) => entry.id === "manual");
    if (!originalManual || !currentManual) return false;

    const originalValues = originalManual.manualValues ?? DEFAULT_MOOD_VALUES;
    const nextValues = currentManual.manualValues ?? DEFAULT_MOOD_VALUES;

    return (
      originalValues.energy !== nextValues.energy ||
      originalValues.calmness !== nextValues.calmness ||
      originalValues.tension !== nextValues.tension ||
      originalValues.brightness !== nextValues.brightness
    );
  }, [configs]);

  const loadCustomMoodPresets = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const saved = window.localStorage.getItem(CUSTOM_MOOD_STORAGE_KEY);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as MoodPreset[];
      if (Array.isArray(parsed)) {
        setCustomPresets(parsed);
      }
    } catch (error) {
      console.error("Failed to load custom mood presets", error);
    }
  }, []);

  const persistCustomMoodPresets = useCallback((presets: MoodPreset[]) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(CUSTOM_MOOD_STORAGE_KEY, JSON.stringify(presets));
    } catch (error) {
      console.error("Failed to persist custom mood presets", error);
    }
  }, []);

  const loadTimelineEvents = useCallback(async () => {
    try {
      const loaded = await db.events.orderBy("timestamp").reverse().toArray();
      const normalized = loaded.map(normalizeEventStrength);
      setLocalEvents(normalized);
      setEvents(normalized);
    } catch (error) {
      console.error("Failed to load timeline events", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Failed to load timeline events: ${message}`, "error");
    }
  }, [setEvents]);

  const loadMoodConfig = useCallback(async () => {
    try {
      const { registry, configs: loadedConfigs, manual } = await createStimulusRegistryFromConfig();
      stimulusRegistry.current = registry;
      manualPluginRef.current = manual;
      setConfigs(loadedConfigs);
      initialConfigsRef.current = loadedConfigs.map((config) => ({
        ...config,
        manualValues: config.manualValues ? { ...config.manualValues } : undefined,
      }));

      const manualConfig = loadedConfigs.find((config) => config.id === "manual");
      if (manualConfig?.manualValues) {
        setMoodValues(manualConfig.manualValues);
      }

      setIsReady(true);
    } catch (error) {
      console.error("Failed to load mood config", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Failed to load mood settings: ${message}`, "error");
    }
  }, []);

  const deleteEvent = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this event?")) {
        return;
      }

      setIsDeleting(id);
      try {
        await db.events.delete(id);
        const updated = events.filter((event) => event.id !== id);
        setLocalEvents(updated);
        setEvents(updated);
        postToast("Event deleted.", "success");
      } catch (error) {
        console.error("Failed to delete event", error);
        const message = error instanceof Error ? error.message : String(error);
        postToast(`Delete failed: ${message}`, "error");
      } finally {
        setIsDeleting(null);
      }
    },
    [events, setEvents]
  );

  const handleToggleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      const registry = stimulusRegistry.current;
      if (!registry) return;

      registry.setEnabled(id, enabled);
      const updated = configs.map((config) => (config.id === id ? { ...config, enabled } : config));
      setConfigs(updated);
      await saveStimulusConfig(updated.find((config) => config.id === id)!);
    },
    [configs]
  );

  const handleUpdateWeight = useCallback(
    async (id: string, userWeight: number) => {
      const registry = stimulusRegistry.current;
      if (!registry) return;

      const config = configs.find((entry) => entry.id === id);
      if (!config) return;

      const updatedConfig = { ...config, userWeight };
      const effectiveWeight = updatedConfig.userWeight * 0.75 + updatedConfig.aiWeight * 0.25;
      registry.setWeight(id, effectiveWeight);

      const updated = configs.map((entry) => (entry.id === id ? updatedConfig : entry));
      setConfigs(updated);
      await saveStimulusConfig(updatedConfig);
    },
    [configs]
  );

  const handleMoodValueChange = useCallback(
    async (key: keyof ManualMoodValues, value: number) => {
      const nextValues = { ...moodValues, [key]: value };
      setMoodValues(nextValues);

      const manualPlugin = manualPluginRef.current;
      if (manualPlugin) {
        manualPlugin.setValues(nextValues);
      }

      const manualConfig = configs.find((config) => config.id === "manual");
      if (!manualConfig) return;

      const updatedConfig = { ...manualConfig, manualValues: nextValues };
      const updated = configs.map((entry) => (entry.id === "manual" ? updatedConfig : entry));
      setConfigs(updated);
      await saveStimulusConfig(updatedConfig);
    },
    [configs, moodValues]
  );

  const applyMoodPreset = useCallback(
    async (preset: MoodPreset) => {
      const manualPlugin = manualPluginRef.current;
      const manualConfig = configs.find((config) => config.id === "manual");
      if (!manualConfig) return;

      const nextValues = preset.moodValues;
      if (manualPlugin) {
        manualPlugin.setValues(nextValues);
      }

      setMoodValues(nextValues);

      const updatedConfig = { ...manualConfig, manualValues: nextValues };
      const updatedConfigs = configs.map((entry) => (entry.id === "manual" ? updatedConfig : entry));
      setConfigs(updatedConfigs);
      await saveStimulusConfig(updatedConfig);
      postToast(`Mood preset applied: ${preset.label}`, "success");
    },
    [configs]
  );

  const saveCustomMood = useCallback(async () => {
    const name = customMoodName.trim();
    if (!name) {
      postToast("Enter a name for the custom mood.", "error");
      return;
    }

    setIsSavingCustomMood(true);
    try {
      const manualConfig = configs.find((config) => config.id === "manual");
      const nextValues = manualConfig?.manualValues ?? moodValues;

      const customPreset: MoodPreset = {
        label: name,
        moodValues: nextValues,
      };

      const next = [customPreset, ...customPresets];
      setCustomPresets(next);
      persistCustomMoodPresets(next);
      setCustomMoodName("");
      postToast(`Custom mood saved: ${name}`, "success");
    } finally {
      setIsSavingCustomMood(false);
    }
  }, [configs, customMoodName, customPresets, moodValues, persistCustomMoodPresets]);

  useEffect(() => {
    loadTimelineEvents();
    loadMoodConfig();
    loadCustomMoodPresets();
  }, [loadTimelineEvents, loadMoodConfig, loadCustomMoodPresets]);

  return {
    allMoodPresets,
    configs,
    customMoodButtonVisible,
    customMoodName,
    customPresets,
    deleteEvent,
    events,
    handleMoodValueChange,
    handleToggleEnabled,
    handleUpdateWeight,
    applyMoodPreset,
    isDeleting,
    isReady,
    isSavingCustomMood,
    moodValues,
    saveCustomMood,
    setCustomMoodName,
  };
}
