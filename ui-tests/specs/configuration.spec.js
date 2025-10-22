const assert = require('assert');

describe('Configuration webview', () => {
  it('opens the configuration manager with compact forms', async () => {
    const workbench = await browser.getWorkbench();
    await workbench.executeCommand('Command Manager: Configuration');

    const editorView = await workbench.getEditorView();
    await browser.waitUntil(async () => {
      const titles = await editorView.getOpenEditorTitles();
      return titles.includes('Command Configuration');
    }, { timeout: 15000, timeoutMsg: 'Configuration webview did not open' });

    const editor = await editorView.openEditor('Command Configuration');
    if (typeof editor.switchToFrame !== 'function') {
      throw new Error('Expected a webview editor');
    }

    await editor.switchToFrame();
    const form = await $('#variable-form');
    await form.waitForExist({ timeout: 10000 });
    const listForm = await $('#list-form');
    assert.strictEqual(await form.isExisting(), true);
    assert.strictEqual(await listForm.isExisting(), true);
    await editor.switchBack();
  });
});
