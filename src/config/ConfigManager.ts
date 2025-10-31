import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CommandConfig } from '../types';
import { getDefaultConfig, validateConfig, getDefaultTestRunnerConfig } from './schema';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: CommandConfig;
  private configPath: string;
  private watcher?: vscode.FileSystemWatcher;
  private onConfigChangeCallbacks: Array<() => void> = [];

  private constructor() {
    this.configPath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.vscode', 'commands.json');
    this.config = getDefaultConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
    this.setupFileWatcher();
    // Ensure initial consumers refresh with loaded config
    this.notifyConfigChange();
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

    // Ensure .vscode directory exists
    const vscodeDir = path.dirname(this.configPath);
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const configJson = JSON.stringify(config, null, 2);
    await fs.promises.writeFile(this.configPath, configJson, 'utf8');
    this.config = config;
    this.notifyConfigChange();
  }

  public async loadConfig(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = await fs.promises.readFile(this.configPath, 'utf8');
        const parsedConfig = JSON.parse(configData);
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
        } else {
          vscode.window.showWarningMessage(
            `Invalid configuration file: ${validation.errors.join(', ')}. Using default configuration.`
          );
          this.config = getDefaultConfig();
        }
      } else {
        // Create default config file
        await this.saveConfig(getDefaultConfig());
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load configuration: ${error}`);
      this.config = getDefaultConfig();
    }
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
