class CmdMap {
    constructor() {
        this.commands = [];
    }
    values() {
        return this.commands;
    }
    add(content) {
        this.commands.push(content);
    }
    reset() {
        this.commands = [];
    }
    size() {
        return this.commands.length;
    }
}
export default new CmdMap();
