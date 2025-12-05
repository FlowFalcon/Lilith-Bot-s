const fs = require("fs");
const path = require("path");

class MessageStore {
    constructor(sessionDir) {
        this.store = new Map();
        this.storePath = path.join(sessionDir, "store-messages.json");
        this.maxMessages = 1000;
        this.saveCounter = 0;
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.storePath)) {
                const data = fs.readFileSync(this.storePath, "utf8");
                const parsed = JSON.parse(data);
                this.store = new Map(Object.entries(parsed));
            }
        } catch (err) {
            console.error(`[STORE] Load failed: ${err.message}`);
        }
    }

    save() {
        try {
            const data = Object.fromEntries(this.store);
            fs.writeFileSync(this.storePath, JSON.stringify(data));
        } catch (err) {
            console.error(`[STORE] Save failed: ${err.message}`);
        }
    }

    add(msgId, data) {
        if (this.store.size >= this.maxMessages) {
            const first = this.store.keys().next().value;
            this.store.delete(first);
        }
        this.store.set(msgId, { ...data, timestamp: Date.now() });
        this.saveCounter++;
        
        if (this.saveCounter % 10 === 0) this.save();
    }

    get(msgId) {
        return this.store.get(msgId);
    }
}

module.exports = MessageStore;