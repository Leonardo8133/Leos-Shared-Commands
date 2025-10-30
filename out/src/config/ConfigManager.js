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
exports.ConfigManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const schema_1 = require("./schema");
class ConfigManager {
    constructor() {
        this.onConfigChangeCallbacks = [];
        this.configPath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.vscode', 'commands.json');
        this.config = (0, schema_1.getDefaultConfig)();
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    async initialize() {
        await this.loadConfig();
        this.setupFileWatcher();
        // Ensure initial consumers refresh with loaded config
        this.notifyConfigChange();
    }
    getConfig() {
        return this.config;
    }
    async saveConfig(config) {
        const validation = (0, schema_1.validateConfig)(config);
        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }
        // Save version before updating
        await this.saveConfigVersion(this.config);
        // Update version and timestamp
        const version = (this.config.version || 0) + 1;
        config.version = version;
        config.lastModified = new Date().toISOString();
        // Ensure .vscode directory exists
        const vscodeDir = path.dirname(this.configPath);
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }
        const configJson = JSON.stringify(config, null, 2);
        await fs.promises.writeFile(this.configPath, configJson, 'utf8');
        this.config = config;
        this.notifyConfigChange();
    }
    async loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = await fs.promises.readFile(this.configPath, 'utf8');
                const parsedConfig = JSON.parse(configData);
                const validation = (0, schema_1.validateConfig)(parsedConfig);
                if (validation.valid) {
                    this.config = parsedConfig;
                    // Ensure testRunners array exists and has at least one default config
                    if (!this.config.testRunners || this.config.testRunners.length === 0) {
                        this.config.testRunners = [(0, schema_1.getDefaultTestRunnerConfig)()];
                        // Save the updated config with default test runner
                        await this.saveConfig(this.config);
                    }
                }
                else {
                    vscode.window.showWarningMessage(`Invalid configuration file: ${validation.errors.join(', ')}. Using default configuration.`);
                    this.config = (0, schema_1.getDefaultConfig)();
                }
            }
            else {
                // Create default config file
                await this.saveConfig((0, schema_1.getDefaultConfig)());
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load configuration: ${error}`);
            this.config = (0, schema_1.getDefaultConfig)();
        }
    }
    getConfigPath() {
        return this.configPath;
    }
    setOnConfigChange(callback) {
        this.onConfigChangeCallbacks.push(callback);
    }
    setupFileWatcher() {
        this.watcher = vscode.workspace.createFileSystemWatcher(this.configPath);
        this.watcher.onDidChange(async () => {
            await this.loadConfig();
            this.notifyConfigChange();
        });
        this.watcher.onDidCreate(async () => {
            await this.loadConfig();
            this.notifyConfigChange();
        });
        this.watcher.onDidDelete(async () => {
            this.config = (0, schema_1.getDefaultConfig)();
            this.notifyConfigChange();
        });
    }
    dispose() {
        this.watcher?.dispose();
    }
    async openConfigFile() {
        const uri = vscode.Uri.file(this.configPath);
        await vscode.window.showTextDocument(uri);
    }
    async createBackup() {
        const backupPath = `${this.configPath}.backup.${Date.now()}`;
        await fs.promises.copyFile(this.configPath, backupPath);
        return backupPath;
    }
    async restoreFromBackup(backupPath) {
        const backupData = await fs.promises.readFile(backupPath, 'utf8');
        const parsedConfig = JSON.parse(backupData);
        await this.saveConfig(parsedConfig);
    }
    notifyConfigChange() {
        for (const callback of this.onConfigChangeCallbacks) {
            try {
                callback();
            }
            catch (error) {
                console.warn('Config change callback failed', error);
            }
        }
    }
    async importCommands(filePath) {
        const importData = await fs.promises.readFile(filePath, 'utf8');
        const parsedConfig = JSON.parse(importData);
        const validation = (0, schema_1.validateConfig)(parsedConfig);
        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }
        await this.saveConfig(parsedConfig);
    }
    async exportCommands(filePath) {
        const configJson = JSON.stringify(this.config, null, 2);
        await fs.promises.writeFile(filePath, configJson, 'utf8');
    }
    async saveConfigVersion(config) {
        const versionsPath = path.join(path.dirname(this.configPath), 'commands-versions.json');
        let versions = [];
        try {
            if (fs.existsSync(versionsPath)) {
                const versionsData = await fs.promises.readFile(versionsPath, 'utf8');
                versions = JSON.parse(versionsData);
            }
        }
        catch (error) {
            console.warn('Failed to load versions file:', error);
        }
        // Add current config as version
        versions.push({
            version: config.version || 0,
            timestamp: config.lastModified || new Date().toISOString(),
            config: { ...config }
        });
        // Keep only last 5 versions
        if (versions.length > 5) {
            versions = versions.slice(-5);
        }
        // Save versions
        try {
            await fs.promises.writeFile(versionsPath, JSON.stringify(versions, null, 2), 'utf8');
        }
        catch (error) {
            console.warn('Failed to save versions file:', error);
        }
    }
    async getConfigVersions() {
        const versionsPath = path.join(path.dirname(this.configPath), 'commands-versions.json');
        try {
            if (fs.existsSync(versionsPath)) {
                const versionsData = await fs.promises.readFile(versionsPath, 'utf8');
                return JSON.parse(versionsData);
            }
        }
        catch (error) {
            console.warn('Failed to load versions file:', error);
        }
        return [];
    }
    async restoreConfigVersion(version) {
        const versions = await this.getConfigVersions();
        const targetVersion = versions.find(v => v.version === version);
        if (targetVersion) {
            await this.saveConfig(targetVersion.config);
        }
        else {
            throw new Error(`Version ${version} not found`);
        }
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=ConfigManager.js.map