const assert = require('assert');
const vscode = require('vscode');

const { TerminalManager } = require('../../src/execution/TerminalManager');

suite('Terminal disposal integration', () => {
  const terminalManager = TerminalManager.getInstance();
  let executedCommands = [];
  let terminalNames = [];

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('your-name.command-manager');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  setup(() => {
    executedCommands = [];
    terminalNames = [];
    
    // Mock terminal execution to track what gets executed
    terminalManager.setRunner(async (command, config) => {
      executedCommands.push(command);
      if (config.name) {
        terminalNames.push(config.name);
      }
    });
  });

  teardown(() => {
    terminalManager.setRunner(undefined);
    // Clean up any terminals that were created
    terminalManager.disposeAllTerminals();
  });

  test('disposes existing terminal before creating new one with same name', async () => {
    const terminalName = 'Test Terminal';
    const config = {
      type: 'vscode-new',
      name: terminalName
    };

    // First execution - creates terminal
    await terminalManager.executeCommand('echo "Command A"', config);
    
    // Verify terminal was created
    const firstTerminal = terminalManager.getTerminal(terminalName);
    assert(firstTerminal !== undefined, 'First terminal should exist');

    // Second execution with same name - should dispose old terminal and create new one
    await terminalManager.executeCommand('echo "Command B"', config);
    
    // Verify both commands were executed
    assert.strictEqual(executedCommands.length, 2, 'Both commands should be executed');
    assert.strictEqual(executedCommands[0], 'echo "Command A"');
    assert.strictEqual(executedCommands[1], 'echo "Command B"');

    // Verify terminal still exists (new one was created)
    const secondTerminal = terminalManager.getTerminal(terminalName);
    assert(secondTerminal !== undefined, 'New terminal should exist after disposal');
    
    // Verify it's a different terminal instance (old one was disposed)
    assert.notStrictEqual(firstTerminal, secondTerminal, 'Terminal should be a new instance');
  });

  test('handles multiple terminals with different names', async () => {
    const configA = { type: 'vscode-new', name: 'Terminal A' };
    const configB = { type: 'vscode-new', name: 'Terminal B' };

    await terminalManager.executeCommand('echo "A1"', configA);
    await terminalManager.executeCommand('echo "B1"', configB);
    await terminalManager.executeCommand('echo "A2"', configA);
    await terminalManager.executeCommand('echo "B2"', configB);

    assert.strictEqual(executedCommands.length, 4);
    assert.strictEqual(executedCommands[0], 'echo "A1"');
    assert.strictEqual(executedCommands[1], 'echo "B1"');
    assert.strictEqual(executedCommands[2], 'echo "A2"');
    assert.strictEqual(executedCommands[3], 'echo "B2"');

    // Both terminals should exist
    assert(terminalManager.getTerminal('Terminal A') !== undefined);
    assert(terminalManager.getTerminal('Terminal B') !== undefined);
  });
});

