import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../../../src/config/ConfigManager';

const MIGRATION_VERSION = 1;
const MIGRATION_MARKER_FILE = '.time-tracker-ext.migration.json';

interface MigrationMarker {
  version: number;
  migratedAt: string;
  source: string;
  target: string;
  stateKeysMigrated: string[];
}

export async function migrateTimeTrackerConfigSnapshot(workspaceState: vscode.Memento): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return;
  }

  const dir = path.join(root, '.vscode', 'commands');
  const target = path.join(dir, 'time-tracker-ext.json');
  const markerPath = path.join(dir, MIGRATION_MARKER_FILE);

  if (await exists(markerPath)) {
    return;
  }

  const manager = ConfigManager.getInstance();
  const config = manager.getTimeTrackerConfig();

  await fs.promises.mkdir(dir, { recursive: true });

  if (!(await exists(target))) {
    await fs.promises.writeFile(target, JSON.stringify({ version: MIGRATION_VERSION, timeTracker: config }, null, 2), 'utf8');
  }

  // Workspace-state key migration snapshot for extension-local namespace
  const timers = workspaceState.get<string[]>('timeTracker.autoPausedTimers', []);
  const subtimers = workspaceState.get<Array<{ timerId: string; subtimerId: string }>>('timeTracker.autoPausedSubtimers', []);
  const pauseTime = workspaceState.get<string>('timeTracker.autoPausedTime');

  if (!workspaceState.get('timeTrackerExt.autoPausedTimers')) {
    await workspaceState.update('timeTrackerExt.autoPausedTimers', timers);
  }
  if (!workspaceState.get('timeTrackerExt.autoPausedSubtimers')) {
    await workspaceState.update('timeTrackerExt.autoPausedSubtimers', subtimers);
  }
  if (!workspaceState.get('timeTrackerExt.autoPausedTime') && pauseTime) {
    await workspaceState.update('timeTrackerExt.autoPausedTime', pauseTime);
  }

  const marker: MigrationMarker = {
    version: MIGRATION_VERSION,
    migratedAt: new Date().toISOString(),
    source: manager.getTimeTrackerConfigPath(),
    target,
    stateKeysMigrated: [
      'timeTracker.autoPausedTimers -> timeTrackerExt.autoPausedTimers',
      'timeTracker.autoPausedSubtimers -> timeTrackerExt.autoPausedSubtimers',
      'timeTracker.autoPausedTime -> timeTrackerExt.autoPausedTime'
    ]
  };

  await fs.promises.writeFile(markerPath, JSON.stringify(marker, null, 2), 'utf8');
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
