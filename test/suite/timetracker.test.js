const assert = require('assert');
const vscode = require('vscode');

const { TimeTrackerManager } = require('../../apps/timeTracker/TimeTrackerManager');
const { ConfigManager } = require('../../src/config/ConfigManager');
const { WebviewManager } = require('../../src/ui/webview/WebviewManager');

suite('Time Tracker', () => {
  let timeTrackerManager;
  let configManager;
  let originalConfig;
  let originalTimeTrackerConfig;

  // Helper function to find a timer in the config
  const findTimerInConfig = (folders, targetId) => {
    for (const folder of folders) {
      for (const t of folder.timers) {
        if (t.id === targetId) return t;
      }
      if (folder.subfolders) {
        const found = findTimerInConfig(folder.subfolders, targetId);
        if (found) return found;
      }
    }
    return undefined;
  };

  const loadTimeConfig = async () => {
    await configManager.reloadTimeTrackerConfig();
    return configManager.getTimeTrackerConfig();
  };

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('your-name.command-manager');
    if (extension && !extension.isActive) {
      await extension.activate();
    }

    timeTrackerManager = TimeTrackerManager.getInstance();
    configManager = ConfigManager.getInstance();
    await configManager.initialize();
  });

  setup(async () => {
    // Save original config
    originalConfig = JSON.parse(JSON.stringify(configManager.getConfig()));
    originalTimeTrackerConfig = JSON.parse(JSON.stringify(configManager.getTimeTrackerConfig()));
    
    // Clear time tracker config for clean tests
    await configManager.saveTimeTrackerConfig({
      folders: [],
      ignoredBranches: [],
      autoCreateOnBranchCheckout: true,
      enabled: true
    });
  });

  teardown(async () => {
    // Restore original config
    await configManager.saveConfig(originalConfig);
    await configManager.saveTimeTrackerConfig(originalTimeTrackerConfig);
  });

  suite('Timer Operations', () => {
    test('startTimer creates a new timer', async () => {
      const timer = await timeTrackerManager.startTimer('Test Timer');
      
      assert(timer !== undefined, 'Timer should be created');
      assert.strictEqual(timer.label, 'Test Timer', 'Timer label should match');
      assert(timer.startTime !== undefined, 'Timer should have start time');
      assert.strictEqual(timer.endTime, undefined, 'Timer should be running');
      assert.strictEqual(timer.archived, false, 'Timer should not be archived');
    });

    test('startTimer stops other running timers', async () => {
      const timer1 = await timeTrackerManager.startTimer('Timer 1');
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      const timer2 = await timeTrackerManager.startTimer('Timer 2');

      // Reload config to check state
      const timeConfig = await loadTimeConfig();
      
      const savedTimer1 = findTimerInConfig(timeConfig.folders, timer1.id);
      assert(savedTimer1 !== undefined, 'Timer 1 should exist');
      assert(savedTimer1.endTime !== undefined, 'Timer 1 should be stopped');
      assert.strictEqual(timer2.endTime, undefined, 'Timer 2 should be running');
    });

    test('stopTimer stops a running timer', async () => {
      const timer = await timeTrackerManager.startTimer('Test Timer');
      await timeTrackerManager.stopTimer(timer.id);

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert(savedTimer !== undefined, 'Timer should exist');
      assert(savedTimer.endTime !== undefined, 'Timer should be stopped');
    });

    test('resumeTimer resumes a stopped timer', async () => {
      const timer = await timeTrackerManager.startTimer('Test Timer');
      await timeTrackerManager.stopTimer(timer.id);
      
      const beforeResume = new Date();
      await timeTrackerManager.resumeTimer(timer.id);
      const afterResume = new Date();

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert(savedTimer !== undefined, 'Timer should exist');
      assert.strictEqual(savedTimer.endTime, undefined, 'Timer should be running after resume');
    });

    test('editTimer updates timer properties', async () => {
      const timer = await timeTrackerManager.startTimer('Original Label');
      await timeTrackerManager.editTimer(timer.id, { label: 'Updated Label' });

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert(savedTimer !== undefined, 'Timer should exist');
      assert.strictEqual(savedTimer.label, 'Updated Label', 'Timer label should be updated');
    });

    test('archiveTimer archives a timer', async () => {
      const timer = await timeTrackerManager.startTimer('Test Timer');
      await timeTrackerManager.archiveTimer(timer.id, true);

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert(savedTimer !== undefined, 'Timer should exist');
      assert.strictEqual(savedTimer.archived, true, 'Timer should be archived');
    });

    test('deleteTimer removes a timer', async () => {
      const timer = await timeTrackerManager.startTimer('Test Timer');
      await timeTrackerManager.deleteTimer(timer.id);

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert.strictEqual(savedTimer, undefined, 'Timer should be deleted');
    });

    test('moveTimerByOffset reorders timers', async () => {
      const timer1 = await timeTrackerManager.startTimer('Timer 1');
      await timeTrackerManager.stopTimer(timer1.id);
      const timer2 = await timeTrackerManager.startTimer('Timer 2');
      await timeTrackerManager.stopTimer(timer2.id);
      const timer3 = await timeTrackerManager.startTimer('Timer 3');

      // Move timer3 up by 1 (should swap with timer2)
      await timeTrackerManager.moveTimerByOffset(timer3.id, -1);

      const timeConfig = await loadTimeConfig();
      const rootFolder = timeConfig.folders.find(f => f.name === '');
      assert(rootFolder !== undefined, 'Root folder should exist');
      assert.strictEqual(rootFolder.timers[1].id, timer3.id, 'Timer3 should be at index 1');
      assert.strictEqual(rootFolder.timers[2].id, timer2.id, 'Timer2 should be at index 2');
    });
  });

  suite('SubTimer Operations', () => {
    test('createSubTimer creates a subtimer', async () => {
      const timer = await timeTrackerManager.startTimer('Parent Timer');
      const subtimer = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 1', 'Description');

      assert(subtimer !== undefined, 'SubTimer should be created');
      assert.strictEqual(subtimer.label, 'SubTimer 1', 'SubTimer label should match');
      assert.strictEqual(subtimer.description, 'Description', 'SubTimer description should match');
      assert(subtimer.startTime !== undefined, 'SubTimer should have start time');
      assert.strictEqual(subtimer.endTime, undefined, 'SubTimer should be running');

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert(savedTimer !== undefined, 'Timer should exist');
      assert(savedTimer.subtimers !== undefined, 'Timer should have subtimers');
      assert.strictEqual(savedTimer.subtimers.length, 1, 'Timer should have one subtimer');
    });

    test('createSubTimer pauses other running subtimers', async () => {
      const timer = await timeTrackerManager.startTimer('Parent Timer');
      const subtimer1 = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 1');
      await new Promise(resolve => setTimeout(resolve, 100));
      const subtimer2 = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 2');

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      const savedSubTimer1 = savedTimer.subtimers.find(st => st.id === subtimer1.id);
      assert(savedSubTimer1.endTime !== undefined, 'SubTimer 1 should be paused');
      assert.strictEqual(subtimer2.endTime, undefined, 'SubTimer 2 should be running');
    });

    test('startSubTimer resumes a stopped subtimer and pauses others', async () => {
      const timer = await timeTrackerManager.startTimer('Parent Timer');
      const subtimer1 = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 1');
      await timeTrackerManager.stopSubTimer(timer.id, subtimer1.id);
      const subtimer2 = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 2');
      
      await timeTrackerManager.startSubTimer(timer.id, subtimer1.id);

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      const savedSubTimer1 = savedTimer.subtimers.find(st => st.id === subtimer1.id);
      const savedSubTimer2 = savedTimer.subtimers.find(st => st.id === subtimer2.id);
      
      assert.strictEqual(savedSubTimer1.endTime, undefined, 'SubTimer 1 should be running');
      assert(savedSubTimer2.endTime !== undefined, 'SubTimer 2 should be paused');
    });

    test('editSubTimer updates subtimer properties', async () => {
      const timer = await timeTrackerManager.startTimer('Parent Timer');
      const subtimer = await timeTrackerManager.createSubTimer(timer.id, 'Original Label', 'Original Desc');
      
      await timeTrackerManager.editSubTimer(timer.id, subtimer.id, {
        label: 'Updated Label',
        description: 'Updated Desc'
      });

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      const savedSubTimer = savedTimer.subtimers.find(st => st.id === subtimer.id);
      assert.strictEqual(savedSubTimer.label, 'Updated Label', 'SubTimer label should be updated');
      assert.strictEqual(savedSubTimer.description, 'Updated Desc', 'SubTimer description should be updated');
    });

    test('deleteSubTimer removes a subtimer', async () => {
      const timer = await timeTrackerManager.startTimer('Parent Timer');
      const subtimer = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 1');
      
      await timeTrackerManager.deleteSubTimer(timer.id, subtimer.id);

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert(savedTimer.subtimers === undefined || savedTimer.subtimers.length === 0, 'SubTimer should be deleted');
    });

    test('reorderSubTimers changes subtimer order', async () => {
      const timer = await timeTrackerManager.startTimer('Parent Timer');
      const subtimer1 = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 1');
      await timeTrackerManager.stopSubTimer(timer.id, subtimer1.id);
      const subtimer2 = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 2');
      await timeTrackerManager.stopSubTimer(timer.id, subtimer2.id);
      const subtimer3 = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer 3');

      // Reorder: move subtimer3 to first position
      await timeTrackerManager.reorderSubTimers(timer.id, [subtimer3.id, subtimer1.id, subtimer2.id]);

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert.strictEqual(savedTimer.subtimers[0].id, subtimer3.id, 'SubTimer3 should be first');
      assert.strictEqual(savedTimer.subtimers[1].id, subtimer1.id, 'SubTimer1 should be second');
      assert.strictEqual(savedTimer.subtimers[2].id, subtimer2.id, 'SubTimer2 should be third');
    });
  });

  suite('Branch Automation', () => {
    test('handleBranchCheckout creates timer for new branch', async () => {
      await timeTrackerManager.handleBranchCheckout('feature/new-feature');

      const timeConfig = await loadTimeConfig();
      const rootFolder = timeConfig.folders.find(f => f.name === '');
      assert(rootFolder !== undefined, 'Root folder should exist');
      
      const branchTimer = rootFolder.timers.find(t => t.branchName === 'feature/new-feature');
      assert(branchTimer !== undefined, 'Branch timer should be created');
      assert.strictEqual(branchTimer.label, 'feature/new-feature', 'Timer label should match branch name');
      assert.strictEqual(branchTimer.endTime, undefined, 'Branch timer should be running');
    });

    test('handleBranchCheckout ignores master and main branches', async () => {
      await timeTrackerManager.handleBranchCheckout('master');
      await timeTrackerManager.handleBranchCheckout('main');

      const timeConfig = await loadTimeConfig();
      const rootFolder = timeConfig.folders.find(f => f.name === '');
      
      // Root folder might not exist if no timers were created
      if (rootFolder) {
        const masterTimer = rootFolder.timers.find(t => t.branchName === 'master');
        const mainTimer = rootFolder.timers.find(t => t.branchName === 'main');
        
        assert.strictEqual(masterTimer, undefined, 'Master branch should not create timer');
        assert.strictEqual(mainTimer, undefined, 'Main branch should not create timer');
      } else {
        // If root folder doesn't exist, that's also correct - no timers were created
        assert(true, 'No root folder means no timers were created for ignored branches');
      }
    });

    test('handleBranchCheckout stops previous branch timer', async () => {
      await timeTrackerManager.handleBranchCheckout('feature/branch1');
      await new Promise(resolve => setTimeout(resolve, 100));
      await timeTrackerManager.handleBranchCheckout('feature/branch2');

      const timeConfig = await loadTimeConfig();
      const rootFolder = timeConfig.folders.find(f => f.name === '');
      
      const branch1Timer = rootFolder.timers.find(t => t.branchName === 'feature/branch1');
      const branch2Timer = rootFolder.timers.find(t => t.branchName === 'feature/branch2');
      
      assert(branch1Timer !== undefined, 'Branch1 timer should exist');
      assert(branch1Timer.endTime !== undefined, 'Branch1 timer should be stopped');
      assert(branch2Timer !== undefined, 'Branch2 timer should exist');
      assert.strictEqual(branch2Timer.endTime, undefined, 'Branch2 timer should be running');
    });

    test('handleBranchCheckout does not stop manually started timers', async () => {
      const manualTimer = await timeTrackerManager.startTimer('Manual Timer');
      await timeTrackerManager.handleBranchCheckout('feature/new-branch');

      const timeConfig = await loadTimeConfig();
      const rootFolder = timeConfig.folders.find(f => f.name === '');
      
      const savedManualTimer = rootFolder.timers.find(t => t.id === manualTimer.id);
      const branchTimer = rootFolder.timers.find(t => t.branchName === 'feature/new-branch');
      
      assert(savedManualTimer !== undefined, 'Manual timer should exist');
      assert.strictEqual(savedManualTimer.endTime, undefined, 'Manual timer should still be running');
      assert(branchTimer !== undefined, 'Branch timer should be created');
    });
  });

  suite('Date Management', () => {
    test('updateTimerDates updates start and end times', async () => {
      const timer = await timeTrackerManager.startTimer('Test Timer');
      const newStartTime = new Date('2024-01-01T10:00:00Z').toISOString();
      const newEndTime = new Date('2024-01-01T12:00:00Z').toISOString();

      await timeTrackerManager.updateTimerDates(timer.id, newStartTime, newEndTime);

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert.strictEqual(savedTimer.startTime, newStartTime, 'Start time should be updated');
      assert.strictEqual(savedTimer.endTime, newEndTime, 'End time should be updated');
    });

    test('updateSubTimerDates updates subtimer start and end times', async () => {
      const timer = await timeTrackerManager.startTimer('Parent Timer');
      const subtimer = await timeTrackerManager.createSubTimer(timer.id, 'SubTimer');
      
      const newStartTime = new Date('2024-01-01T10:00:00Z').toISOString();
      const newEndTime = new Date('2024-01-01T11:00:00Z').toISOString();

      await timeTrackerManager.updateSubTimerDates(timer.id, subtimer.id, newStartTime, newEndTime);

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      const savedSubTimer = savedTimer.subtimers.find(st => st.id === subtimer.id);
      assert.strictEqual(savedSubTimer.startTime, newStartTime, 'SubTimer start time should be updated');
      assert.strictEqual(savedSubTimer.endTime, newEndTime, 'SubTimer end time should be updated');
    });
  });

  suite('Folder Operations', () => {
    test('createFolder creates a new folder', async () => {
      const folder = await timeTrackerManager.createFolder('Test Folder');

      assert(folder !== undefined, 'Folder should be created');
      assert.strictEqual(folder.name, 'Test Folder', 'Folder name should match');

      const timeConfig = await loadTimeConfig();
      const createdFolder = timeConfig.folders.find(f => f.name === 'Test Folder');
      assert(createdFolder !== undefined, 'Folder should exist in config');
    });

    test('moveTimerToFolder moves timer to folder', async () => {
      const timer = await timeTrackerManager.startTimer('Test Timer');
      const folder = await timeTrackerManager.createFolder('Test Folder');
      
      // Find folder index
      const timeConfig = await loadTimeConfig();
      const folderIndex = timeConfig.folders.findIndex(f => f.name === 'Test Folder');
      
      await timeTrackerManager.moveTimerToFolder(timer.id, [folderIndex]);

      const updatedTimeConfig = await loadTimeConfig();
      const targetFolder = updatedTimeConfig.folders[folderIndex];
      const timerInFolder = targetFolder.timers.find(t => t.id === timer.id);
      
      assert(timerInFolder !== undefined, 'Timer should be in folder');
      assert.deepStrictEqual(timerInFolder.folderPath, [folderIndex], 'Timer folderPath should match');
    });
  });

  suite('Edit Page Integration', () => {
    test('showTimerEditor opens webview for timer', async () => {
      const timer = await timeTrackerManager.startTimer('Test Timer');
      const webviewManager = WebviewManager.getInstance();
      
      // Mock webview creation
      let webviewCreated = false;
      const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
      vscode.window.createWebviewPanel = function(...args) {
        webviewCreated = true;
        return originalCreateWebviewPanel.apply(this, args);
      };

      try {
        webviewManager.showTimerEditor(timer.id);
        assert(webviewCreated, 'Webview should be created');
      } finally {
        vscode.window.createWebviewPanel = originalCreateWebviewPanel;
      }
    });

    test('timer editor can update timer label and archived status', async () => {
      const timer = await timeTrackerManager.startTimer('Original Label');
      
      // Simulate webview save message
      await timeTrackerManager.editTimer(timer.id, {
        label: 'Updated Label',
        archived: true
      });

      const timeConfig = await loadTimeConfig();
      
      const savedTimer = findTimerInConfig(timeConfig.folders, timer.id);
      assert.strictEqual(savedTimer.label, 'Updated Label', 'Label should be updated');
      assert.strictEqual(savedTimer.archived, true, 'Archived status should be updated');
    });
  });
});

