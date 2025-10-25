import fs from "fs";
import { join, resolve } from "path";
import cmd from "./command-map.js";
import chokidar from "chokidar";
import { pathToFileURL } from "url";

class CmdRegis {
    constructor(dir) {
        this.directory = resolve(dir);
    }
    async scann(dir = this.directory, result = []) {
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
                const handler = (await import(`${pathToFileURL(file).href}?update=${Date.now()}`)).default;

                if (typeof handler !== 'function' || !handler.command || !handler.command.length) {
                    console.warn(`⚠️ Plugin ${file} tidak valid (harus export function dengan property 'command')`);
                    continue;
                }

                const commandName = handler.command[0];
                const pluginData = {
                    name: commandName,
                    alias: handler.command.slice(1),
                    category: handler.tags || [],
                    desc: handler.description || (handler.help ? handler.help[0] : commandName),
                    isOwner: handler.tags && handler.tags.includes('owner'),
                    run: handler,
                };
                
                cmd.add(pluginData);
                
                const pluginMatch = file.match(/plugins\/([^/\\]+)/) || file.match(/plugins\/([^/]+)/);
                const pluginType = pluginMatch ? pluginMatch[1] : 'whatsapp';

                console.log(`✅ Loaded plugin [${pluginType}] -> ${commandName}`);
            }
            catch (e) {
                console.error(`⚠️ Error loading command from ${file}:`, e instanceof Error ? e.message : e);
            }
        }
        console.log(`\nSuccessfully loaded ${cmd.size()} commands in total!`);
    }
    async watch() {
       // console.log(`Watching WhatsApp command directory: ${this.directory}`);
        chokidar
            .watch(this.directory, { ignoreInitial: true })
            .on("add", async (path) => {
            console.log(`\x1b[33m[WATCH]\x1b[0m New WhatsApp command file detected: ${path}`);
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

export default new CmdRegis("plugins/whatsapp");
