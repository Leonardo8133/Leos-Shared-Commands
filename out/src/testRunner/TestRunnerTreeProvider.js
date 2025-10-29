"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunnerTreeProvider = void 0;
const vscode = require("vscode");
const TestRunnerTreeItem_1 = require("./TestRunnerTreeItem");
class TestRunnerTreeProvider {
    constructor(manager) {
        this.manager = manager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.testsCache = new Map();
        this.manager.onDidChange(() => {
            this.testsCache.clear();
            this.refresh();
        });
    }
    refresh(item) {
        if (!item) {
            this.testsCache.clear();
        }
        this._onDidChangeTreeData.fire(item);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            return this.getConfigItems();
        }
        if (element.isConfig()) {
            return this.getTests(element.config);
        }
        return [];
    }
    getParent(element) {
        return undefined;
    }
    async getConfigItems() {
        const configs = this.manager.getConfigs();
        return configs.map(config => new TestRunnerTreeItem_1.TestRunnerTreeItem('config', config));
    }
    async getTests(config) {
        if (!this.testsCache.has(config.id)) {
            const tests = await this.manager.discoverTests(config);
            this.testsCache.set(config.id, tests);
        }
        const cached = this.testsCache.get(config.id) ?? [];
        if (cached.length === 0) {
            return [new TestRunnerTreeItem_1.TestRunnerTreeItem('placeholder', config)];
        }
        return cached.map(test => new TestRunnerTreeItem_1.TestRunnerTreeItem('test', config, test));
    }
}
exports.TestRunnerTreeProvider = TestRunnerTreeProvider;
//# sourceMappingURL=TestRunnerTreeProvider.js.map
