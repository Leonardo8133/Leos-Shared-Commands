const assert = require('assert');
const path = require('path');
const { VSBrowser, Workbench } = require('vscode-extension-tester');

const WORKSPACE_PATH = path.resolve(__dirname, '../fixtures/python-flowchart');

describe('Sample vscode-extension-tester smoke test', function () {
  this.timeout(180000);
  let workbench;

  before(async function () {
    const browser = VSBrowser.instance;
    await browser.openResources(WORKSPACE_PATH);
    workbench = new Workbench();
  });

  it('opens the command palette and lists built-in commands', async function () {
    const input = await workbench.openCommandPrompt();
    await input.setText('>View: Toggle Terminal');

    const quickPicks = await input.getQuickPicks();
    const labels = await Promise.all(quickPicks.map(async (quickPick) => quickPick.getLabel()));

    assert.ok(labels.some((label) => label.includes('View: Toggle Terminal')));

    await input.cancel();
  });
});
