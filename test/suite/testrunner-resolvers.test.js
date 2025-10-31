const assert = require('assert');
const vscode = require('vscode');
const path = require('path');

const { getResolver } = require('../../apps/testRunner/resolvers/TestExecutionResolver');

suite('Test execution resolvers', () => {
  let workspaceRoot;

  suiteSetup(() => {
    workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  });

  function createMockTest(filePath, label, line = 0) {
    return {
      id: `test-${Date.now()}-${Math.random()}`,
      configId: 'test-config',
      label: label,
      file: vscode.Uri.file(path.join(workspaceRoot || '', filePath)),
      line: line,
      range: new vscode.Range(line, 0, line, 0)
    };
  }

  test('Resolver module loads correctly - catches import errors', () => {
    // This test MUST be first to catch module loading issues immediately
    // It verifies that all resolver classes can be imported and instantiated
    // This would catch the require() import issue we just fixed
    try {
      const pythonResolver = getResolver('python');
      const jsResolver = getResolver('javascript');
      const tsResolver = getResolver('typescript');
      
      assert(pythonResolver !== undefined && pythonResolver !== null, 'Python resolver should be defined');
      assert(jsResolver !== undefined && jsResolver !== null, 'JavaScript resolver should be defined');
      assert(tsResolver !== undefined && tsResolver !== null, 'TypeScript resolver should be defined');
      
      // Verify they have the expected methods
      assert(typeof pythonResolver.resolveFilePath === 'function', 'Python resolver should have resolveFilePath');
      assert(typeof jsResolver.resolveFilePath === 'function', 'JS resolver should have resolveFilePath');
      assert(typeof tsResolver.resolveFilePath === 'function', 'TS resolver should have resolveFilePath');
    } catch (error) {
      // If this fails, it means the module imports are broken
      assert.fail(`Resolver module failed to load: ${error.message}\nStack: ${error.stack}`);
    }
  });

  test('Python resolver - resolveFilePath extracts module path', () => {
    const resolver = getResolver('python');
    const tests = [
      createMockTest('flowchart/tests/test_file.py', 'TestCase.test_method', 10),
      createMockTest('flowchart/tests/test_file.py', 'TestCase.test_another', 20)
    ];

    const result = resolver.resolveFilePath(tests, {});
    assert.strictEqual(result, 'flowchart.tests.test_file', 'Should return module path without test details');
  });

  test('Python resolver - resolveFolderPath extracts folder module path', () => {
    const resolver = getResolver('python');
    const tests = [
      createMockTest('flowchart/tests/test_file1.py', 'TestCase1.test_method', 10),
      createMockTest('flowchart/tests/test_file2.py', 'TestCase2.test_method', 20)
    ];

    const result = resolver.resolveFolderPath(tests, 'flowchart/tests', {});
    assert.strictEqual(result, 'flowchart.tests', 'Should return folder as module path');
  });

  test('Python resolver - resolveTestCasePath includes test case name', () => {
    const resolver = getResolver('python');
    const tests = [
      createMockTest('flowchart/tests/test_file.py', 'TestCase.test_method1', 10),
      createMockTest('flowchart/tests/test_file.py', 'TestCase.test_method2', 20)
    ];

    const result = resolver.resolveTestCasePath(tests, 'TestCase', {});
    assert.strictEqual(result, 'flowchart.tests.test_file.TestCase', 'Should include test case name');
  });

  test('Python resolver - works with working directory', () => {
    const resolver = getResolver('python');
    const tests = [
      createMockTest('src/flowchart/tests/test_file.py', 'TestCase.test_method', 10)
    ];

    const result = resolver.resolveFilePath(tests, { workingDirectory: 'src' });
    assert.strictEqual(result, 'flowchart.tests.test_file', 'Should respect working directory');
  });

  test('JavaScript resolver - resolveFilePath returns file path', () => {
    const resolver = getResolver('javascript');
    const tests = [
      createMockTest('tests/test_file.test.js', 'test case', 10)
    ];

    const result = resolver.resolveFilePath(tests, {});
    assert(result.includes('test_file'), 'Should return file path');
  });

  test('JavaScript resolver - resolveFolderPath returns folder path', () => {
    const resolver = getResolver('javascript');
    const tests = [
      createMockTest('tests/test_file1.test.js', 'test 1', 10),
      createMockTest('tests/test_file2.test.js', 'test 2', 20)
    ];

    const result = resolver.resolveFolderPath(tests, 'tests', {});
    assert.strictEqual(result, 'tests', 'Should return folder path');
  });

  test('TypeScript resolver - resolveFilePath returns file path', () => {
    const resolver = getResolver('typescript');
    const tests = [
      createMockTest('tests/test_file.test.ts', 'test case', 10)
    ];

    const result = resolver.resolveFilePath(tests, {});
    assert(result.includes('test_file'), 'Should return file path');
  });

  test('Python resolver - extracts correct path from executable_test_path format', () => {
    const resolver = getResolver('python');
    // Simulate tests with executable_test_path format: flowchart.tests.test_file.TestCase.test_method
    const tests = [
      createMockTest('flowchart/tests/test_file.py', 'TestCase.test_method1', 10),
      createMockTest('flowchart/tests/test_file.py', 'TestCase.test_method2', 20),
      createMockTest('flowchart/tests/test_file.py', 'AnotherCase.test_method', 30)
    ];

    // When running all tests in file, should return just the file path
    const filePath = resolver.resolveFilePath(tests, {});
    assert.strictEqual(filePath, 'flowchart.tests.test_file', 'Should extract file path only');

    // When running all tests in TestCase, should include test case
    const testCasePath = resolver.resolveTestCasePath(tests.filter(t => t.label.startsWith('TestCase.')), 'TestCase', {});
    assert.strictEqual(testCasePath, 'flowchart.tests.test_file.TestCase', 'Should include test case name');
  });

  test('Resolvers handle empty test arrays', () => {
    const pythonResolver = getResolver('python');
    const jsResolver = getResolver('javascript');
    const tsResolver = getResolver('typescript');

    assert.strictEqual(pythonResolver.resolveFilePath([], {}), '');
    assert.strictEqual(jsResolver.resolveFilePath([], {}), '');
    assert.strictEqual(tsResolver.resolveFilePath([], {}), '');
  });
});

