const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { logError } = require("../logger.js");

function normalizeCmd(mod, filename) {
  const plugin = mod.default || mod;

  if (typeof plugin === 'object' && plugin.name && typeof plugin.run === 'function') {
    plugin.options  ||= [];
    plugin.permissions ||= {};
    return plugin;
  }

  if (typeof plugin === 'function') {
    const commandName = plugin.command?.[0] || plugin.name;

    if (!commandName || commandName === 'handler') {
      console.warn(`⚠️ Plugin ${filename} tidak memiliki nama command yang valid.`);
      return null;
    }

    return {
      name: commandName,
      description: plugin.description || plugin.help?.[0] || commandName,
      aliases: plugin.command?.slice(1) || plugin.aliases || [],
      tags: plugin.tags || [],
      options: plugin.options || [],
      permissions: plugin.permissions || {},
      run: plugin,
      setup: plugin.setup
    };
  }

  console.warn(`⚠️ Plugin ${filename} tidak valid. Format tidak dikenali.`);
  return null;
}


class CommandRegister {
    constructor(bot) {
        this.bot = bot;
        this.directory = path.resolve(__dirname, "..", "..", "plugins", "telegram");
        if (!this.bot.commands) {
            this.bot.commands = new Map();
        }
        this.telegramCommands = new Map();
    }

    async loadCommands() {
        for (const [name] of this.telegramCommands) {
            this.bot.commands.delete(name);
        }
        this.telegramCommands.clear();
        
        const commands = [];

        if (!fs.existsSync(this.directory)) return commands;

        const files = fs.readdirSync(this.directory).filter(f => f.endsWith(".js"));

        for (const file of files) {
            const pluginPath = path.join(this.directory, file);
            try {
                delete require.cache[require.resolve(pluginPath)];
                const mod = require(pluginPath);
                const plugin = normalizeCmd(mod, file);
                
                if (plugin) {
                    this.bot.commands.set(plugin.name.toLowerCase(), plugin);
                    this.telegramCommands.set(plugin.name.toLowerCase(), plugin);
                    if (plugin.aliases) {
                        for (const alias of plugin.aliases) {
                            this.bot.commands.set(alias.toLowerCase(), plugin);
                            this.telegramCommands.set(alias.toLowerCase(), plugin);
                        }
                    }
                    if (typeof plugin.setup === "function") await plugin.setup(this.bot, "telegram");
                    commands.push(plugin);
                    console.log(`✅ Loaded plugin [telegram] -> ${plugin.name}`);
                }
            } catch (err) {
                console.error(`❌ Gagal load plugin ${file}:`, err);
            }
        }
        
        console.log(`\nSuccessfully loaded ${this.telegramCommands.size} telegram commands in total!`);
        await this.registerToApi(commands);
        return commands;
    }

    async registerToApi(commands) {
        const tgCommands = commands.map(c => ({ command: c.name, description: (c.description || c.name).slice(0, 256) }));
        if (tgCommands.length) {
            try {
                await this.bot.telegram.setMyCommands(tgCommands);
                console.log(`[TELEGRAM] Registered ${tgCommands.length} commands.`);
            } catch (e) {
                logError("telegram:setMyCommands", e);
            }
        }
    }

    watch() {
        chokidar.watch(this.directory, { ignoreInitial: true })
            .on("add", async (path) => {
                console.log(`\x1b[33m[WATCH]\x1b[0m New Telegram command file detected: ${path}`);
                await this.reloadCommands();
            })
            .on("change", async (path) => {
                console.log(`\x1b[33m[WATCH]\x1b[0m Telegram command file changed: ${path}`);
                await this.reloadCommands();
            })
            .on("unlink", async (path) => {
                console.log(`\x1b[33m[WATCH]\x1b[0m Telegram command file deleted: ${path}`);
                await this.reloadCommands();
            });
    }

    async reloadCommands() {
        try {
            await this.loadCommands();
            console.log(`\x1b[32m[SUCCESS]\x1b[0m Telegram commands reloaded successfully!`);
        } catch (error) {
            console.error(`\x1b[31m[ERROR]\x1b[0m Failed to reload Telegram commands:`, error);
        }
    }
}

module.exports = CommandRegister;