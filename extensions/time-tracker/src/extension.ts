import * as vscode from 'vscode';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { TimeTrackerManager } from '../../../apps/timeTracker/TimeTrackerManager';
import { TimeTrackerTreeProvider } from '../../../apps/timeTracker/TimeTrackerTreeProvider';
import { TimeTrackerStatusBar } from '../../../apps/timeTracker/TimeTrackerStatusBar';
import { migrateTimeTrackerConfigSnapshot } from './configMigration';

async function registerLegacyAliases(aliases: Array<[string, string]>): Promise<vscode.Disposable[]> {
  const registered = await vscode.commands.getCommands(true);
  return aliases
    .filter(([legacy]) => !registered.includes(legacy))
    .map(([legacy, current]) => vscode.commands.registerCommand(legacy, async (...args: unknown[]) => {
      await vscode.commands.executeCommand(current, ...args);
    }));
}

async function showMigrationNoticeOnce(context: vscode.ExtensionContext, key: string, message: string): Promise<void> {
  if (context.globalState.get<boolean>(key)) {
    return;
  }
  await context.globalState.update(key, true);
  vscode.window.showInformationMessage(message);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configManager = ConfigManager.getInstance();
  await configManager.initialize();
  await migrateTimeTrackerConfigSnapshot(context.workspaceState);

  const manager = TimeTrackerManager.getInstance();
  manager.setWorkspaceState(context.workspaceState);
  await manager.detectUnexpectedShutdown();
  await manager.resumeAutoPausedTimers();
  await manager.saveTimersPeriodically();
  await manager.initializeGitWatcher();

  const periodicSave = setInterval(async () => {
    try {
      await manager.saveTimersPeriodically();
    } catch {
      // noop
    }
  }, 30000);

  const provider = new TimeTrackerTreeProvider();
  const treeView = vscode.window.createTreeView('timeTrackerTreeExt', { treeDataProvider: provider, showCollapseAll: true });
  const statusBar = new TimeTrackerStatusBar(context);

  const refresh = vscode.commands.registerCommand('timeTrackerExt.refresh', () => provider.refresh());
  const focusView = vscode.commands.registerCommand('timeTrackerExt.focusView', async () => {
    await vscode.commands.executeCommand('shared-commands-hub.focus');
  });

  const bridge = (ext: string, mono: string) => vscode.commands.registerCommand(ext, async (...args: unknown[]) => {
    await vscode.commands.executeCommand(mono, ...args);
  });

  const bridged = [
    bridge('timeTrackerExt.toggleEnabled', 'timeTracker.toggleEnabled'),
    bridge('timeTrackerExt.toggleBranchAutomation', 'timeTracker.toggleBranchAutomation'),
    bridge('timeTrackerExt.startTimer', 'timeTracker.startTimer'),
    bridge('timeTrackerExt.stopTimer', 'timeTracker.stopTimer'),
    bridge('timeTrackerExt.resumeTimer', 'timeTracker.resumeTimer'),
    bridge('timeTrackerExt.stopAll', 'timeTracker.stopAll'),
    bridge('timeTrackerExt.editTimer', 'timeTracker.editTimer'),
    bridge('timeTrackerExt.deleteTimer', 'timeTracker.deleteTimer'),
    bridge('timeTrackerExt.archiveTimer', 'timeTracker.archiveTimer'),
    bridge('timeTrackerExt.newFolder', 'timeTracker.newFolder'),
    bridge('timeTrackerExt.moveToFolder', 'timeTracker.moveToFolder'),
    bridge('timeTrackerExt.moveTimerUp', 'timeTracker.moveTimerUp'),
    bridge('timeTrackerExt.moveTimerDown', 'timeTracker.moveTimerDown'),
    bridge('timeTrackerExt.createSubTimer', 'timeTracker.createSubTimer'),
    bridge('timeTrackerExt.startSubTimer', 'timeTracker.startSubTimer'),
    bridge('timeTrackerExt.stopSubTimer', 'timeTracker.stopSubTimer'),
    bridge('timeTrackerExt.editSubTimer', 'timeTracker.editSubTimer'),
    bridge('timeTrackerExt.deleteSubTimer', 'timeTracker.deleteSubTimer')
  ];

  const legacyAliases = await registerLegacyAliases([
    ['timeTracker.refresh', 'timeTrackerExt.refresh'],
    ['timeTracker.toggleEnabled', 'timeTrackerExt.toggleEnabled'],
    ['timeTracker.toggleBranchAutomation', 'timeTrackerExt.toggleBranchAutomation'],
    ['timeTracker.startTimer', 'timeTrackerExt.startTimer'],
    ['timeTracker.stopTimer', 'timeTrackerExt.stopTimer'],
    ['timeTracker.resumeTimer', 'timeTrackerExt.resumeTimer'],
    ['timeTracker.stopAll', 'timeTrackerExt.stopAll'],
    ['timeTracker.editTimer', 'timeTrackerExt.editTimer'],
    ['timeTracker.deleteTimer', 'timeTrackerExt.deleteTimer'],
    ['timeTracker.archiveTimer', 'timeTrackerExt.archiveTimer'],
    ['timeTracker.newFolder', 'timeTrackerExt.newFolder'],
    ['timeTracker.moveToFolder', 'timeTrackerExt.moveToFolder'],
    ['timeTracker.moveTimerUp', 'timeTrackerExt.moveTimerUp'],
    ['timeTracker.moveTimerDown', 'timeTrackerExt.moveTimerDown'],
    ['timeTracker.createSubTimer', 'timeTrackerExt.createSubTimer'],
    ['timeTracker.startSubTimer', 'timeTrackerExt.startSubTimer'],
    ['timeTracker.stopSubTimer', 'timeTrackerExt.stopSubTimer'],
    ['timeTracker.editSubTimer', 'timeTrackerExt.editSubTimer'],
    ['timeTracker.deleteSubTimer', 'timeTrackerExt.deleteSubTimer']
  ]);

  await showMigrationNoticeOnce(
    context,
    'timeTracker.legacyAliases.notice.v1',
    'Time Tracker extension is active. Legacy timeTracker.* aliases are available for compatibility during migration.'
  );

  context.subscriptions.push(treeView, provider, statusBar, refresh, focusView, ...bridged, ...legacyAliases, { dispose: () => clearInterval(periodicSave) });
}

export function deactivate(): void {
  // no-op
}
