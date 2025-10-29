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
exports.TestRunnerManager = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const ConfigManager_1 = require("../config/ConfigManager");
const TerminalManager_1 = require("../execution/TerminalManager");
class TestRunnerManager {
    constructor() {
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
        this.terminalManager = TerminalManager_1.TerminalManager.getInstance();
        this._onDidChange = new vscode.EventEmitter();
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{js,jsx,ts,tsx,mjs,cjs,cts,mts,py}');
        this.configManager.setOnConfigChange(() => this._onDidChange.fire());
        const refresh = () => this._onDidChange.fire();
        this.fileWatcher.onDidChange(refresh);
        this.fileWatcher.onDidCreate(refresh);
        this.fileWatcher.onDidDelete(refresh);
    }
    static getInstance() {
        if (!TestRunnerManager.instance) {
            TestRunnerManager.instance = new TestRunnerManager();
        }
        return TestRunnerManager.instance;
    }
    dispose() {
        this.fileWatcher.dispose();
        this._onDidChange.dispose();
    }
    get onDidChange() {
        return this._onDidChange.event;
    }
    getConfigs() {
        const config = this.configManager.getConfig();
        return [...(config.testRunners ?? [])];
    }
    getConfigById(id) {
        return this.getConfigs().find(entry => entry.id === id);
    }
    async saveConfig(runner) {
        await this.updateConfigs(configs => {
            const index = configs.findIndex(existing => existing.id === runner.id);
            if (index >= 0) {
                configs[index] = { ...runner };
            }
            else {
                configs.push({ ...runner });
            }
            return configs;
        });
    }
    async deleteConfig(id) {
        await this.updateConfigs(configs => configs.filter(config => config.id !== id));
    }
    async moveConfig(id, newIndex) {
        await this.updateConfigs(configs => {
            const index = configs.findIndex(config => config.id === id);
            if (index === -1 || newIndex < 0 || newIndex >= configs.length) {
                return configs;
            }
            const [item] = configs.splice(index, 1);
            configs.splice(newIndex, 0, item);
            return configs;
        });
    }
    async toggleActivation(id) {
        await this.setActivation(id, undefined);
    }
    async setActivation(id, activated) {
        await this.updateConfigs(configs => {
            const index = configs.findIndex(config => config.id === id);
            if (index === -1) {
                return configs;
            }
            const current = configs[index];
            const nextState = typeof activated === 'boolean' ? activated : !current.activated;
            configs[index] = { ...current, activated: nextState };
            return configs;
        });
    }
    async addIgnoredTest(configId, testName) {
        await this.updateConfigs(configs => {
            const index = configs.findIndex(config => config.id === configId);
            if (index === -1) {
                return configs;
            }
            const current = configs[index];
            const existing = (current.ignoreList ?? '')
                .split(/\r?\n/)
                .map(value => value.trim())
                .filter(Boolean);
            if (!existing.includes(testName)) {
                existing.push(testName);
            }
            configs[index] = { ...current, ignoreList: existing.join('\n') };
            return configs;
        });
    }
    async discoverTests(config) {
        if (!(vscode.workspace.workspaceFolders?.length)) {
            return [];
        }
        if (!config.activated) {
            return [];
        }
        const includeGlob = this.getGlobForFileType(config.fileType);
        const excludeGlob = '**/{node_modules,.git,.venv,.pytest_cache,.mypy_cache}/**';
        const files = await vscode.workspace.findFiles(includeGlob, excludeGlob);
        const filePatterns = this.createPatternSet(config.fileNamePattern);
        const results = [];
        for (const file of files) {
            const basename = path.basename(file.fsPath);
            if (!this.matchesAnyPattern(basename, filePatterns)) {
                continue;
            }
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const tests = this.extractTestsFromDocument(document, config);
                results.push(...tests);
            }
            catch (error) {
                console.warn(`Failed to open test file ${file.fsPath}`, error);
            }
        }
        return results;
    }
    getConfigsForDocument(document) {
        const basename = path.basename(document.uri.fsPath);
        return this.getConfigs().filter(config => {
            if (!config.activated) {
                return false;
            }
            if (!this.documentMatchesFileType(document, config.fileType)) {
                return false;
            }
            return this.matchesAnyPattern(basename, this.createPatternSet(config.fileNamePattern));
        });
    }
    extractTestsFromDocument(document, config) {
        const lines = document.getText().split(/\r?\n/);
        const ignorePatterns = this.createPatternSet(config.ignoreList ?? '');
        const testNamePatterns = this.createPatternSet(config.testNamePattern);
        const results = [];
        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const testName = this.extractTestName(line, config.fileType);
            if (!testName) {
                continue;
            }
            if (!this.matchesAnyPattern(testName, testNamePatterns)) {
                continue;
            }
            if (this.matchesAnyPattern(testName, ignorePatterns)) {
                continue;
            }
            const position = new vscode.Position(index, Math.max(0, line.indexOf(testName)));
            const range = new vscode.Range(position, position);
            const id = `${config.id}:${document.uri.toString()}:${index}`;
            results.push({
                id,
                configId: config.id,
                label: testName,
                file: document.uri,
                line: index,
                range
            });
        }
        return results;
    }
    async runTest(config, testName, additionalReplacements) {
        const terminalConfig = {
            type: 'vscode-new',
            name: config.terminalName || config.title,
            cwd: config.workingDirectory || undefined
        };
        const replacements = {
            test: testName,
            ...(additionalReplacements ?? {})
        };
        const command = this.injectVariables(config.runTestCommand, replacements);
        await this.terminalManager.executeCommand(command, terminalConfig);
    }
    async runAll(config) {
        const configs = config ? [config] : this.getConfigs().filter(entry => entry.activated);
        for (const runner of configs) {
            const tests = await this.discoverTests(runner);
            for (const test of tests) {
                await this.runTest(runner, test.label, {
                    file: test.file.fsPath,
                    line: String(test.line + 1)
                });
            }
        }
    }
    async updateConfigs(updater) {
        const config = this.configManager.getConfig();
        const updated = updater([...(config.testRunners ?? [])]);
        config.testRunners = updated;
        await this.configManager.saveConfig(config);
        this._onDidChange.fire();
    }
    createPatternSet(patterns) {
        const entries = patterns
            .split(/\r?\n/)
            .map(pattern => pattern.trim())
            .filter(pattern => pattern.length > 0);
        const matchers = entries.map(pattern => this.patternToRegex(pattern));
        return { matchers };
    }
    matchesAnyPattern(value, set) {
        if (set.matchers.length === 0) {
            return true;
        }
        return set.matchers.some(regex => regex.test(value));
    }
    patternToRegex(pattern) {
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        const wildcard = escaped.replace(/\\\*/g, '.*');
        return new RegExp(`^${wildcard}$`, 'i');
    }
    extractTestName(line, fileType) {
        if (fileType === 'python') {
            const pythonMatch = line.match(/^\s*def\s+(test_[\w]+)/i);
            return pythonMatch?.[1];
        }
        const jsMatch = line.match(/\b(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/i);
        return jsMatch?.[1];
    }
    getGlobForFileType(fileType) {
        switch (fileType) {
            case 'typescript':
                return '**/*.{ts,tsx,mts,cts}';
            case 'python':
                return '**/*.py';
            case 'javascript':
            default:
                return '**/*.{js,jsx,mjs,cjs}';
        }
    }
    documentMatchesFileType(document, fileType) {
        const ext = path.extname(document.uri.fsPath).toLowerCase();
        switch (fileType) {
            case 'typescript':
                return ['.ts', '.tsx', '.mts', '.cts'].includes(ext);
            case 'python':
                return ext === '.py';
            case 'javascript':
            default:
                return ['.js', '.jsx', '.mjs', '.cjs'].includes(ext);
        }
    }
    injectVariables(template, replacements) {
        return Object.entries(replacements).reduce((command, [key, value]) => {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`\\$${escapedKey}`, 'g');
            return command.replace(pattern, value);
        }, template);
    }
}
exports.TestRunnerManager = TestRunnerManager;
//# sourceMappingURL=TestRunnerManager.js.map
