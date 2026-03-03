import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { TestRunnerConfig } from '../../../src/types';

const MIGRATION_VERSION = 1;
const MIGRATION_MARKER_FILE = '.test-runner-ext.migration.json';

interface MigrationMarker {
  version: number;
  migratedAt: string;
  source: string;
  target: string;
}

export async function migrateTestRunnerConfigSnapshot(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return;
  }

  const dir = path.join(root, '.vscode', 'commands');
  const target = path.join(dir, 'test-runner-ext.json');
  const markerPath = path.join(dir, MIGRATION_MARKER_FILE);

  if (await exists(markerPath)) {
    return;
  }

  const manager = ConfigManager.getInstance();
  const runners: TestRunnerConfig[] = manager.getConfig().testRunners || [];

  if (!Array.isArray(runners)) {
    return;
  }

  await fs.promises.mkdir(dir, { recursive: true });

  if (!(await exists(target))) {
    await fs.promises.writeFile(target, JSON.stringify({ version: MIGRATION_VERSION, testRunners: runners }, null, 2), 'utf8');
  }

  const marker: MigrationMarker = {
    version: MIGRATION_VERSION,
    migratedAt: new Date().toISOString(),
    source: manager.getConfigPath(),
    target
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
