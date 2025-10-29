"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunnerCodeLensProvider = void 0;
const vscode = require("vscode");
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
        const runTitle = `$(play-circle) Run (${config.title})`;
        const ignoreTitle = '$(eye-closed) Ignore';
        const runLens = new vscode.CodeLens(test.range, {
            title: runTitle,
            tooltip: `Run ${test.label} using ${config.title}`,
            command: 'testRunner.runTest',
            arguments: [config, test]
        });
        const ignoreLens = new vscode.CodeLens(test.range, {
            title: ignoreTitle,
            tooltip: `Ignore ${test.label} in ${config.title}`,
            command: 'testRunner.ignoreTest',
            arguments: [config, test]
        });
        return [runLens, ignoreLens];
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
