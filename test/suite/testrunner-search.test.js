const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vscode = require('vscode');

const { TestRunnerTreeProvider } = require('../../apps/testRunner/TestRunnerTreeProvider');

class StubTestRunnerManager {
  constructor(configs, testsByConfig) {
    this.configs = configs;
    this.testsByConfig = testsByConfig;
  }

  getConfigs() {
    return this.configs;
  }

  async discoverTests(config) {
    return this.testsByConfig[config.id] || [];
  }

  onDidChange() {
    return { dispose() {} };
  }
}

async function collectTestLabels(provider, item) {
  const children = await provider.getChildren(item);
  const labels = [];
  for (const child of children) {
    if (child.itemType === 'test' && child.test) {
      labels.push(child.test.label);
    } else if (child.itemType !== 'placeholder') {
      const nested = await collectTestLabels(provider, child);
      labels.push(...nested);
    }
  }
  return labels;
}

suite('Test runner search filtering', () => {
  let workspaceRoot;
  let tempDir;
  let provider;
  let manager;
  let config;
  let tests;
  let testFilePath;

  suiteSetup(() => {
    workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
      path.resolve(__dirname, '../../..');
  });

  setup(async function () {
    tempDir = path.join(workspaceRoot, 'test-runner-search');
    await fs.promises.rm(tempDir, { recursive: true, force: true });

    const testsDir = path.join(tempDir, 'tests');
    await fs.promises.mkdir(testsDir, { recursive: true });

    testFilePath = path.join(testsDir, 'test_sample.py');
    await fs.promises.writeFile(
      testFilePath,
      [
        'import unittest',
        '',
        'class TestCaseOne(unittest.TestCase):',
        '    def test_alpha(self):',
        '        pass',
        '',
        'class TestCaseTwo(unittest.TestCase):',
        '    def test_basic(self):',
        '        pass',
        ''
      ].join('\n')
    );

    config = {
      id: 'search-config',
      activated: true,
      title: 'Python',
      fileType: 'python',
      fileNamePattern: '*',
      testNamePattern: '*',
      runTestCommand: 'pytest $test_name'
    };

    const testFileUri = vscode.Uri.file(testFilePath);
    tests = [
      {
        id: 'search-1',
        configId: config.id,
        label: 'TestCaseOne.test_alpha',
        file: testFileUri,
        line: 2,
        range: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 0))
      },
      {
        id: 'search-2',
        configId: config.id,
        label: 'TestCaseTwo.test_basic',
        file: testFileUri,
        line: 8,
        range: new vscode.Range(new vscode.Position(8, 0), new vscode.Position(8, 0))
      }
    ];

    manager = new StubTestRunnerManager([config], { [config.id]: tests });
    provider = new TestRunnerTreeProvider(manager);
    provider.cacheTests(config.id, tests);
  });

  teardown(async () => {
    if (provider?.dispose) {
      provider.dispose();
    }
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('search filters tests by method name substring', async function () {
    provider.searchQuery = 'basic';
    provider.refresh();

    const rootItems = await provider.getChildren();
    const configItem = rootItems.find(item => item.isConfig());
    assert(configItem, 'Config item should be visible when tests match search query');

    const matchingTestLabels = await collectTestLabels(provider, configItem);
    assert.deepStrictEqual(matchingTestLabels.sort(), ['TestCaseTwo.test_basic']);
  });

  test('search matches file names and includes all tests in that file', async function () {
    provider.searchQuery = 'test_sample';
    provider.refresh();

    const rootItems = await provider.getChildren();
    const configItem = rootItems.find(item => item.isConfig());
    assert(configItem, 'Config item should be visible when file name matches search query');

    const matchingTestLabels = await collectTestLabels(provider, configItem);
    assert.deepStrictEqual(
      matchingTestLabels.sort(),
      ['TestCaseOne.test_alpha', 'TestCaseTwo.test_basic']
    );
  });
});

