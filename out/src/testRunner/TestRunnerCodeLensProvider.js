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
exports.TestRunnerCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
class TestRunnerCodeLensProvider {
    constructor(manager) {
        this.manager = manager;
        this.changeEmitter = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this.changeEmitter.event;
        this.disposables = [];
        this.disposables.push(this.manager.onDidChange(() => this.refresh()));
        this.disposables.push(vscode.workspace.onDidChangeTextDocument(event => {
            if (this.shouldProcessDocument(event.document)) {
                this.refresh();
            }
        }));
    }
    refresh() {
        this.changeEmitter.fire();
    }
    provideCodeLenses(document) {
        if (!this.shouldProcessDocument(document)) {
            return [];
        }
        const configs = this.manager.getConfigsForDocument(document);
        if (configs.length === 0) {
            return [];
        }
        const lenses = [];
        for (const config of configs) {
            const tests = this.manager.extractTestsFromDocument(document, config);
            for (const test of tests) {
                lenses.push(...this.createLensesForTest(config, test));
            }
        }
        return lenses;
    }
    createLensesForTest(config, test) {
        const lenses = [];
        // Only show inline button if enabled (default: true)
        if (config.inlineButton !== false) {
            const runTitle = `$(play-circle) Run Test with "${config.title}"`;
            const runLens = new vscode.CodeLens(test.range, {
                title: runTitle,
                tooltip: `Run ${test.label} with configuration "${config.title}"`,
                command: 'testRunner.runTest',
                arguments: [config, test]
            });
            lenses.push(runLens);
        }
        const ignoreTitle = '$(eye-closed) Ignore';
        const ignoreLens = new vscode.CodeLens(test.range, {
            title: ignoreTitle,
            tooltip: `Ignore ${test.label} in ${config.title}`,
            command: 'testRunner.ignoreTest',
            arguments: [config, test]
        });
        lenses.push(ignoreLens);
        return lenses;
    }
    shouldProcessDocument(document) {
        const configs = this.manager.getConfigsForDocument(document);
        return configs.length > 0;
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.changeEmitter.dispose();
    }
}
exports.TestRunnerCodeLensProvider = TestRunnerCodeLensProvider;
//# sourceMappingURL=TestRunnerCodeLensProvider.js.map