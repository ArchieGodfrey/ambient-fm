import Dexie from "dexie";
class AmbientDB extends Dexie {
    events;
    constructor() {
        super("ambient_db");
        this.version(1).stores({
            events: "id, timestamp"
        });
    }
}
export const db = new AmbientDB();
