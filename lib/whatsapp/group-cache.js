class GroupCache {
    constructor(ttl = 5 * 60 * 1000) { 
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(id, data) {
        this.cache.set(id, { data, timestamp: Date.now() });
    }

    get(id) {
        const item = this.cache.get(id);
        if (!item) return null;
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(id);
            return null;
        }
        return item.data;
    }

    startAutoCleanup(interval = 10 * 60 * 1000) {
        setInterval(() => {
            const now = Date.now();
            for (const [id, item] of this.cache.entries()) {
                if (now - item.timestamp > this.ttl) {
                    this.cache.delete(id);
                }
            }
        }, interval);
    }
}

module.exports = GroupCache;