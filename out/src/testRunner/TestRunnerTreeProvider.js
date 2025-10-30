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
exports.TestRunnerTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const TestRunnerTreeItem_1 = require("./TestRunnerTreeItem");
class TestRunnerTreeProvider {
    constructor(manager) {
        this.manager = manager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.testsCache = new Map();
        this.testItemsCache = new Map();
        this.managerSubscription = this.manager.onDidChange(() => {
            this.testsCache.clear();
            this.refresh();
        });
    }
    refresh(item) {
        if (!item) {
            this.testsCache.clear();
            this.testItemsCache.clear();
        }
        else if (item.isConfig()) {
            // Clear cache for this config
            this.testsCache.delete(item.config.id);
            this.testItemsCache.delete(item.config.id);
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
            return this.getFolders(element.config);
        }
        if (element.itemType === 'folder') {
            return this.getFiles(element.config, element.folderPath);
        }
        if (element.itemType === 'file') {
            return this.getTestCases(element.config, element.folderPath, element.fileName);
        }
        if (element.itemType === 'testcase') {
            return this.getTestsForCase(element.config, element.folderPath, element.fileName, element.testCaseName);
        }
        return [];
    }
    getParent(element) {
        if (element.itemType === 'folder') {
            // Folder's parent is the config
            return new TestRunnerTreeItem_1.TestRunnerTreeItem('config', element.config);
        }
        else if (element.itemType === 'file') {
            // File's parent is the folder
            return new TestRunnerTreeItem_1.TestRunnerTreeItem('folder', element.config, undefined, undefined, element.folderPath);
        }
        else if (element.itemType === 'testcase') {
            // Test case's parent is the file
            return new TestRunnerTreeItem_1.TestRunnerTreeItem('file', element.config, undefined, undefined, element.folderPath, element.fileName);
        }
        else if (element.itemType === 'test' && element.test) {
            // Test's parent depends on whether it has a test case
            const labelParts = element.test.label.split('.');
            if (labelParts.length > 1) {
                // Test has a test case parent
                const relativePath = vscode.workspace.asRelativePath(element.test.file, false);
                const pathParts = relativePath.split(/[/\\]/);
                const fileName = pathParts.pop() || '';
                const folderPath = pathParts.join('/') || '.';
                const testCaseName = labelParts[0];
                return new TestRunnerTreeItem_1.TestRunnerTreeItem('testcase', element.config, undefined, undefined, folderPath, fileName, testCaseName);
            }
            else {
                // Test without test case, parent is the file
                const relativePath = vscode.workspace.asRelativePath(element.test.file, false);
                const pathParts = relativePath.split(/[/\\]/);
                const fileName = pathParts.pop() || '';
                const folderPath = pathParts.join('/') || '.';
                return new TestRunnerTreeItem_1.TestRunnerTreeItem('file', element.config, undefined, undefined, folderPath, fileName);
            }
        }
        return undefined;
    }
    async getConfigItems() {
        const configs = this.manager.getConfigs();
        return configs.map(config => new TestRunnerTreeItem_1.TestRunnerTreeItem('config', config));
    }
    async getFolders(config) {
        // Check autoFind flag - if false, don't auto-discover tests
        if (config.autoFind === false && !this.testsCache.has(config.id)) {
            return [new TestRunnerTreeItem_1.TestRunnerTreeItem('placeholder', config, undefined, 'Click "Find Tests" to discover tests')];
        }
        if (!this.testsCache.has(config.id)) {
            const tests = await this.manager.discoverTests(config);
            this.testsCache.set(config.id, tests);
        }
        const cached = this.testsCache.get(config.id) ?? [];
        if (cached.length === 0) {
            return [new TestRunnerTreeItem_1.TestRunnerTreeItem('placeholder', config)];
        }
        // Group tests by folder
        const folderMap = new Map();
        for (const test of cached) {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            const pathParts = relativePath.split(/[/\\]/);
            pathParts.pop(); // Remove filename
            const folderPath = pathParts.join('/') || '.';
            if (!folderMap.has(folderPath)) {
                folderMap.set(folderPath, []);
            }
            folderMap.get(folderPath).push(test);
        }
        const folders = Array.from(folderMap.keys()).sort().map(folderPath => {
            return new TestRunnerTreeItem_1.TestRunnerTreeItem('folder', config, undefined, undefined, folderPath);
        });
        return folders;
    }
    async getFiles(config, folderPath) {
        const cached = this.testsCache.get(config.id) ?? [];
        const folderTests = cached.filter(test => {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            const pathParts = relativePath.split(/[/\\]/);
            pathParts.pop();
            const testFolderPath = pathParts.join('/') || '.';
            return testFolderPath === folderPath;
        });
        // Group by file
        const fileMap = new Map();
        for (const test of folderTests) {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            const fileName = relativePath.split(/[/\\]/).pop() || '';
            if (!fileMap.has(fileName)) {
                fileMap.set(fileName, []);
            }
            fileMap.get(fileName).push(test);
        }
        return Array.from(fileMap.keys()).sort().map(fileName => {
            return new TestRunnerTreeItem_1.TestRunnerTreeItem('file', config, undefined, undefined, folderPath, fileName);
        });
    }
    async getTestCases(config, folderPath, fileName) {
        const cached = this.testsCache.get(config.id) ?? [];
        const fileTests = cached.filter(test => {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            const testFileName = relativePath.split(/[/\\]/).pop() || '';
            const testPathParts = relativePath.split(/[/\\]/);
            testPathParts.pop();
            const testFolderPath = testPathParts.join('/') || '.';
            return testFileName === fileName && testFolderPath === folderPath;
        });
        // Group by test case (class name)
        const testCaseMap = new Map();
        const noTestCaseTests = [];
        for (const test of fileTests) {
            const labelParts = test.label.split('.');
            if (labelParts.length > 1) {
                const testCase = labelParts[0];
                if (!testCaseMap.has(testCase)) {
                    testCaseMap.set(testCase, []);
                }
                testCaseMap.get(testCase).push(test);
            }
            else {
                noTestCaseTests.push(test);
            }
        }
        const items = [];
        // Add test cases first
        for (const [testCase, tests] of Array.from(testCaseMap.entries()).sort()) {
            items.push(new TestRunnerTreeItem_1.TestRunnerTreeItem('testcase', config, undefined, undefined, folderPath, fileName, testCase));
        }
        // Add tests without test case as direct children (no testcase wrapper)
        for (const test of noTestCaseTests) {
            items.push(new TestRunnerTreeItem_1.TestRunnerTreeItem('test', config, test));
        }
        return items;
    }
    async getTestsForCase(config, folderPath, fileName, testCaseName) {
        const cached = this.testsCache.get(config.id) ?? [];
        const tests = cached.filter(test => {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            const testFileName = relativePath.split(/[/\\]/).pop() || '';
            const testPathParts = relativePath.split(/[/\\]/);
            testPathParts.pop();
            const testFolderPath = testPathParts.join('/') || '.';
            if (testFileName !== fileName || testFolderPath !== folderPath) {
                return false;
            }
            const labelParts = test.label.split('.');
            return labelParts.length > 1 && labelParts[0] === testCaseName;
        });
        return tests.map(test => new TestRunnerTreeItem_1.TestRunnerTreeItem('test', config, test));
    }
    getTestsForFolder(config, folderPath) {
        const cached = this.testsCache.get(config.id) ?? [];
        return cached.filter(test => {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            const pathParts = relativePath.split(/[/\\]/);
            pathParts.pop();
            const testFolderPath = pathParts.join('/') || '.';
            return testFolderPath === folderPath;
        });
    }
    getTestsForFile(config, folderPath, fileName) {
        const cached = this.testsCache.get(config.id) ?? [];
        return cached.filter(test => {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            const testFileName = relativePath.split(/[/\\]/).pop() || '';
            const testPathParts = relativePath.split(/[/\\]/);
            testPathParts.pop();
            const testFolderPath = testPathParts.join('/') || '.';
            return testFileName === fileName && testFolderPath === folderPath;
        });
    }
    getTestsForTestCase(config, folderPath, fileName, testCaseName) {
        const cached = this.testsCache.get(config.id) ?? [];
        return cached.filter(test => {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            const testFileName = relativePath.split(/[/\\]/).pop() || '';
            const testPathParts = relativePath.split(/[/\\]/);
            testPathParts.pop();
            const testFolderPath = testPathParts.join('/') || '.';
            if (testFileName !== fileName || testFolderPath !== folderPath) {
                return false;
            }
            const labelParts = test.label.split('.');
            return labelParts.length > 1 && labelParts[0] === testCaseName;
        });
    }
    dispose() {
        try {
            this.managerSubscription?.dispose();
        }
        finally {
            this._onDidChangeTreeData.dispose();
        }
    }
}
exports.TestRunnerTreeProvider = TestRunnerTreeProvider;
//# sourceMappingURL=TestRunnerTreeProvider.js.map