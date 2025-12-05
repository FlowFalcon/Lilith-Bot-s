const fs = require("fs");
const { join, resolve } = require("path");
const cmd = require("./command-map.js");
const chokidar = require("chokidar");

class CmdRegis {
    constructor(dir) {
        this.directory = resolve(dir);
    }
    async scann(dir = this.directory, result = []) {
        if (!fs.existsSync(dir)) return result;
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = join(dir, file.name);
            if (file.isDirectory()) {
                await this.scann(fullPath, result);
            }
            else if (file.isFile() &&
                (file.name.endsWith(".ts") || file.name.endsWith(".js"))) {
                result.push(fullPath);
            }
        }
        return result;
    }
    async load() {
        cmd.reset();
        const files = await this.scann();
        for (let file of files) {
            try {
                delete require.cache[require.resolve(file)];
                const handler = require(file);
                const isCommand = handler.command && handler.command.length;
                const isMiddleware = typeof handler.middleware === 'function' || typeof handler.before === 'function';

                if (typeof handler !== 'function' || (!isCommand && !isMiddleware)) {
                    console.warn(`⚠️ Plugin ${file} diskip (tidak ada 'command' atau 'middleware')`);
                    continue;
                }

                const commandName = isCommand ? handler.command[0] : `_middleware_${Date.now()}_${Math.random()}`;
                
                const pluginData = {
                    name: commandName,
                    alias: isCommand ? handler.command.slice(1) : [],
                    category: handler.tags || [],
                    desc: handler.description || (handler.help ? handler.help[0] : commandName),
                    isOwner: handler.isOwner || (handler.tags && handler.tags.includes('owner')) || false,
                    isAdmin: handler.isAdmin || false,
                    isBotAdmin: handler.isBotAdmin || false,
                    isGroup: handler.isGroup || false,
                    isPrivate: handler.isPrivate || false,
                    middleware: handler.middleware || handler.before, 
                    run: handler,
                };
                
                cmd.add(pluginData);
                if (isCommand) {
                    const pluginMatch = file.match(/plugins\/([^/\\]+)/) || file.match(/plugins\/([^/]+)/);
                    const pluginType = pluginMatch ? pluginMatch[1] : 'whatsapp';
                    // console.log(`✅ Loaded plugin [${pluginType}] -> ${commandName}`);
                }
            }
            catch (e) {
                console.error(`⚠️ Error loading command from ${file}:`, e instanceof Error ? e.message : e);
            }
        }
        console.log(`✅ [WHATSAPP] Loaded ${cmd.size()} plugins.`);
    }
    async watch() {
       // console.log(`Watching WhatsApp command directory: ${this.directory}`);
        chokidar
            .watch(this.directory, { ignoreInitial: true })
            .on("add", async (path) => {
            console.log(`\x1b[33m[WATCH]\x1b[0m New WhatsApp command file: ${path}`);
            await this.reloadCommands();
        })
            .on("change", async (path) => {
            console.log(`\x1b[33m[WATCH]\x1b[0m WhatsApp command file changed: ${path}`);
            await this.reloadCommands();
        })
            .on("unlink", async (path) => {
            console.log(`\x1b[33m[WATCH]\x1b[0m WhatsApp command file deleted: ${path}`);
            await this.reloadCommands();
        });
    }
    async reloadCommands() {
        try {
            await this.load();
            console.log(`\x1b[32m[SUCCESS]\x1b[0m WhatsApp commands reloaded successfully!`);
        } catch (error) {
            console.error(`\x1b[31m[ERROR]\x1b[0m Failed to reload WhatsApp commands:`, error);
        }
    }
}

module.exports = new CmdRegis("plugins/whatsapp");