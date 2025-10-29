import * as vscode from 'vscode';

export type DocumentationItemType = 'search' | 'folder' | 'file';

export interface DocumentationSection {
  label: string;
  line: number;
  level: number;
}

export interface DocumentationFileMetadata {
  uri: vscode.Uri;
  relativePath: string;
  sections: DocumentationSection[];
}

export class DocumentationTreeItem extends vscode.TreeItem {
  constructor(
    public readonly type: DocumentationItemType,
    public readonly labelText: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly metadata?: DocumentationFileMetadata,
    public readonly children?: DocumentationTreeItem[],
    public readonly folderPath?: string
  ) {
    super(labelText, collapsibleState);

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

  private getContextValue(): string {
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

  private getTooltip(): vscode.MarkdownString | string | undefined {
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
      const args = encodeURIComponent(
        JSON.stringify({
          path: this.metadata?.uri.fsPath,
          line: section.line
        })
      );
      const indentation = '\u00A0'.repeat((section.level - 1) * 2);
      markdown.appendMarkdown(`${indentation}- [${section.label}](command:documentationHub.openSection?${args})\n`);
    });

    return markdown;
  }
}
