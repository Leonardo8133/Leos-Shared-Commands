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
exports.DocumentationTreeItem = void 0;
const vscode = __importStar(require("vscode"));
class DocumentationTreeItem extends vscode.TreeItem {
    constructor(type, labelText, collapsibleState, metadata, children) {
        super(labelText, collapsibleState);
        this.type = type;
        this.labelText = labelText;
        this.metadata = metadata;
        this.children = children;
        this.contextValue = this.getContextValue();
        this.tooltip = this.getTooltip();
        if (type === 'file' && metadata) {
            this.resourceUri = metadata.uri;
            this.command = {
                command: 'documentationHub.openFile',
                title: 'Open Documentation',
                arguments: [metadata.uri]
            };
        }
    }
    getContextValue() {
        switch (this.type) {
            case 'search':
                return 'documentationSearch';
            case 'folder':
                return 'documentationFolder';
            case 'file':
                if (!this.metadata) {
                    return 'documentationFile';
                }
                const fileName = this.metadata.relativePath.split('/').pop() || '';
                if (fileName.toLowerCase() === 'readme.md') {
                    return 'documentationReadme';
                }
                return 'documentationFile';
            default:
                return '';
        }
    }
    getTooltip() {
        if (this.type !== 'file' || !this.metadata) {
            return undefined;
        }
        if (!this.metadata.sections.length) {
            return `${this.labelText}\nClick to open documentation.`;
        }
        const markdown = new vscode.MarkdownString(undefined, true);
        markdown.isTrusted = true;
        markdown.appendMarkdown(`**${this.labelText}**\n\n`);
        this.metadata.sections.forEach(section => {
            const args = encodeURIComponent(JSON.stringify({
                path: this.metadata?.uri.fsPath,
                line: section.line
            }));
            const indentation = '\u00A0'.repeat((section.level - 1) * 2);
            markdown.appendMarkdown(`${indentation}- [${section.label}](command:documentationHub.openSection?${args})\n`);
        });
        return markdown;
    }
}
exports.DocumentationTreeItem = DocumentationTreeItem;
//# sourceMappingURL=DocumentationTreeItem.js.map