const assert = require('assert');

const {
  moveCommandInConfig,
  moveFolderInConfig
} = require('../../out/src/treeView/moveOperations');

describe('Tree move operations', () => {
  let config;

  beforeEach(() => {
    config = {
      folders: [
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
              commands: [],
              subfolders: []
            }
          ]
        },
        {
          name: 'Folder B',
          commands: [
            { id: 'cmd-4', label: 'Command 4', command: 'echo 4', terminal: { type: 'vscode-new' } }
          ],
          subfolders: []
        }
      ]
    };
  });

  it('reorders commands within the same folder', () => {
    const moved = moveCommandInConfig(
      config,
      { path: [0], commandId: 'cmd-1' },
      { folderPath: [0], index: 2, position: 'before' }
    );

    assert.strictEqual(moved, true);
    assert.deepStrictEqual(config.folders[0].commands.map(c => c.id), ['cmd-2', 'cmd-3', 'cmd-1']);
  });

  it('moves command into a different folder', () => {
    const moved = moveCommandInConfig(
      config,
      { path: [0], commandId: 'cmd-3' },
      { folderPath: [1], position: 'into' }
    );

    assert.strictEqual(moved, true);
    assert.deepStrictEqual(config.folders[0].commands.map(c => c.id), ['cmd-1', 'cmd-2']);
    assert.deepStrictEqual(config.folders[1].commands.map(c => c.id), ['cmd-4', 'cmd-3']);
  });

  it('moves a folder into another folder', () => {
    const moved = moveFolderInConfig(
      config,
      { path: [0, 0] },
      { parentPath: [1], position: 'into' }
    );

    assert.strictEqual(moved, true);
    assert.strictEqual(config.folders[0].subfolders.length, 0);
    assert.strictEqual(config.folders[1].subfolders.length, 1);
    assert.strictEqual(config.folders[1].subfolders[0].name, 'Subfolder A1');
  });

  it('prevents moving a folder into its descendant', () => {
    // Prepare nested structure: move folder B under folder A first
    moveFolderInConfig(config, { path: [1] }, { parentPath: [0], position: 'into' });

    const snapshot = JSON.stringify(config);
    const moved = moveFolderInConfig(
      config,
      { path: [0] },
      { parentPath: [0, 1, 0], position: 'into' }
    );

    assert.strictEqual(moved, false);
    assert.strictEqual(JSON.stringify(config), snapshot);
  });
});

