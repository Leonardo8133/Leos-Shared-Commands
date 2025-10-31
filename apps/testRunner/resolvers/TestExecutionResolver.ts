import { DiscoveredTest } from '../TestRunnerManager';
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Base interface for test execution resolvers.
 * Resolvers extract the appropriate test path for batch execution
 * (running all tests in a file, folder, or test case).
 */
export interface TestExecutionResolver {
  /**
   * Resolves the path to execute all tests in a file.
   * For Python: "flowchart.tests.test_file" (removes TestCase.test_method)
   * For JS/TS: file path or module path
   */
  resolveFilePath(tests: DiscoveredTest[], config: { workingDirectory?: string }): string;

  /**
   * Resolves the path to execute all tests in a folder.
   * For Python: "flowchart.tests" (removes file and test details)
   * For JS/TS: folder path or module path
   */
  resolveFolderPath(tests: DiscoveredTest[], folderPath: string, config: { workingDirectory?: string }): string;

  /**
   * Resolves the path to execute all tests in a test case.
   * For Python: "flowchart.tests.test_file.TestCase" (removes test method)
   * For JS/TS: describe block path
   */
  resolveTestCasePath(tests: DiscoveredTest[], testCaseName: string, config: { workingDirectory?: string }): string;
}

/**
 * Helper function to get the workspace-relative module path for a file.
 */
export function getModulePath(fileUri: vscode.Uri, workingDirectory?: string): string {
  if (!vscode.workspace.workspaceFolders?.[0]) {
    // Fallback: try to use asRelativePath if available
    try {
      const relativePath = vscode.workspace.asRelativePath(fileUri, false);
      const pathWithoutExt = relativePath.replace(/\.[^.]+$/, '');
      return pathWithoutExt.replace(/\\/g, '/');
    } catch {
      return '';
    }
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
  const filePath = fileUri.fsPath.replace(/\\/g, '/');
  
  // If workingDirectory is specified, use it as the base (to exclude it from module path)
  // Otherwise use workspace root
  let basePath = workspaceRoot;
  if (workingDirectory) {
    basePath = path.resolve(workspaceRoot, workingDirectory).replace(/\\/g, '/');
  }

  // Check if file path starts with base path (case-insensitive on Windows)
  const filePathLower = process.platform === 'win32' ? filePath.toLowerCase() : filePath;
  const basePathLower = process.platform === 'win32' ? basePath.toLowerCase() : basePath;
  
  if (filePathLower.startsWith(basePathLower)) {
    // Use the original (not lowercased) paths for substring
    let modulePath = filePath.substring(basePath.length);
    // Remove leading slash if present
    if (modulePath.startsWith('/') || modulePath.startsWith('\\')) {
      modulePath = modulePath.substring(1);
    }
    // Remove extension
    modulePath = modulePath.replace(/\.[^.]+$/, '');
    // Normalize path separators
    modulePath = modulePath.replace(/\\/g, '/');
    // Remove leading dot if present (can happen with relative paths)
    if (modulePath.startsWith('./')) {
      modulePath = modulePath.substring(2);
    }
    // Remove leading dot if still present after removing ./
    if (modulePath.startsWith('.')) {
      modulePath = modulePath.substring(1);
    }
    // Remove leading slash if still present
    if (modulePath.startsWith('/')) {
      modulePath = modulePath.substring(1);
    }
    return modulePath;
  }

  // Fallback: if file path doesn't start with base path, try using asRelativePath
  // This handles cases where the file is outside the workspace or path resolution failed
  try {
    const relativePath = vscode.workspace.asRelativePath(fileUri, false);
    let pathWithoutExt = relativePath.replace(/\.[^.]+$/, '');
    pathWithoutExt = pathWithoutExt.replace(/\\/g, '/');
    
    // Remove leading slashes/dots first
    pathWithoutExt = pathWithoutExt.replace(/^\/+/, '').replace(/^\.\/+/, '');
    
    // If workingDirectory is specified, remove it from the path
    if (workingDirectory) {
      const workingDirNormalized = workingDirectory.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const pathNormalized = pathWithoutExt.replace(/^\/+|\/+$/g, '');
      if (pathNormalized.startsWith(workingDirNormalized + '/')) {
        pathWithoutExt = pathNormalized.substring(workingDirNormalized.length + 1);
      } else if (pathNormalized === workingDirNormalized) {
        // Path is exactly the working directory, return empty
        pathWithoutExt = '';
      }
    }
    
    // Remove leading dot if still present (e.g., ".path" -> "path")
    if (pathWithoutExt.startsWith('.')) {
      pathWithoutExt = pathWithoutExt.substring(1);
    }
    // Remove leading slash if still present
    if (pathWithoutExt.startsWith('/')) {
      pathWithoutExt = pathWithoutExt.substring(1);
    }
    return pathWithoutExt;
  } catch {
    return '';
  }
}

// Import resolvers at the top level
import { PythonResolver } from './PythonResolver';
import { JavaScriptResolver } from './JavaScriptResolver';
import { TypeScriptResolver } from './TypeScriptResolver';

/**
 * Factory function to get the appropriate resolver for a file type.
 */
export function getResolver(fileType: 'javascript' | 'typescript' | 'python'): TestExecutionResolver {
  switch (fileType) {
    case 'python':
      return new PythonResolver();
    case 'typescript':
      return new TypeScriptResolver();
    case 'javascript':
    default:
      return new JavaScriptResolver();
  }
}

