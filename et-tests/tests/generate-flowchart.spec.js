const assert = require('assert');
const path = require('path');
const { VSBrowser, Workbench, EditorView } = require('vscode-extension-tester');

const WORKSPACE_PATH = path.resolve(__dirname, '../fixtures/python-flowchart');
const FLOWCHART_COMMAND = 'Generate Python Flowchart';
const FLOWCHART_PANEL_HINT = 'Flowchart';

describe('Generate Python Flowchart command', function () {
  this.timeout(240000);
  let workbench;

  before(async function () {
    const browser = VSBrowser.instance;
    await browser.openResources(WORKSPACE_PATH);
    workbench = new Workbench();
  });

  it('creates a flowchart panel after executing the command', async function () {
    const commandPrompt = await workbench.openCommandPrompt();
    await commandPrompt.setText(`>${FLOWCHART_COMMAND}`);

    const quickPicks = await commandPrompt.getQuickPicks();
    const labels = await Promise.all(quickPicks.map(async (pick) => pick.getLabel()));

    const match = labels.find((label) => label.toLowerCase().includes(FLOWCHART_COMMAND.toLowerCase()));
    assert.ok(match, `Unable to find quick pick for "${FLOWCHART_COMMAND}". Available options: ${labels.join(', ')}`);

    await commandPrompt.confirm();

    const editorView = new EditorView();

    await VSBrowser.instance.driver.wait(async () => {
      const titles = await editorView.getOpenEditorTitles();
      return titles.some((title) => title.toLowerCase().includes(FLOWCHART_PANEL_HINT.toLowerCase()));
    }, 60000, 'Flowchart panel was not opened');
  });
});
