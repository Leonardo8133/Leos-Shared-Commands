const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');

const { ConfigManager } = require('../../src/config/ConfigManager');

suite('ConfigManager filesystem layout', () => {
  let tempRoot;

  async function initializeWithTempRoot() {
    ConfigManager.resetForTests();
    process.env.COMMAND_MANAGER_CONFIG_ROOT = tempRoot;
    const manager = ConfigManager.getInstance();
    await manager.initialize();
    return manager;
  }

  function cleanupTempRoot() {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    tempRoot = undefined;
  }

  teardown(() => {
    ConfigManager.resetForTests();
    delete process.env.COMMAND_MANAGER_CONFIG_ROOT;
    cleanupTempRoot();
  });

  test('initialization creates commands directory with default files', async function () {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      this.skip();
      return;
    }

    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'config-manager-test-'));

    const manager = await initializeWithTempRoot();
    manager.dispose();

    const commandsDir = path.join(tempRoot, 'commands');
    const commandsFile = path.join(commandsDir, 'commands.json');
    const timeTrackerFile = path.join(commandsDir, 'commands-timer.json');
    const backupFile = path.join(commandsDir, 'commands-timer-backup.json');

    assert.ok(fs.existsSync(commandsDir), 'commands directory should be created');
    assert.ok(fs.existsSync(commandsFile), 'commands.json should be created');
    assert.ok(fs.existsSync(timeTrackerFile), 'commands-timer.json should be created');
    assert.ok(fs.existsSync(backupFile), 'commands-timer-backup.json should be created after initialization');

    const configJson = JSON.parse(fs.readFileSync(commandsFile, 'utf8'));
    assert.strictEqual(typeof configJson.version, 'number');
    assert.ok(Array.isArray(configJson.folders), 'default config should include folders array');
  });

  test('migration moves legacy files into commands directory', async function () {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      this.skip();
      return;
    }

    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'config-manager-migrate-'));

    const legacyCommands = {
      folders: [],
      testRunners: [],
      sharedVariables: [],
      sharedLists: [],
      version: 3,
      lastModified: new Date().toISOString()
    };

    const legacyTimer = {
      folders: [],
      ignoredBranches: [],
      autoCreateOnBranchCheckout: true,
      enabled: true
    };

    fs.writeFileSync(path.join(tempRoot, 'commands.json'), JSON.stringify(legacyCommands, null, 2));
    fs.writeFileSync(path.join(tempRoot, 'commands-timer.json'), JSON.stringify(legacyTimer, null, 2));
    fs.writeFileSync(path.join(tempRoot, 'commands-timer-backup.json'), JSON.stringify(legacyTimer, null, 2));

    const manager = await initializeWithTempRoot();
    manager.dispose();

    const commandsDir = path.join(tempRoot, 'commands');
    const migratedCommands = path.join(commandsDir, 'commands.json');
    const migratedTimer = path.join(commandsDir, 'commands-timer.json');
    const migratedBackup = path.join(commandsDir, 'commands-timer-backup.json');

    assert.ok(fs.existsSync(commandsDir), 'commands directory should be created during migration');
    assert.ok(fs.existsSync(migratedCommands), 'legacy commands.json should be migrated');
    assert.ok(fs.existsSync(migratedTimer), 'legacy commands-timer.json should be migrated');
    assert.ok(fs.existsSync(migratedBackup), 'legacy backup should be migrated');
    assert.ok(!fs.existsSync(path.join(tempRoot, 'commands.json')), 'legacy commands.json should be removed');
    assert.ok(!fs.existsSync(path.join(tempRoot, 'commands-timer.json')), 'legacy commands-timer.json should be removed');

    const migratedConfig = JSON.parse(fs.readFileSync(migratedCommands, 'utf8'));
    assert.strictEqual(migratedConfig.version, legacyCommands.version, 'migrated config should preserve version');

    const migratedTimerConfig = JSON.parse(fs.readFileSync(migratedTimer, 'utf8'));
    assert.deepStrictEqual(migratedTimerConfig.folders, legacyTimer.folders, 'migrated timer config should preserve folders');
  });
});

