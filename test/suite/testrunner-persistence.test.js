const assert = require('assert');
const vscode = require('vscode');

const { TestRunnerManager } = require('../../apps/testRunner/TestRunnerManager');
const { ConfigManager } = require('../../src/config/ConfigManager');

suite('Test runner persistence', () => {
  let testRunnerManager;
  let configManager;
  let originalConfig;

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('your-name.command-manager');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
    
    testRunnerManager = TestRunnerManager.getInstance();
    configManager = ConfigManager.getInstance();
    await configManager.initialize();
  });

  setup(async () => {
    // Save original config
    originalConfig = JSON.parse(JSON.stringify(configManager.getConfig()));
  });

  teardown(async () => {
    // Restore original config
    await configManager.saveConfig(originalConfig);
  });

  test('disabled configuration persists after save and reload', async () => {
    // Create a test runner config
    const testConfig = {
      id: 'test-persistence-config',
      activated: true,
      title: 'Test Persistence',
      fileType: 'javascript',
      fileNamePattern: '*.test.js',
      testNamePattern: '*',
      runTestCommand: 'npm test -- $test_name'
    };

    // Save the config
    await testRunnerManager.saveConfig(testConfig);
    
    // Verify it's saved and activated
    let savedConfig = testRunnerManager.getConfigById('test-persistence-config');
    assert(savedConfig !== undefined, 'Config should exist');
    assert.strictEqual(savedConfig.activated, true, 'Config should be activated initially');

    // Disable it
    await testRunnerManager.setActivation('test-persistence-config', false);
    
    // Verify it's disabled
    savedConfig = testRunnerManager.getConfigById('test-persistence-config');
    assert.strictEqual(savedConfig.activated, false, 'Config should be disabled');

    // Reload config (simulate extension restart)
    await configManager.loadConfig();
    
    // Verify it's still disabled after reload
    const reloadedConfig = testRunnerManager.getConfigById('test-persistence-config');
    assert(reloadedConfig !== undefined, 'Config should still exist after reload');
    assert.strictEqual(reloadedConfig.activated, false, 'Config should remain disabled after reload');
  });

  test('enabled configuration persists after save and reload', async () => {
    // Create a disabled test runner config
    const testConfig = {
      id: 'test-enabled-config',
      activated: false,
      title: 'Test Enabled Persistence',
      fileType: 'javascript',
      fileNamePattern: '*.test.js',
      testNamePattern: '*',
      runTestCommand: 'npm test -- $test_name'
    };

    // Save the config
    await testRunnerManager.saveConfig(testConfig);
    
    // Verify it's saved and disabled
    let savedConfig = testRunnerManager.getConfigById('test-enabled-config');
    assert.strictEqual(savedConfig.activated, false, 'Config should be disabled initially');

    // Enable it
    await testRunnerManager.setActivation('test-enabled-config', true);
    
    // Verify it's enabled
    savedConfig = testRunnerManager.getConfigById('test-enabled-config');
    assert.strictEqual(savedConfig.activated, true, 'Config should be enabled');

    // Reload config
    await configManager.loadConfig();
    
    // Verify it's still enabled after reload
    const reloadedConfig = testRunnerManager.getConfigById('test-enabled-config');
    assert.strictEqual(reloadedConfig.activated, true, 'Config should remain enabled after reload');
  });

  test('toggle activation persists state', async () => {
    const testConfig = {
      id: 'test-toggle-config',
      activated: true,
      title: 'Test Toggle',
      fileType: 'javascript',
      fileNamePattern: '*.test.js',
      testNamePattern: '*',
      runTestCommand: 'npm test -- $test_name'
    };

    await testRunnerManager.saveConfig(testConfig);
    
    // Toggle off
    await testRunnerManager.toggleActivation('test-toggle-config');
    let config = testRunnerManager.getConfigById('test-toggle-config');
    assert.strictEqual(config.activated, false, 'Should be disabled after toggle');

    // Reload
    await configManager.loadConfig();
    config = testRunnerManager.getConfigById('test-toggle-config');
    assert.strictEqual(config.activated, false, 'Should remain disabled after reload');

    // Toggle on
    await testRunnerManager.toggleActivation('test-toggle-config');
    config = testRunnerManager.getConfigById('test-toggle-config');
    assert.strictEqual(config.activated, true, 'Should be enabled after toggle');

    // Reload again
    await configManager.loadConfig();
    config = testRunnerManager.getConfigById('test-toggle-config');
    assert.strictEqual(config.activated, true, 'Should remain enabled after reload');
  });
});

