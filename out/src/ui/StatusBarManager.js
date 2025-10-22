"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    constructor(context, treeProvider, configManager) {
        this.context = context;
        this.treeProvider = treeProvider;
        this.configManager = configManager;
        this.pinnedItems = new Map();
        this.pinnedCommandIds = [];
        this.storageKey = 'commandManager.pinnedCommands';
        this.mainItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.mainItem.text = '$(rocket) Commands';
        this.mainItem.tooltip = 'Command Manager';
        this.mainItem.command = undefined;
        this.mainItem.show();
        this.context.subscriptions.push(this.mainItem);
        this.configManager.setOnConfigChange(() => {
            void this.handleConfigChange();
        });
        void this.restorePinnedCommands();
        void this.updateCommandsTooltip();
    }
    dispose() {
        this.disposePinnedItems();
        this.mainItem.dispose();
    }
    isPinned(commandId) {
        return this.pinnedCommandIds.includes(commandId);
    }
    async togglePin(command) {
        if (this.isPinned(command.id)) {
            this.pinnedCommandIds = this.pinnedCommandIds.filter(id => id !== command.id);
            await this.context.globalState.update(this.storageKey, this.pinnedCommandIds);
            await this.rebuildPinnedItems();
            void vscode.window.showInformationMessage(`Removed "${command.label}" from the status bar.`);
            return false;
        }
        this.pinnedCommandIds.push(command.id);
        await this.context.globalState.update(this.storageKey, this.pinnedCommandIds);
        await this.rebuildPinnedItems();
        void vscode.window.showInformationMessage(`Pinned "${command.label}" to the status bar.`);
        return true;
    }
    async updateCommandsTooltip() {
        const markdown = this.buildTooltipMarkdown();
        this.mainItem.tooltip = markdown;
    }
    async handleConfigChange() {
        await this.rebuildPinnedItems();
    }
    async restorePinnedCommands() {
        const stored = this.context.globalState.get(this.storageKey, []);
        if (Array.isArray(stored)) {
            this.pinnedCommandIds = Array.from(new Set(stored));
        }
        await this.rebuildPinnedItems();
    }
    async rebuildPinnedItems() {
        const commands = await this.treeProvider.getAllCommands();
        const commandsById = new Map(commands.map(command => [command.id, command]));
        this.disposePinnedItems();
        this.pinnedCommandIds = this.pinnedCommandIds.filter(id => commandsById.has(id));
        await this.context.globalState.update(this.storageKey, this.pinnedCommandIds);
        this.pinnedCommandIds.forEach((id, index) => {
            const command = commandsById.get(id);
            if (command) {
                this.createPinnedItem(command, index);
            }
        });
        await this.updateCommandsTooltip();
    }
    createPinnedItem(command, index) {
        const priority = 100 - (index + 1);
        const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
        item.text = `$(pin) ${command.label}`;
        item.tooltip = `Run ${command.label}`;
        item.command = {
            command: 'commandManager.runCommandById',
            title: 'Run Command',
            arguments: [command.id]
        };
        item.show();
        this.context.subscriptions.push(item);
        this.pinnedItems.set(command.id, item);
    }
    disposePinnedItems() {
        for (const item of this.pinnedItems.values()) {
            item.dispose();
        }
        this.pinnedItems.clear();
    }
    buildTooltipMarkdown() {
        const markdown = new vscode.MarkdownString(undefined, true);
        markdown.isTrusted = true;
        const config = this.configManager.getConfig();
        if (!config.folders || config.folders.length === 0) {
            markdown.appendText('No commands available yet.');
            return markdown;
        }
        const lines = [];
        const appendFolder = (folder, depth) => {
            const indent = '  '.repeat(depth);
            lines.push(`${indent}- **${this.escapeMarkdown(folder.name)}**`);
            const commands = [...folder.commands].reverse();
            commands.forEach(command => {
                const commandUri = this.buildCommandUri(command.id);
                const commandIndent = '  '.repeat(depth + 1);
                lines.push(`${commandIndent}- [${this.escapeMarkdown(command.label)}](${commandUri})`);
            });
            const subfolders = folder.subfolders ? [...folder.subfolders].reverse() : [];
            subfolders.forEach(subfolder => appendFolder(subfolder, depth + 1));
        };
        const rootFolders = [...config.folders].reverse();
        rootFolders.forEach(folder => appendFolder(folder, 0));
        markdown.appendMarkdown(lines.join('\n'));
        return markdown;
    }
    buildCommandUri(commandId) {
        const args = encodeURIComponent(JSON.stringify({ commandId }));
        return `command:commandManager.runCommandById?${args}`;
    }
    escapeMarkdown(value) {
        return value.replace(/([*_`\\\[\]])/g, '\\$1');
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=StatusBarManager.js.map