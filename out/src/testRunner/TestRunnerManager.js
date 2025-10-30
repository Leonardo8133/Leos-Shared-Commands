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
        this.onDidChange = this._onDidChange.event;
        this.configManager.setOnConfigChange(() => this._onDidChange.fire());
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{js,jsx,ts,tsx,mjs,cjs,cts,mts,py}');
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
            const existing = (current.ignoreList ?? '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
            if (!existing.includes(testName)) {
                existing.push(testName);
            }
            configs[index] = { ...current, ignoreList: existing.join('\n') };
            return configs;
        });
    }
    async discoverTests(config) {
        if (!vscode.workspace.workspaceFolders?.length) {
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
        let filesChecked = 0;
        let filesMatched = 0;
        for (const file of files) {
            const basename = path.basename(file.fsPath);
            const matches = this.matchesAnyPattern(basename, filePatterns);
            if (!matches) {
                continue;
            }
            filesMatched++;
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const tests = this.extractTestsFromDocument(document, config);
                results.push(...tests);
            }
            catch (error) {
                // Swallow file open errors silently
            }
            filesChecked++;
        }
        // No logs/output spam
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
        const strategy = this.getLanguagePattern(config.fileType);
        return strategy.extract(document, config);
    }
    getLanguagePattern(fileType) {
        switch (fileType) {
            case 'python':
                return new PythonPattern();
            case 'typescript':
                return new TypeScriptPattern();
            case 'javascript':
            default:
                return new JavaScriptPattern();
        }
    }
    async runTest(config, testName, additionalReplacements) {
        const terminalConfig = {
            type: 'vscode-new',
            name: config.terminalName || config.title,
            cwd: config.workingDirectory || undefined
        };
        // Extract test case (class name) from test name
        // testName format: "ClassName.test_method" or "test_method"
        let testCase = '';
        const dotIndex = testName.indexOf('.');
        if (dotIndex > 0) {
            testCase = testName.substring(0, dotIndex);
        }
        // Build all test variables from file path
        let testFile = '';
        let testPath = '';
        let testExtension = '';
        let executableTestPath = '';
        if (additionalReplacements?.file) {
            const filePath = additionalReplacements.file;
            // Normalize path separators to forward slashes
            const normalizedPath = filePath.replace(/\\/g, '/');
            // Extract extension
            const extMatch = normalizedPath.match(/\.([^.]+)$/);
            testExtension = extMatch ? `.${extMatch[1]}` : '';
            // Remove extension to get base path
            const pathWithoutExt = normalizedPath.replace(/\.[^.]+$/, '');
            // Extract filename without extension
            const filenameWithExt = path.basename(normalizedPath);
            testFile = filenameWithExt.replace(/\.[^.]+$/, '');
            // Get relative path from workspace root (for test_path)
            let relativePath = pathWithoutExt;
            let moduleBasePath = pathWithoutExt;
            // Determine base path for Python module resolution
            // If workingDirectory is set, use it as the base; otherwise use workspace root
            let basePath = '';
            if (config.workingDirectory && vscode.workspace.workspaceFolders?.[0]) {
                // Resolve working directory relative to workspace root
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
                const workingDir = path.resolve(workspaceRoot, config.workingDirectory).replace(/\\/g, '/');
                basePath = workingDir;
            }
            else if (vscode.workspace.workspaceFolders?.[0]) {
                basePath = vscode.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
            }
            if (basePath && normalizedPath.startsWith(basePath)) {
                moduleBasePath = normalizedPath.substring(basePath.length + 1); // +1 to remove leading /
                moduleBasePath = moduleBasePath.replace(/\.[^.]+$/, ''); // Remove extension
            }
            // For test_path, use workspace-relative path
            if (vscode.workspace.workspaceFolders?.[0]) {
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
                if (normalizedPath.startsWith(workspaceRoot)) {
                    relativePath = normalizedPath.substring(workspaceRoot.length + 1); // +1 to remove leading /
                    relativePath = relativePath.replace(/\.[^.]+$/, ''); // Remove extension from relative path
                }
            }
            testPath = relativePath;
            // Build executable test path: convert module path to dots and append test name
            // test_name already includes TestCase.test_name format
            const pathWithDots = moduleBasePath.replace(/\//g, '.');
            executableTestPath = `${pathWithDots}.${testName}`;
        }
        const replacements = {
            test_name: testName,
            test_testcase: testCase,
            test_file: testFile,
            test_path: testPath,
            test_extension: testExtension,
            executable_test_path: executableTestPath,
            ...(additionalReplacements ?? {})
        };
        // Validate variables before executing
        this.validateVariables(config.runTestCommand);
        const command = this.injectVariables(config.runTestCommand, replacements);
        await this.terminalManager.executeCommand(command, terminalConfig);
    }
    async runTestWithResult(config, testName, additionalReplacements) {
        const terminalConfig = {
            type: 'vscode-new',
            name: config.terminalName || config.title,
            cwd: config.workingDirectory || undefined
        };
        // Build all test variables from file path
        let testFile = '';
        let testPath = '';
        let testExtension = '';
        let executableTestPath = '';
        if (additionalReplacements?.file) {
            const filePath = additionalReplacements.file;
            // Normalize path separators to forward slashes
            const normalizedPath = filePath.replace(/\\/g, '/');
            // Extract extension
            const extMatch = normalizedPath.match(/\.([^.]+)$/);
            testExtension = extMatch ? `.${extMatch[1]}` : '';
            // Remove extension to get base path
            const pathWithoutExt = normalizedPath.replace(/\.[^.]+$/, '');
            // Extract filename without extension
            const filenameWithExt = path.basename(normalizedPath);
            testFile = filenameWithExt.replace(/\.[^.]+$/, '');
            // Get relative path from workspace root (for test_path)
            let relativePath = pathWithoutExt;
            let moduleBasePath = pathWithoutExt;
            // Determine base path for Python module resolution
            // If workingDirectory is set, use it as the base; otherwise use workspace root
            let basePath = '';
            if (config.workingDirectory && vscode.workspace.workspaceFolders?.[0]) {
                // Resolve working directory relative to workspace root
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
                const workingDir = path.resolve(workspaceRoot, config.workingDirectory).replace(/\\/g, '/');
                basePath = workingDir;
            }
            else if (vscode.workspace.workspaceFolders?.[0]) {
                basePath = vscode.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
            }
            if (basePath && normalizedPath.startsWith(basePath)) {
                moduleBasePath = normalizedPath.substring(basePath.length + 1); // +1 to remove leading /
                moduleBasePath = moduleBasePath.replace(/\.[^.]+$/, ''); // Remove extension
            }
            // For test_path, use workspace-relative path
            if (vscode.workspace.workspaceFolders?.[0]) {
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
                if (normalizedPath.startsWith(workspaceRoot)) {
                    relativePath = normalizedPath.substring(workspaceRoot.length + 1); // +1 to remove leading /
                    relativePath = relativePath.replace(/\.[^.]+$/, ''); // Remove extension from relative path
                }
            }
            testPath = relativePath;
            // Build executable test path: convert module path to dots and append test name
            // test_name already includes TestCase.test_name format
            const pathWithDots = moduleBasePath.replace(/\//g, '.');
            executableTestPath = `${pathWithDots}.${testName}`;
        }
        const replacements = {
            test_name: testName,
            test_file: testFile,
            test_path: testPath,
            test_extension: testExtension,
            executable_test_path: executableTestPath,
            ...(additionalReplacements ?? {})
        };
        // Validate variables before executing
        this.validateVariables(config.runTestCommand);
        const command = this.injectVariables(config.runTestCommand, replacements);
        const exitCode = await this.terminalManager.executeCommandWithExitCode(command, terminalConfig);
        return exitCode === 0;
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
        const matches = set.matchers.some(regex => regex.test(value));
        return matches;
    }
    patternToRegex(pattern) {
        // Handle empty patterns - match everything
        if (!pattern || pattern.trim().length === 0) {
            return new RegExp('.*', 'i');
        }
        // First, handle wildcards by replacing * with a placeholder
        // Then escape special regex characters
        // Finally replace the placeholder with .*
        const placeholder = '__WILDCARD_PLACEHOLDER__';
        const withPlaceholders = pattern.replace(/\*/g, placeholder);
        // Escape special regex characters (but not our placeholder)
        const escaped = withPlaceholders.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        // Replace placeholder with regex wildcard .*
        const wildcard = escaped.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '.*');
        // Ensure we have anchors
        let regexPattern = wildcard;
        if (!regexPattern.startsWith('^')) {
            regexPattern = '^' + regexPattern;
        }
        if (!regexPattern.endsWith('$')) {
            regexPattern = regexPattern + '$';
        }
        // Validate the regex before creating it
        try {
            return new RegExp(regexPattern, 'i');
        }
        catch (error) {
            // If regex is invalid, fallback to matching everything silently
            return new RegExp('.*', 'i');
        }
    }
    extractTestName(line, fileType, extractAllFunctions = false) {
        if (fileType === 'python') {
            // Match pytest-style: def test_something()
            const pytestMatch = line.match(/^\s*def\s+(test_\w+)/i);
            if (pytestMatch) {
                return pytestMatch[1];
            }
            // Match unittest-style: def testSomething(self) or def test_something(self)
            const unittestMatch = line.match(/^\s*def\s+(test\w+)\s*\(/i);
            if (unittestMatch) {
                return unittestMatch[1];
            }
            // DO NOT match classes as tests - only test methods should be discovered
            // Classes will be automatically handled via the class prefix we add to test methods
            // If extractAllFunctions is true and test name pattern is "*", extract ALL functions
            if (extractAllFunctions) {
                // Match any function: def function_name()
                const anyFunctionMatch = line.match(/^\s*def\s+(\w+)\s*\(/);
                if (anyFunctionMatch) {
                    return anyFunctionMatch[1];
                }
                // DO NOT extract classes - only functions/methods
            }
            return undefined;
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
        let result = template;
        // First, handle variables with format options (e.g., $test_path:dot, $executable_test_path:slash)
        // Pattern: $variable_name:format
        const formatPattern = /\$(\w+):(\w+)/g;
        let formatMatch;
        while ((formatMatch = formatPattern.exec(template)) !== null) {
            const [fullMatch, varName, format] = formatMatch;
            const baseValue = replacements[varName] || '';
            let formattedValue = baseValue;
            if (baseValue) {
                switch (format) {
                    case 'dot':
                        formattedValue = baseValue.replace(/[\/\\]/g, '.');
                        break;
                    case 'slash':
                        formattedValue = baseValue.replace(/[\\]/g, '/');
                        break;
                    case 'hyphen':
                        formattedValue = baseValue.replace(/[\/\\\.]/g, '-');
                        break;
                    default:
                        formattedValue = baseValue;
                }
            }
            result = result.replace(fullMatch, formattedValue);
        }
        // Then handle simple variables (without format)
        // For executable_test_path without format, default to dot format
        for (const [key, value] of Object.entries(replacements)) {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Special handling: executable_test_path defaults to dot format if no format specified
            if (key === 'executable_test_path') {
                const pattern = new RegExp(`\\$${escapedKey}(?!:)`, 'g');
                const dotFormatted = value.replace(/[\/\\]/g, '.');
                result = result.replace(pattern, dotFormatted);
            }
            else {
                // Only replace if not already replaced by format option
                const pattern = new RegExp(`\\$${escapedKey}(?!:)`, 'g');
                result = result.replace(pattern, value);
            }
        }
        return result;
    }
    validateVariables(command) {
        const validVariables = ['test_name', 'test_testcase', 'test_file', 'test_path', 'test_extension', 'executable_test_path', 'file', 'line'];
        const validFormats = ['dot', 'slash', 'hyphen'];
        // Extract all variables (with or without format options)
        const variablePattern = /\$(\w+)(?::(\w+))?/g;
        const foundVariables = new Set();
        let match;
        while ((match = variablePattern.exec(command)) !== null) {
            const varName = match[1];
            const format = match[2];
            // Check if variable name is valid
            if (!validVariables.includes(varName)) {
                foundVariables.add(varName);
                continue;
            }
            // Check if format is valid (if provided)
            if (format && !validFormats.includes(format)) {
                throw new Error(`Invalid format "${format}" for variable $${varName}. ` +
                    `Valid formats: ${validFormats.join(', ')}.`);
            }
        }
        const invalidVariables = Array.from(foundVariables);
        if (invalidVariables.length > 0) {
            throw new Error(`Invalid variable(s) in test command: ${invalidVariables.map(v => `$${v}`).join(', ')}. ` +
                `Available variables: ${validVariables.map(v => `$${v}`).join(', ')}.`);
        }
    }
}
exports.TestRunnerManager = TestRunnerManager;
class BasePattern {
    createPatternSet(patterns) {
        const entries = (patterns || '')
            .split(/\r?\n/)
            .map(p => p.trim())
            .filter(Boolean);
        return { matchers: entries.map(p => this.patternToRegex(p)) };
    }
    patternToRegex(pattern) {
        if (!pattern || pattern.trim().length === 0)
            return new RegExp('.*', 'i');
        const placeholder = '__WILDCARD__';
        const withPlaceholders = pattern.replace(/\*/g, placeholder);
        const escaped = withPlaceholders.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        const wildcard = escaped.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '.*');
        let regexPattern = wildcard;
        if (!regexPattern.startsWith('^'))
            regexPattern = '^' + regexPattern;
        if (!regexPattern.endsWith('$'))
            regexPattern = regexPattern + '$';
        try {
            return new RegExp(regexPattern, 'i');
        }
        catch {
            return new RegExp('.*', 'i');
        }
    }
    matchesAny(value, set) {
        if (set.matchers.length === 0)
            return true;
        return set.matchers.some(r => r.test(value));
    }
}
class PythonPattern extends BasePattern {
    extract(document, config) {
        const lines = document.getText().split(/\r?\n/);
        const ignorePatterns = this.createPatternSet(config.ignoreList ?? '');
        const testNamePatterns = this.createPatternSet(config.testNamePattern);
        const allowNonTest = config.allowNonTest === true;
        const matchAll = allowNonTest && (testNamePatterns.matchers.length === 0 || (testNamePatterns.matchers.length === 1 && testNamePatterns.matchers[0].toString() === '/^.*$/i'));
        // Gather class definitions
        const classDefs = [];
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^(\s*)class\s+(\w+)/);
            if (m)
                classDefs.push({ name: m[2], indent: m[1].length, lineIdx: i });
        }
        const results = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match only test methods (do not treat classes as tests)
            const pyTest = line.match(/^\s*def\s+(test_\w+)/i) || line.match(/^\s*def\s+(test\w+)\s*\(/i) || (matchAll ? line.match(/^\s*def\s+(\w+)\s*\(/) : null);
            if (!pyTest)
                continue;
            const method = pyTest[1];
            const methodIndent = (line.match(/^(\s*)/)?.[1].length) || 0;
            // Find innermost containing class
            let qualified = method;
            const containing = classDefs
                .filter(c => c.lineIdx < i && methodIndent > c.indent)
                .sort((a, b) => b.indent - a.indent);
            if (containing.length > 0)
                qualified = `${containing[0].name}.${method}`;
            if (!this.matchesAny(qualified, testNamePatterns))
                continue;
            if (ignorePatterns.matchers.length > 0 && this.matchesAny(qualified, ignorePatterns))
                continue;
            const position = new vscode.Position(i, Math.max(0, line.indexOf(method)));
            const range = new vscode.Range(position, position);
            const id = `${config.id}:${document.uri.toString()}:${i}`;
            results.push({ id, configId: config.id, label: qualified, file: document.uri, line: i, range });
        }
        return results;
    }
}
class JavaScriptPattern extends BasePattern {
    extract(document, config) {
        const lines = document.getText().split(/\r?\n/);
        const ignorePatterns = this.createPatternSet(config.ignoreList ?? '');
        const testNamePatterns = this.createPatternSet(config.testNamePattern);
        const results = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const m = line.match(/\b(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/i);
            if (!m)
                continue;
            const name = m[1];
            if (!this.matchesAny(name, testNamePatterns))
                continue;
            if (ignorePatterns.matchers.length > 0 && this.matchesAny(name, ignorePatterns))
                continue;
            const col = Math.max(0, line.indexOf(m[0]));
            const range = new vscode.Range(new vscode.Position(i, col), new vscode.Position(i, col));
            const id = `${config.id}:${document.uri.toString()}:${i}`;
            results.push({ id, configId: config.id, label: name, file: document.uri, line: i, range });
        }
        return results;
    }
}
class TypeScriptPattern extends JavaScriptPattern {
}
//# sourceMappingURL=TestRunnerManager.js.map