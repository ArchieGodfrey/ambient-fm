import Dexie from "dexie";
import type { Table } from "dexie";
import type { StimulusEvent, StimulusConfig } from "../types";
import type { SessionSummary } from "../memory/types";
import type { RuntimeSnapshot } from "../memory/runtimeSnapshots";

export type VocalAudioRecord = { key: string; audio: Float32Array; sampleRate: number; timestamp: number };

class AmbientDB extends Dexie {
  events!: Table<StimulusEvent, string>;
  sessions!: Table<SessionSummary, string>;
  runtimeSnapshots!: Table<RuntimeSnapshot, string>;
  stimulusConfigs!: Table<StimulusConfig, string>;
  vocalAudio!: Table<VocalAudioRecord, string>;

  constructor() {
    super("ambient_db");

    this.version(1).stores({
      events: "id, timestamp"
    });

    this.version(2).stores({
      events: "id, timestamp",
      sessions: "id, timestamp, dominantMood"
    });

    this.version(3).stores({
      events: "id, timestamp",
      sessions: "id, timestamp, dominantMood"
    });

    this.version(4).stores({
      events: "id, timestamp",
      sessions: "id, timestamp, dominantMood",
      runtimeSnapshots: "id, timestamp"
    });

    this.version(5).stores({
      events: "id, timestamp",
      sessions: "id, timestamp, dominantMood",
      runtimeSnapshots: "id, timestamp",
      stimulusConfigs: "id"
    });

    this.version(6).stores({
      events: "id, timestamp",
      sessions: "id, timestamp, dominantMood",
      runtimeSnapshots: "id, timestamp",
      stimulusConfigs: "id",
      vocalAudio: "key, timestamp"
    });
  }
}

export const db = new AmbientDB();
