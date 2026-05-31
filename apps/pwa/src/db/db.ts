import Dexie from "dexie";
import type { Table } from "dexie";
import type { StimulusEvent } from "../types";
import type { SessionSummary } from "../memory/types";

class AmbientDB extends Dexie {
  events!: Table<StimulusEvent, string>;
  sessions!: Table<SessionSummary, string>;

  constructor() {
    super("ambient_db");

    this.version(1).stores({
      events: "id, timestamp"
    });

    this.version(2).stores({
      events: "id, timestamp",
      sessions: "id, timestamp, dominantMood"
    });
  }
}

export const db = new AmbientDB();
