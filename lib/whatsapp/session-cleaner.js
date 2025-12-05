const fs = require("fs");
const path = require("path");

class SessionCleaner {
    constructor(sessionDir) {
        this.sessionDir = sessionDir;
        this.keepFiles = ["creds.json", "messages.json"];
        this.keepPatterns = [
            /^app-state-sync-key-.*\.json$/,
            /^pre-key-.*\.json$/,
            /^sender-key-.*\.json$/
        ];
    }

    shouldKeep(filename) {
        if (this.keepFiles.includes(filename)) return true;
        return this.keepPatterns.some(pattern => pattern.test(filename));
    }

    clean() {
        try {
            if (!fs.existsSync(this.sessionDir)) return;
            const files = fs.readdirSync(this.sessionDir);
            let removed = 0;

            for (const file of files) {
                const filePath = path.join(this.sessionDir, file);
                const stat = fs.statSync(filePath);

                if (stat.isFile() && !this.shouldKeep(file)) {
                    fs.unlinkSync(filePath);
                    removed++;
                }
            }
            if (removed > 0) console.log(`[SESSION] Cleaned ${removed} files.`);
        } catch (err) {
            console.error(`[SESSION] Cleanup failed: ${err.message}`);
        }
    }

    startAutoClean(intervalMs = 3600000) {
        setInterval(() => this.clean(), intervalMs);
    }
}

module.exports = SessionCleaner;