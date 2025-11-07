import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CommandConfig, TimeTrackerConfig } from '../types';
import { getDefaultConfig, validateConfig, getDefaultTimeTrackerConfig, validateTimeTrackerConfig } from './schema';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: CommandConfig;
  private configPath: string;
  private watcher?: vscode.FileSystemWatcher;
  private onConfigChangeCallbacks: Array<() => void> = [];
  private timeTrackerConfig: TimeTrackerConfig;
  private timeTrackerConfigPath: string;
  private timeTrackerWatcher?: vscode.FileSystemWatcher;
  private onTimeTrackerChangeCallbacks: Array<() => void> = [];
  private pendingMigratedTimeTracker?: TimeTrackerConfig;

  private constructor() {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.configPath = path.join(workspaceRoot, '.vscode', 'commands.json');
    this.timeTrackerConfigPath = path.join(workspaceRoot, '.vscode', 'commands-timer.json');
    this.config = getDefaultConfig();
    this.timeTrackerConfig = getDefaultTimeTrackerConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
    await this.loadTimeTrackerConfig();
    this.setupFileWatcher();
    this.setupTimeTrackerFileWatcher();
    // Ensure initial consumers refresh with loaded config
    this.notifyConfigChange();
    this.notifyTimeTrackerChange();
  }

  public getConfig(): CommandConfig {
    return this.config;
  }

  public async saveConfig(config: CommandConfig): Promise<void> {
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Update version and timestamp
    const version = (this.config.version || 0) + 1;
    config.version = version;
    config.lastModified = new Date().toISOString();

    await this.writeCommandsConfigToDisk(config);
    this.config = config;
    this.notifyConfigChange();
  }

  public async loadConfig(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = await fs.promises.readFile(this.configPath, 'utf8');
        const parsedConfig = JSON.parse(configData);

        let extractedTimeTracker: TimeTrackerConfig | undefined;
        if (parsedConfig.timeTracker) {
          extractedTimeTracker = parsedConfig.timeTracker;
          delete parsedConfig.timeTracker;
        }

        const validation = validateConfig(parsedConfig);
        
        if (validation.valid) {
          this.config = parsedConfig;
          // Ensure testRunners array exists (empty array is valid - user can delete default config)
          if (!this.config.testRunners) {
            this.config.testRunners = [];
          }
          // Ensure pinnedCommands array exists
          if (!this.config.pinnedCommands) {
            this.config.pinnedCommands = [];
          }

          if (extractedTimeTracker) {
            this.pendingMigratedTimeTracker = extractedTimeTracker;
            await this.writeCommandsConfigToDisk(this.config);
          }
        } else {
          vscode.window.showWarningMessage(
            `Invalid configuration file: ${validation.errors.join(', ')}. Using default configuration.`
          );
          this.config = getDefaultConfig();
          await this.writeCommandsConfigToDisk(this.config);
        }
      } else {
        // Create default config file
        this.config = getDefaultConfig();
        await this.writeCommandsConfigToDisk(this.config);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load configuration: ${error}`);
      this.config = getDefaultConfig();
      await this.writeCommandsConfigToDisk(this.config);
    }
  }

  private async loadTimeTrackerConfig(): Promise<void> {
    try {
      if (this.pendingMigratedTimeTracker) {
        this.timeTrackerConfig = this.mergeWithDefaultTimeTracker(this.pendingMigratedTimeTracker);
        this.pendingMigratedTimeTracker = undefined;
        await this.saveTimeTrackerConfig(this.timeTrackerConfig, { suppressNotification: true });
        return;
      }

      if (fs.existsSync(this.timeTrackerConfigPath)) {
        const configData = await fs.promises.readFile(this.timeTrackerConfigPath, 'utf8');
        if (!configData.trim()) {
          throw new Error('Time tracker configuration file is empty');
        }

        const parsedConfig = JSON.parse(configData);
        const validation = validateTimeTrackerConfig(parsedConfig);

        if (validation.valid) {
          this.timeTrackerConfig = this.mergeWithDefaultTimeTracker(parsedConfig);
        } else {
          vscode.window.showWarningMessage(
            `Invalid time tracker configuration file: ${validation.errors.join(', ')}. Using default configuration.`
          );
          this.timeTrackerConfig = getDefaultTimeTrackerConfig();
          await this.saveTimeTrackerConfig(this.timeTrackerConfig, { suppressNotification: true });
        }
      } else {
        this.timeTrackerConfig = getDefaultTimeTrackerConfig();
        await this.saveTimeTrackerConfig(this.timeTrackerConfig, { suppressNotification: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to load time tracker configuration: ${message}`);
      this.timeTrackerConfig = getDefaultTimeTrackerConfig();
      await this.saveTimeTrackerConfig(this.timeTrackerConfig, { suppressNotification: true });
    }
  }

  public getTimeTrackerConfig(): TimeTrackerConfig {
    return this.timeTrackerConfig;
  }

  public getTimeTrackerConfigPath(): string {
    return this.timeTrackerConfigPath;
  }

  public setOnTimeTrackerChange(callback: () => void): void {
    this.onTimeTrackerChangeCallbacks.push(callback);
  }

  public async saveTimeTrackerConfig(config: TimeTrackerConfig, options?: { suppressNotification?: boolean }): Promise<void> {
    const validation = validateTimeTrackerConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid time tracker configuration: ${validation.errors.join(', ')}`);
    }

    this.timeTrackerConfig = this.mergeWithDefaultTimeTracker(config);
    this.ensureVscodeDirectoryExists();
    const configJson = JSON.stringify(this.timeTrackerConfig, null, 2);
    await fs.promises.writeFile(this.timeTrackerConfigPath, configJson, 'utf8');

    if (!options?.suppressNotification) {
      this.notifyTimeTrackerChange();
    }
  }

  public async reloadTimeTrackerConfig(): Promise<void> {
    await this.loadTimeTrackerConfig();
    this.notifyTimeTrackerChange();
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public setOnConfigChange(callback: () => void): void {
    this.onConfigChangeCallbacks.push(callback);
  }

  private setupFileWatcher(): void {
    this.watcher = vscode.workspace.createFileSystemWatcher(this.configPath);
    this.watcher.onDidChange(async () => {
      await this.loadConfig();
      this.notifyConfigChange();
    });
    this.watcher.onDidCreate(async () => {
      await this.loadConfig();
      this.notifyConfigChange();
    });
    this.watcher.onDidDelete(async () => {
      this.config = getDefaultConfig();
      this.notifyConfigChange();
    });
  }

  public dispose(): void {
    this.watcher?.dispose();
    this.timeTrackerWatcher?.dispose();
  }

  public async openConfigFile(): Promise<void> {
    const uri = vscode.Uri.file(this.configPath);
    await vscode.window.showTextDocument(uri);
  }

  public async createBackup(): Promise<string> {
    const backupPath = `${this.configPath}.backup.${Date.now()}`;
    await fs.promises.copyFile(this.configPath, backupPath);
    return backupPath;
  }

  public async restoreFromBackup(backupPath: string): Promise<void> {
    const backupData = await fs.promises.readFile(backupPath, 'utf8');
    const parsedConfig = JSON.parse(backupData);
    await this.saveConfig(parsedConfig);
  }

  private notifyConfigChange(): void {
    for (const callback of this.onConfigChangeCallbacks) {
      try {
        callback();
      } catch (error) {
        // Silent fail
      }
    }
  }

  private notifyTimeTrackerChange(): void {
    for (const callback of this.onTimeTrackerChangeCallbacks) {
      try {
        callback();
      } catch (error) {
        // Silent fail
      }
    }
  }

  private setupTimeTrackerFileWatcher(): void {
    this.timeTrackerWatcher = vscode.workspace.createFileSystemWatcher(this.timeTrackerConfigPath);
    this.timeTrackerWatcher.onDidChange(async () => {
      await this.loadTimeTrackerConfig();
      this.notifyTimeTrackerChange();
    });
    this.timeTrackerWatcher.onDidCreate(async () => {
      await this.loadTimeTrackerConfig();
      this.notifyTimeTrackerChange();
    });
    this.timeTrackerWatcher.onDidDelete(async () => {
      this.timeTrackerConfig = getDefaultTimeTrackerConfig();
      await this.saveTimeTrackerConfig(this.timeTrackerConfig, { suppressNotification: true });
      this.notifyTimeTrackerChange();
    });
  }

  private mergeWithDefaultTimeTracker(config: TimeTrackerConfig): TimeTrackerConfig {
    return {
      folders: Array.isArray(config.folders) ? config.folders : [],
      ignoredBranches: Array.isArray(config.ignoredBranches) ? config.ignoredBranches : [],
      autoCreateOnBranchCheckout: config.autoCreateOnBranchCheckout !== undefined ? config.autoCreateOnBranchCheckout : true,
      enabled: config.enabled !== undefined ? config.enabled : true
    };
  }

  private ensureVscodeDirectoryExists(): void {
    const vscodeDir = path.dirname(this.configPath);
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
  }

  private async writeCommandsConfigToDisk(config: CommandConfig): Promise<void> {
    this.ensureVscodeDirectoryExists();
    const configJson = JSON.stringify(config, null, 2);
    await fs.promises.writeFile(this.configPath, configJson, 'utf8');
  }

  public async importCommands(filePath: string): Promise<void> {
    const importData = await fs.promises.readFile(filePath, 'utf8');
    const parsedConfig = JSON.parse(importData);
    const validation = validateConfig(parsedConfig);
    
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    
    await this.saveConfig(parsedConfig);
  }

  public async exportCommands(filePath: string): Promise<void> {
    const configJson = JSON.stringify(this.config, null, 2);
    await fs.promises.writeFile(filePath, configJson, 'utf8');
  }
}
