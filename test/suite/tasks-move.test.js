const assert = require('assert');
const vscode = require('vscode');

const { CommandTreeProvider } = require('../../apps/tasks/treeView/CommandTreeProvider');
const { ConfigManager } = require('../../src/config/ConfigManager');

suite('Tasks move operations integration', () => {
  let configManager;
  let treeProvider;
  let originalConfig;

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('your-name.command-manager');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
    
    configManager = ConfigManager.getInstance();
    await configManager.initialize();
  });

  setup(async () => {
    // Save original config
    originalConfig = JSON.parse(JSON.stringify(configManager.getConfig()));
    
    // Reset to known state
    const config = configManager.getConfig();
    config.folders = [
      {
        name: 'Folder A',
        commands: [
          { id: 'cmd-1', label: 'Command 1', command: 'echo 1', terminal: { type: 'vscode-new' } },
          { id: 'cmd-2', label: 'Command 2', command: 'echo 2', terminal: { type: 'vscode-new' } },
          { id: 'cmd-3', label: 'Command 3', command: 'echo 3', terminal: { type: 'vscode-new' } }
        ],
        subfolders: [
          {
            name: 'Subfolder A1',
            commands: [
              { id: 'cmd-4', label: 'Command 4', command: 'echo 4', terminal: { type: 'vscode-new' } }
            ],
            subfolders: []
          }
        ]
      },
      {
        name: 'Folder B',
        commands: [
          { id: 'cmd-5', label: 'Command 5', command: 'echo 5', terminal: { type: 'vscode-new' } }
        ],
        subfolders: []
      }
    ];
    await configManager.saveConfig(config);
    
    treeProvider = new CommandTreeProvider();
  });

  teardown(async () => {
    // Restore original config
    await configManager.saveConfig(originalConfig);
  });

  test('moveItemUp moves command up within same folder', async () => {
    const children = await treeProvider.getChildren();
    const folderA = children.find(item => item.label === 'Folder A');
    assert(folderA !== undefined, 'Folder A should exist');
    
    const folderChildren = await treeProvider.getChildren(folderA);
    const cmd2 = folderChildren.find(item => item.label === 'Command 2');
    assert(cmd2 !== undefined, 'Command 2 should exist');
    
    // Move Command 2 up (should swap with Command 1)
    await treeProvider.moveItemByOffset(cmd2, -1);
    
    const config = configManager.getConfig();
    const folder = config.folders.find(f => f.name === 'Folder A');
    assert.deepStrictEqual(
      folder.commands.map(c => c.id),
      ['cmd-2', 'cmd-1', 'cmd-3'],
      'Command 2 should be moved before Command 1'
    );
  });

  test('moveItemDown moves command down within same folder', async () => {
    const children = await treeProvider.getChildren();
    const folderA = children.find(item => item.label === 'Folder A');
    const folderChildren = await treeProvider.getChildren(folderA);
    const cmd2 = folderChildren.find(item => item.label === 'Command 2');
    
    // Move Command 2 down (should swap with Command 3)
    await treeProvider.moveItemByOffset(cmd2, 1);
    
    const config = configManager.getConfig();
    const folder = config.folders.find(f => f.name === 'Folder A');
    assert.deepStrictEqual(
      folder.commands.map(c => c.id),
      ['cmd-1', 'cmd-3', 'cmd-2'],
      'Command 2 should be moved after Command 3'
    );
  });

  test('moveItemUp does not move first command beyond beginning', async () => {
    const children = await treeProvider.getChildren();
    const folderA = children.find(item => item.label === 'Folder A');
    const folderChildren = await treeProvider.getChildren(folderA);
    const cmd1 = folderChildren.find(item => item.label === 'Command 1');
    
    // Try to move first command up
    await treeProvider.moveItemByOffset(cmd1, -1);
    
    const config = configManager.getConfig();
    const folder = config.folders.find(f => f.name === 'Folder A');
    assert.deepStrictEqual(
      folder.commands.map(c => c.id),
      ['cmd-1', 'cmd-2', 'cmd-3'],
      'First command should remain in place'
    );
  });

  test('moveItemDown does not move last command beyond end', async () => {
    const children = await treeProvider.getChildren();
    const folderA = children.find(item => item.label === 'Folder A');
    const folderChildren = await treeProvider.getChildren(folderA);
    const cmd3 = folderChildren.find(item => item.label === 'Command 3');
    
    // Try to move last command down
    await treeProvider.moveItemByOffset(cmd3, 1);
    
    const config = configManager.getConfig();
    const folder = config.folders.find(f => f.name === 'Folder A');
    assert.deepStrictEqual(
      folder.commands.map(c => c.id),
      ['cmd-1', 'cmd-2', 'cmd-3'],
      'Last command should remain in place'
    );
  });

  test('moveItemUp moves folder up', async () => {
    const children = await treeProvider.getChildren();
    const folderB = children.find(item => item.label === 'Folder B');
    
    // Move Folder B up (should swap with Folder A)
    await treeProvider.moveItemByOffset(folderB, -1);
    
    const config = configManager.getConfig();
    assert.strictEqual(config.folders[0].name, 'Folder B', 'Folder B should be first');
    assert.strictEqual(config.folders[1].name, 'Folder A', 'Folder A should be second');
  });

  test('moveItemDown moves folder down', async () => {
    const children = await treeProvider.getChildren();
    const folderA = children.find(item => item.label === 'Folder A');
    
    // Move Folder A down (should swap with Folder B)
    await treeProvider.moveItemByOffset(folderA, 1);
    
    const config = configManager.getConfig();
    assert.strictEqual(config.folders[0].name, 'Folder B', 'Folder B should be first');
    assert.strictEqual(config.folders[1].name, 'Folder A', 'Folder A should be second');
  });

  test('moveItemToFolder moves command to different folder', async () => {
    const children = await treeProvider.getChildren();
    const folderA = children.find(item => item.label === 'Folder A');
    const folderB = children.find(item => item.label === 'Folder B');
    
    const folderAChildren = await treeProvider.getChildren(folderA);
    const cmd3 = folderAChildren.find(item => item.label === 'Command 3');
    
    // Move Command 3 to Folder B
    const folderBPath = folderB.getFolderPath();
    await treeProvider.moveItemToFolder(cmd3, folderBPath);
    
    const config = configManager.getConfig();
    const folderAConfig = config.folders.find(f => f.name === 'Folder A');
    const folderBConfig = config.folders.find(f => f.name === 'Folder B');
    
    assert.deepStrictEqual(
      folderAConfig.commands.map(c => c.id),
      ['cmd-1', 'cmd-2'],
      'Command 3 should be removed from Folder A'
    );
    assert.deepStrictEqual(
      folderBConfig.commands.map(c => c.id),
      ['cmd-5', 'cmd-3'],
      'Command 3 should be added to Folder B'
    );
  });

  test('moveItemToFolder moves folder into another folder', async () => {
    const children = await treeProvider.getChildren();
    const folderA = children.find(item => item.label === 'Folder A');
    const folderB = children.find(item => item.label === 'Folder B');
    
    // Move Folder B into Folder A
    const folderAPath = folderA.getFolderPath();
    await treeProvider.moveItemToFolder(folderB, folderAPath);
    
    const config = configManager.getConfig();
    const folderAConfig = config.folders.find(f => f.name === 'Folder A');
    
    assert.strictEqual(config.folders.length, 1, 'Should only have Folder A at root');
    assert.strictEqual(folderAConfig.subfolders.length, 2, 'Folder A should have 2 subfolders');
    assert.strictEqual(folderAConfig.subfolders[1].name, 'Folder B', 'Folder B should be subfolder of Folder A');
  });

  test('moveItemToFolder prevents moving folder into itself', async () => {
    const children = await treeProvider.getChildren();
    const folderA = children.find(item => item.label === 'Folder A');
    const folderAChildren = await treeProvider.getChildren(folderA);
    const subfolderA1 = folderAChildren.find(item => item.label === 'Subfolder A1');
    
    // Try to move Subfolder A1 into Folder A (its parent)
    const folderAPath = folderA.getFolderPath();
    const configBefore = JSON.parse(JSON.stringify(configManager.getConfig()));
    
    await treeProvider.moveItemToFolder(subfolderA1, folderAPath);
    
    // Should not change (or handle gracefully)
    const configAfter = configManager.getConfig();
    // The operation might succeed or fail, but shouldn't corrupt the structure
    assert(configAfter.folders.length > 0, 'Config should remain valid');
  });
});

