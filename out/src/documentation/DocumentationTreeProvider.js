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
exports.DocumentationTreeProvider = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const DocumentationTreeItem_1 = require("./DocumentationTreeItem");
class DocumentationTreeProvider {
    constructor(configManager, storage) {
        this.configManager = configManager;
        this.storage = storage;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.markdownFiles = [];
        this.searchQuery = '';
        this.viewMode = 'tree';
        this.hiddenItems = new Set();
        this.storageKey = 'documentationHub.hiddenItems';
        void this.initialize();
    }
    async initialize() {
        this.viewMode = this.getConfiguredViewMode();
        const storedHidden = this.storage.get(this.storageKey, []);
        this.hiddenItems = new Set(storedHidden);
        await this.refreshMarkdownFiles();
        this.setupFileWatcher();
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('commandManager.documentationHub.viewMode')) {
                this.viewMode = this.getConfiguredViewMode();
                this.refresh();
            }
        });
        this.refresh();
    }
    getConfiguredViewMode() {
        const configuration = vscode.workspace.getConfiguration('commandManager.documentationHub');
        const value = configuration.get('viewMode', 'tree');
        return value;
    }
    async refreshMarkdownFiles() {
        if (!vscode.workspace.workspaceFolders?.length) {
            this.markdownFiles = [];
            return;
        }
        const files = await vscode.workspace.findFiles('**/*.md', '**/{node_modules,.git}/**');
        const fileEntries = [];
        for (const file of files) {
            const relativePath = vscode.workspace.asRelativePath(file);
            const { sections, content } = await this.getSectionsForFile(file);
            fileEntries.push({ uri: file, relativePath, sections, lowerContent: content.toLowerCase() });
        }
        this.markdownFiles = fileEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    }
    setupFileWatcher() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
        const handler = async () => {
            await this.refreshMarkdownFiles();
            this.refresh();
        };
        this.watcher.onDidCreate(handler);
        this.watcher.onDidChange(handler);
        this.watcher.onDidDelete(handler);
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    async reload() {
        await this.refreshMarkdownFiles();
        this.refresh();
    }
    async getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            const items = [];
            items.push(this.createSearchItem());
            const fileEntries = this.getFilteredMarkdownFiles();
            if (this.viewMode === 'flat') {
                const fileItems = fileEntries.map(entry => this.createFileItem(entry));
                items.push(...fileItems.filter(item => !this.isHidden(item)));
            }
            else {
                const tree = this.buildFolderTree(fileEntries);
                items.push(...tree.filter(item => !this.isHidden(item)));
            }
            if (items.length === 1) {
                return [items[0], this.createEmptyStateItem()];
            }
            return items;
        }
        if (element.type === 'folder') {
            const children = element.children ?? [];
            return children.filter(child => !this.isHidden(child));
        }
        return [];
    }
    createEmptyStateItem() {
        const item = new DocumentationTreeItem_1.DocumentationTreeItem('search', 'No markdown files found', vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('book');
        item.description = '';
        item.command = undefined;
        item.contextValue = 'documentationEmpty';
        return item;
    }
    createSearchItem() {
        const label = this.searchQuery ? `Search: ${this.searchQuery}` : 'Search documentation...';
        const item = new DocumentationTreeItem_1.DocumentationTreeItem('search', label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('search');
        item.command = {
            command: 'documentationHub.search',
            title: 'Search Documentation'
        };
        return item;
    }
    createFileItem(entry) {
        const metadata = {
            uri: entry.uri,
            relativePath: entry.relativePath,
            sections: entry.sections
        };
        const label = path.basename(entry.relativePath);
        const item = new DocumentationTreeItem_1.DocumentationTreeItem('file', label, vscode.TreeItemCollapsibleState.None, metadata);
        item.description = path.dirname(entry.relativePath) === '.' ? '' : path.dirname(entry.relativePath);
        return item;
    }
    buildFolderTree(entries) {
        const root = {
            name: '',
            children: new Map(),
            files: [],
            path: ''
        };
        for (const entry of entries) {
            const segments = entry.relativePath.split('/');
            const fileName = segments.pop();
            if (!fileName) {
                continue;
            }
            let current = root;
            let currentPath = '';
            for (const segment of segments) {
                currentPath = currentPath ? `${currentPath}/${segment}` : segment;
                if (!current.children.has(segment)) {
                    current.children.set(segment, {
                        name: segment,
                        children: new Map(),
                        files: [],
                        path: currentPath
                    });
                }
                current = current.children.get(segment);
            }
            current.files.push(entry);
        }
        const buildItems = (node) => {
            const folderItems = [];
            const sortedFolders = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
            for (const folder of sortedFolders) {
                const children = [...buildItems(folder), ...folder.files.map(file => this.createFileItem(file))];
                const item = new DocumentationTreeItem_1.DocumentationTreeItem('folder', folder.name, vscode.TreeItemCollapsibleState.Collapsed, undefined, children, folder.path);
                item.iconPath = new vscode.ThemeIcon('folder');
                item.description = folder.path;
                // Only add folder if it's not hidden and has visible children
                const visibleChildren = children.filter(child => !this.isHidden(child));
                if (!this.isHidden(item) && visibleChildren.length > 0) {
                    folderItems.push(item);
                }
            }
            return folderItems;
        };
        const rootItems = [...buildItems(root), ...root.files.map(file => this.createFileItem(file))];
        const visibleRootItems = rootItems.filter(item => !this.isHidden(item));
        if (!visibleRootItems.length) {
            const emptyItem = new DocumentationTreeItem_1.DocumentationTreeItem('search', 'No documentation found', vscode.TreeItemCollapsibleState.None);
            emptyItem.iconPath = new vscode.ThemeIcon('book');
            emptyItem.command = undefined;
            return [emptyItem];
        }
        return visibleRootItems;
    }
    getFilteredMarkdownFiles() {
        if (!this.searchQuery) {
            return this.markdownFiles;
        }
        const query = this.searchQuery.toLowerCase();
        return this.markdownFiles.filter(entry => {
            if (entry.relativePath.toLowerCase().includes(query)) {
                return true;
            }
            if (entry.sections.some(section => section.label.toLowerCase().includes(query))) {
                return true;
            }
            if (entry.lowerContent.includes(query)) {
                return true;
            }
            return false;
        });
    }
    async getSectionsForFile(uri) {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const sections = [];
            for (let line = 0; line < document.lineCount; line++) {
                const textLine = document.lineAt(line);
                const match = /^(#{1,6})\s+(.+)$/.exec(textLine.text);
                if (match) {
                    sections.push({
                        label: match[2].trim(),
                        level: match[1].length,
                        line
                    });
                }
            }
            return { sections, content: document.getText() };
        }
        catch (error) {
            console.warn('Failed to parse sections for', uri.fsPath, error);
            return { sections: [], content: '' };
        }
    }
    async setSearchQuery() {
        const input = await vscode.window.showInputBox({
            prompt: 'Search markdown documentation',
            placeHolder: 'Type to filter by file name or section title',
            value: this.searchQuery
        });
        if (typeof input === 'undefined') {
            return;
        }
        this.searchQuery = input.trim();
        this.refresh();
    }
    toggleViewMode() {
        this.viewMode = this.viewMode === 'tree' ? 'flat' : 'tree';
        const configuration = vscode.workspace.getConfiguration('commandManager.documentationHub');
        void configuration.update('viewMode', this.viewMode, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }
    async openFile(uri) {
        await vscode.window.showTextDocument(uri, { preview: false });
    }
    async openSection(target) {
        const uri = vscode.Uri.file(target.path);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        const position = new vscode.Position(target.line, 0);
        const range = new vscode.Range(position, position);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
    }
    async copyFilePath(uri) {
        await vscode.env.clipboard.writeText(uri.fsPath);
        vscode.window.showInformationMessage('Documentation path copied to clipboard');
    }
    async extractCommandsFromReadme(uri) {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const commands = this.parseCommands(document);
            if (!commands.length) {
                vscode.window.showInformationMessage('No commands found in the selected documentation.');
                return;
            }
            const config = this.configManager.getConfig();
            const folderName = this.generateFolderName(uri, config.folders.map(folder => folder.name));
            config.folders.push({
                name: folderName,
                description: `Commands extracted from ${path.basename(uri.fsPath)}`,
                commands: commands.map((command, index) => this.createCommandFromSnippet(command, folderName, index))
            });
            await this.configManager.saveConfig(config);
            vscode.window.showInformationMessage(`Created folder "${folderName}" with ${commands.length} commands.`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to extract commands: ${error}`);
        }
    }
    parseCommands(document) {
        const commands = [];
        const text = document.getText();
        const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = fenceRegex.exec(text))) {
            const language = (match[1] || '').toLowerCase();
            if (!language || ['bash', 'sh', 'shell', 'zsh', 'powershell', 'cmd', 'bat'].includes(language)) {
                const content = match[2]
                    .split('\n')
                    .map(line => line.replace(/^\$\s*/, '').trim())
                    .filter(line => !!line)
                    .join(' && ')
                    .trim();
                if (content) {
                    commands.push(content);
                }
            }
        }
        return commands;
    }
    generateFolderName(uri, existingNames) {
        const base = path.basename(uri.fsPath, path.extname(uri.fsPath));
        let name = `${this.toTitleCase(base)} Commands`;
        let counter = 1;
        while (existingNames.includes(name)) {
            counter += 1;
            name = `${this.toTitleCase(base)} Commands ${counter}`;
        }
        return name;
    }
    toTitleCase(value) {
        return value
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, char => char.toUpperCase());
    }
    createCommandFromSnippet(snippet, folderName, index) {
        return {
            id: `${folderName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
            label: snippet.length > 40 ? `${snippet.slice(0, 37)}...` : snippet,
            command: snippet,
            description: `Extracted from ${folderName}`,
            terminal: {
                type: 'vscode-new',
                name: folderName
            }
        };
    }
    hideItem(item) {
        const key = this.getItemKey(item);
        this.hiddenItems.add(key);
        void this.persistHiddenItems();
        this.refresh();
    }
    unhideItem(item) {
        const key = this.getItemKey(item);
        this.hiddenItems.delete(key);
        void this.persistHiddenItems();
        this.refresh();
    }
    unhideAll() {
        this.hiddenItems.clear();
        void this.persistHiddenItems();
        this.refresh();
    }
    isHidden(item) {
        const key = this.getItemKey(item);
        return this.hiddenItems.has(key);
    }
    getItemKey(item) {
        if (item.type === 'file' && item.metadata) {
            return `file:${item.metadata.relativePath}`;
        }
        else if (item.type === 'folder') {
            const identifier = item.folderPath || item.labelText;
            return `folder:${identifier}`;
        }
        return `search:${item.labelText}`;
    }
    async persistHiddenItems() {
        await this.storage.update(this.storageKey, Array.from(this.hiddenItems));
    }
    dispose() {
        this._onDidChangeTreeData.dispose();
        this.watcher?.dispose();
    }
}
exports.DocumentationTreeProvider = DocumentationTreeProvider;
//# sourceMappingURL=DocumentationTreeProvider.js.map