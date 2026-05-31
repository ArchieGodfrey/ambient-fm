import Dexie from "dexie";
import type { Table } from "dexie";
import type { StimulusEvent } from "../types";

class AmbientDB extends Dexie {
  events!: Table<StimulusEvent, string>;

  constructor() {
    super("ambient_db");

    this.version(1).stores({
      events: "id, timestamp"
    });
  }
}

export const db = new AmbientDB();
