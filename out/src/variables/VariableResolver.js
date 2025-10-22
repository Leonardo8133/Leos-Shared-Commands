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
exports.VariableResolver = void 0;
const vscode = __importStar(require("vscode"));
const ConfigManager_1 = require("../config/ConfigManager");
const errors_1 = require("./errors");
class VariableResolver {
    constructor() {
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
    }
    static getInstance() {
        if (!VariableResolver.instance) {
            VariableResolver.instance = new VariableResolver();
        }
        return VariableResolver.instance;
    }
    extractPlaceholders(commandText) {
        const placeholders = new Set();
        const regex = /\$\{?([A-Za-z0-9_]+)\}?/g;
        let match;
        while ((match = regex.exec(commandText)) !== null) {
            if (match[1]) {
                placeholders.add(match[1]);
            }
        }
        return Array.from(placeholders);
    }
    getAvailableVariables() {
        const config = this.configManager.getConfig();
        const variables = [];
        (config.sharedVariables || []).forEach((variable) => {
            variables.push({
                key: variable.key,
                label: variable.label,
                type: 'fixed',
                description: variable.description,
                value: variable.value
            });
        });
        (config.sharedLists || []).forEach((list) => {
            variables.push({
                key: list.key,
                label: list.label,
                type: 'options',
                description: list.description,
                options: list.options
            });
        });
        return variables;
    }
    async resolveCommandVariables(command) {
        const placeholders = this.extractPlaceholders(command.command);
        if (placeholders.length === 0) {
            return [];
        }
        const config = this.configManager.getConfig();
        const variableMap = new Map((config.sharedVariables || []).map(v => [v.key, v]));
        const listMap = new Map((config.sharedLists || []).map(l => [l.key, l]));
        const commandVariables = new Map();
        (command.variables || []).forEach(variable => {
            commandVariables.set(variable.key, variable);
        });
        const resolved = [];
        for (const key of placeholders) {
            // Handle manual input variable
            if (key === 'input') {
                const userInput = await vscode.window.showInputBox({
                    prompt: 'Enter input for the command',
                    placeHolder: 'Type your input here (can be empty)',
                    value: ''
                });
                if (userInput === undefined) {
                    throw new errors_1.UserCancelledError();
                }
                resolved.push({ key, value: userInput || '' });
                continue;
            }
            const variableDefinition = commandVariables.get(key);
            const sharedVariable = variableMap.get(key);
            const sharedList = listMap.get(key);
            const type = variableDefinition?.type || (sharedList ? 'options' : sharedVariable ? 'fixed' : undefined);
            if (!type) {
                throw new errors_1.MissingVariableError(key);
            }
            if (type === 'fixed') {
                if (variableDefinition) {
                    resolved.push({ key, value: variableDefinition.value });
                }
                else if (sharedVariable) {
                    resolved.push({ key, value: sharedVariable.value });
                }
                else {
                    throw new errors_1.MissingVariableError(key);
                }
                continue;
            }
            if (type === 'options') {
                let options = [];
                let quickPickLabel = key;
                if (variableDefinition) {
                    // Use command variable options
                    options = variableDefinition.value.split('\n').filter(opt => opt.trim());
                    quickPickLabel = variableDefinition.label || key;
                }
                else if (sharedList) {
                    // Use shared list options
                    options = sharedList.options;
                    quickPickLabel = sharedList.label || key;
                }
                else {
                    throw new errors_1.MissingVariableError(key);
                }
                // Add custom input option to the list
                const customInputOption = '✏️ Custom Input...';
                const allOptions = [customInputOption, ...options];
                const selection = await vscode.window.showQuickPick(allOptions, {
                    placeHolder: `Select ${quickPickLabel} or choose custom input`
                });
                if (!selection) {
                    throw new errors_1.UserCancelledError();
                }
                let finalValue = selection;
                // If custom input was selected, prompt for manual input
                if (selection === customInputOption) {
                    const customInput = await vscode.window.showInputBox({
                        prompt: `Enter custom value for ${quickPickLabel}`,
                        placeHolder: 'Type your custom option here',
                        value: ''
                    });
                    if (customInput === undefined) {
                        throw new errors_1.UserCancelledError();
                    }
                    finalValue = customInput || '';
                }
                resolved.push({ key, value: finalValue });
                continue;
            }
        }
        return resolved;
    }
    dispose() {
        // No-op for compatibility with previous implementation
    }
}
exports.VariableResolver = VariableResolver;
//# sourceMappingURL=VariableResolver.js.map