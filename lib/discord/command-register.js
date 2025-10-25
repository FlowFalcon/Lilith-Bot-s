import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chokidar from "chokidar";
import { REST, Routes, ApplicationCommandOptionType } from "discord.js";
import { logError } from "../logger.js";
import config from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeCmd(mod, filename) {
  const plugin = mod.default || mod;

  // Handle object export format: module.exports = { name: '...', run: ... }
  if (typeof plugin === 'object' && plugin.name && typeof plugin.run === 'function') {
    plugin.options  ||= [];
    plugin.permissions ||= {};
    return plugin;
  }

  // Handle function export format: module.exports = handler; handler.command = [...]
  if (typeof plugin === 'function') {
    const commandName = plugin.command?.[0] || plugin.name;

    if (!commandName || commandName === 'handler') {
      console.warn(`⚠️ Plugin ${filename} tidak memiliki nama command yang valid.`);
      return null;
    }

    const tags = plugin.tags || [];
    const permissions = plugin.permissions || {};
    if (tags.includes('owner')) {
        permissions.ownerOnly = true;
    }

    // Adapt the function to the object structure
    return {
      name: commandName,
      description: plugin.description || plugin.help?.[0] || commandName,
      aliases: plugin.command?.slice(1) || plugin.aliases || [],
      tags: tags,
      options: plugin.options || [],
      permissions: permissions,
      run: plugin, // The function itself is the run logic
      setup: plugin.setup
    };
  }

  console.warn(`⚠️ Plugin ${filename} tidak valid. Format tidak dikenali.`);
  return null;
}


function typeToDiscord(t) {
  return ({
    string: ApplicationCommandOptionType.String,
    integer: ApplicationCommandOptionType.Integer,
    number: ApplicationCommandOptionType.Number,
    boolean: ApplicationCommandOptionType.Boolean,
    user: ApplicationCommandOptionType.User,
    channel: ApplicationCommandOptionType.Channel,
    role: ApplicationCommandOptionType.Role,
    attachment: ApplicationCommandOptionType.Attachment,
  }[t]) || ApplicationCommandOptionType.String;
}

class CommandRegister {
    constructor(bot) {
        this.bot = bot;
        this.directory = path.resolve(__dirname, "..", "..", "plugins", "discord");
        if (!this.bot.commands) {
            this.bot.commands = new Map();
        }
    }

    async loadCommands() {
        this.bot.commands.clear();
        const commands = [];

        if (!fs.existsSync(this.directory)) return commands;

        const files = fs.readdirSync(this.directory).filter(f => f.endsWith(".js"));

        for (const file of files) {
            const pluginPath = path.join(this.directory, file);
            try {
                const mod = await import(`file://${pluginPath}?update=${Date.now()}`);
                const plugin = normalizeCmd(mod, file);

                if (plugin) {
                    this.bot.commands.set(plugin.name.toLowerCase(), plugin);
                    if (plugin.aliases) {
                        for (const alias of plugin.aliases) {
                            this.bot.commands.set(alias.toLowerCase(), plugin);
                        }
                    }
                    if (typeof plugin.setup === "function") await plugin.setup(this.bot, "discord");
                    commands.push(plugin);
                    console.log(`✅ Loaded plugin [discord] -> ${plugin.name}`);
                }
            } catch (err) {
                console.error(`❌ Gagal load plugin ${file}:`, err);
            }
        }
        
        console.log(`\nSuccessfully loaded ${this.bot.commands.size} discord commands in total!`);
        await this.registerToApi(commands);
        return commands;
    }

    async registerToApi(commands) {
        const discordSlash = commands.map(c => ({
            name: c.name,
            description: c.description || c.name,
            dm_permission: true,
            options: (c.options || []).map(o => ({
                name: o.name,
                description: o.description || o.name,
                type: typeToDiscord(o.type),
                required: !!o.required,
                choices: o.choices?.map(ch => ({ name: String(ch.name ?? ch), value: ch.value ?? ch })) || undefined,
                min_value: o.min,
                max_value: o.max,
            }))
        }));
        
        const rest = new REST({ version: "10" }).setToken(config.discordToken);

        try {
            if (config.discordGuildId) {
                await rest.put(
                    Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
                    { body: discordSlash }
                );
                console.log(`[DISCORD] Replaced ${discordSlash.length} guild commands.`);
            } else {
                await rest.put(Routes.applicationCommands(config.discordClientId), {
                    body: discordSlash,
                });
                console.log(`[DISCORD] Replaced ${discordSlash.length} global commands.`);
            }
        } catch (e) {
            logError("discord:registerSlash", e);
        }
    }

    watch() {
        chokidar.watch(this.directory, { ignoreInitial: true })
            .on("add", async (path) => {
                console.log(`\x1b[33m[WATCH]\x1b[0m New Discord command file detected: ${path}`);
                await this.reloadCommands();
            })
            .on("change", async (path) => {
                console.log(`\x1b[33m[WATCH]\x1b[0m Discord command file changed: ${path}`);
                await this.reloadCommands();
            })
            .on("unlink", async (path) => {
                console.log(`\x1b[33m[WATCH]\x1b[0m Discord command file deleted: ${path}`);
                await this.reloadCommands();
            });
    }

    async reloadCommands() {
        try {
            await this.loadCommands();
            console.log(`\x1b[32m[SUCCESS]\x1b[0m Discord commands reloaded successfully!`);
        } catch (error) {
            console.error(`\x1b[31m[ERROR]\x1b[0m Failed to reload Discord commands:`, error);
        }
    }
}

export default CommandRegister;