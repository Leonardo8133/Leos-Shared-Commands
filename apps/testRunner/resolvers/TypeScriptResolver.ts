import * as vscode from 'vscode';
import * as path from 'path';
import { TestExecutionResolver, getModulePath } from './TestExecutionResolver';
import { DiscoveredTest } from '../TestRunnerManager';

export class TypeScriptResolver implements TestExecutionResolver {
  resolveFilePath(tests: DiscoveredTest[], config: { workingDirectory?: string }): string {
    if (tests.length === 0) {
      return '';
    }

    // For TypeScript, similar to JavaScript - return the file path
    const firstTest = tests[0];
    
    if (config.workingDirectory && vscode.workspace.workspaceFolders?.[0]) {
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const workingDir = path.resolve(workspaceRoot, config.workingDirectory);
      const relativePath = path.relative(workingDir, firstTest.file.fsPath);
      return relativePath.replace(/\\/g, '/');
    }

    // Return workspace-relative path
    return vscode.workspace.asRelativePath(firstTest.file, false);
  }

  resolveFolderPath(tests: DiscoveredTest[], folderPath: string, config: { workingDirectory?: string }): string {
    // For TypeScript, return the folder path pattern
    return folderPath.replace(/\\/g, '/');
  }

  resolveTestCasePath(tests: DiscoveredTest[], testCaseName: string, config: { workingDirectory?: string }): string {
    // For TypeScript, test cases are usually describe blocks
    // Return the file path (test runners handle filtering)
    const filePath = this.resolveFilePath(tests, config);
    return filePath; // TS test runners typically filter by test name pattern
  }
}

