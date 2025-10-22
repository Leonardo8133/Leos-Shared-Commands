const assert = require('assert');
const vscode = require('vscode');

const { CommandExecutor } = require('../../out/src/execution/CommandExecutor');
const { TerminalManager } = require('../../out/src/execution/TerminalManager');
const { ConfigManager } = require('../../out/src/config/ConfigManager');

suite('Command execution integration', () => {
  const executor = CommandExecutor.getInstance();
  const terminalManager = TerminalManager.getInstance();
  const configManager = ConfigManager.getInstance();

  let originalQuickPick;
  let executedCommand;

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('your-name.command-manager');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  setup(async () => {
    executedCommand = '';
    terminalManager.setRunner(async (command) => {
      executedCommand = command;
    });

    const config = configManager.getConfig();
    config.folders = [
      {
        name: 'Tests',
        icon: '$(beaker)',
        commands: [],
        subfolders: []
      }
    ];
    config.sharedVariables = [
      { key: 'FOO', label: 'Foo', value: 'bar' }
    ];
    config.sharedLists = [
      { key: 'TARGET', label: 'Target', options: ['dev', 'prod', 'staging'] }
    ];
    await configManager.saveConfig(config);
  });

  teardown(() => {
    terminalManager.setRunner(undefined);
    if (originalQuickPick) {
      vscode.window.showQuickPick = originalQuickPick;
      originalQuickPick = undefined;
    }
  });

  test('resolves fixed variables without prompts', async () => {
    const result = await executor.executeCommand({
      id: 'fixed-test',
      label: 'Echo fixed',
      command: 'echo $FOO',
      terminal: { type: 'vscode-new', keepOpen: false },
      variables: [{ key: 'FOO', type: 'fixed', label: 'Foo' }]
    });

    assert.strictEqual(result.success, true, result.error);
    assert.strictEqual(executedCommand, 'echo bar');
  });

  test('prompts for list variables and uses the selected option', async () => {
    originalQuickPick = vscode.window.showQuickPick;
    vscode.window.showQuickPick = async () => 'prod';

    const result = await executor.executeCommand({
      id: 'list-test',
      label: 'Deploy',
      command: 'deploy $TARGET',
      terminal: { type: 'vscode-new', keepOpen: false },
      variables: [{ key: 'TARGET', type: 'list', label: 'Target' }]
    });

    assert.strictEqual(result.success, true, result.error);
    assert.strictEqual(executedCommand, 'deploy prod');
  });

  test('fails gracefully when a variable is missing', async () => {
    const result = await executor.executeCommand({
      id: 'missing-test',
      label: 'Missing variable',
      command: 'echo $MISSING',
      terminal: { type: 'vscode-new', keepOpen: false },
      variables: [{ key: 'MISSING', type: 'fixed', label: 'Missing' }]
    });

    assert.strictEqual(result.success, false, 'Command should fail when variable is missing');
    assert.strictEqual(executedCommand, '', 'Command should not execute when variable is missing');
  });
});
