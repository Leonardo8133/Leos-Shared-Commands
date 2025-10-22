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
exports.CommandTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
class CommandTreeItem extends vscode.TreeItem {
    constructor(item, type, parent, path = [], commandIndex) {
        super(type === 'folder' ? item.name : item.label, type === 'folder' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.item = item;
        this.type = type;
        this.parent = parent;
        this.path = path;
        this.commandIndex = commandIndex;
        this._executionState = types_1.ExecutionState.Idle;
        this.contextValue = type;
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.description = this.getDescription();
    }
    get executionState() {
        return this._executionState;
    }
    set executionState(state) {
        this._executionState = state;
        this.iconPath = this.getIcon();
    }
    getTooltip() {
        if (this.type === 'command') {
            const command = this.item;
            return `${command.label}\n${command.description || command.command}`;
        }
        else {
            const folder = this.item;
            return folder.name;
        }
    }
    getIcon() {
        if (this.type === 'folder') {
            const folder = this.item;
            if (folder.icon) {
                const iconName = folder.icon.startsWith('$(') && folder.icon.endsWith(')')
                    ? folder.icon.slice(2, -1)
                    : folder.icon;
                return new vscode.ThemeIcon(iconName);
            }
            return new vscode.ThemeIcon('folder');
        }
        else {
            const command = this.item;
            // Override icon based on execution state
            switch (this._executionState) {
                case types_1.ExecutionState.Running:
                    return new vscode.ThemeIcon('sync~spin');
                case types_1.ExecutionState.Success:
                    return new vscode.ThemeIcon('check');
                case types_1.ExecutionState.Error:
                    return new vscode.ThemeIcon('error');
            }
            // Default icon (when idle)
            if (command.icon && command.icon.trim()) {
                const iconName = command.icon.startsWith('$(') && command.icon.endsWith(')')
                    ? command.icon.slice(2, -1)
                    : command.icon;
                return new vscode.ThemeIcon(iconName);
            }
            // Fallback to terminal type icons
            switch (command.terminal.type) {
                case 'vscode-current':
                    return new vscode.ThemeIcon('terminal');
                case 'vscode-new':
                    return new vscode.ThemeIcon('add');
                case 'external-cmd':
                    return new vscode.ThemeIcon('console');
                case 'external-powershell':
                    return new vscode.ThemeIcon('terminal-powershell');
                default:
                    return new vscode.ThemeIcon('play');
            }
        }
    }
    getDescription() {
        if (this.type === 'command') {
            const command = this.item;
            return command.terminal.type;
        }
        else {
            const folder = this.item;
            return `${folder.commands.length} commands`;
        }
    }
    getCommand() {
        return this.type === 'command' ? this.item : undefined;
    }
    getFolder() {
        return this.type === 'folder' ? this.item : undefined;
    }
    isCommand() {
        return this.type === 'command';
    }
    isFolder() {
        return this.type === 'folder';
    }
    getFolderPath() {
        return [...this.path];
    }
    getCommandIndex() {
        return this.commandIndex;
    }
}
exports.CommandTreeItem = CommandTreeItem;
//# sourceMappingURL=CommandTreeItem.js.map