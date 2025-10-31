import * as vscode from 'vscode';
import * as path from 'path';
import { TestExecutionResolver, getModulePath } from './TestExecutionResolver';
import { DiscoveredTest } from '../TestRunnerManager';

export class PythonResolver implements TestExecutionResolver {
  resolveFilePath(tests: DiscoveredTest[], config: { workingDirectory?: string }): string {
    const { DebugLogger, DebugTag } = require('../../../src/utils/DebugLogger');
    
    if (tests.length === 0) {
      DebugLogger.log(DebugTag.RESOLVER, 'PythonResolver.resolveFilePath: No tests provided');
      return '';
    }

    // All tests should be from the same file
    const firstTest = tests[0];
    const modulePath = getModulePath(firstTest.file, config.workingDirectory);
    
    // Convert to dot notation (Python module path)
    // Remove leading slash/dot before converting
    let finalPath = modulePath.replace(/^[\/\.]+/, '').replace(/\//g, '.');
    
    DebugLogger.log(DebugTag.RESOLVER, 'PythonResolver.resolveFilePath', {
      filePath: firstTest.file.fsPath,
      relativePath: vscode.workspace.asRelativePath(firstTest.file, false),
      workingDirectory: config.workingDirectory,
      modulePath,
      finalPath
    });
    
    return finalPath;
  }

  resolveFolderPath(tests: DiscoveredTest[], folderPath: string, config: { workingDirectory?: string }): string {
    if (tests.length === 0) {
      return '';
    }

    // Get the common module path prefix for all tests in this folder
    // The folderPath is relative to workspace (e.g., "flowchart/tests")
    // Convert to Python module path
    return folderPath.replace(/\//g, '.').replace(/\\/g, '.');
  }

  resolveTestCasePath(tests: DiscoveredTest[], testCaseName: string, config: { workingDirectory?: string }): string {
    if (tests.length === 0) {
      return '';
    }

    // All tests should be from the same file and test case
    const firstTest = tests[0];
    const modulePath = getModulePath(firstTest.file, config.workingDirectory);
    
    // Convert to dot notation and append test case name
    // Example: flowchart.tests.test_file.TestCase
    // Remove leading slash/dot before converting
    const fileModulePath = modulePath.replace(/^[\/\.]+/, '').replace(/\//g, '.');
    return `${fileModulePath}.${testCaseName}`;
  }
}

