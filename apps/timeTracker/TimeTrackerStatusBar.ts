import * as vscode from 'vscode';
import { TimeTrackerManager } from './TimeTrackerManager';
import { Timer, SubTimer } from '../../src/types';

export class TimeTrackerStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private updateInterval?: NodeJS.Timeout;
  private timeTrackerManager: TimeTrackerManager;

  constructor(context: vscode.ExtensionContext) {
    this.timeTrackerManager = TimeTrackerManager.getInstance();
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.statusBarItem.command = 'timeTracker.focusView';
    context.subscriptions.push(this.statusBarItem);

    // Update every 30 seconds
    this.updateInterval = setInterval(() => {
      this.update();
    }, 30000);

    // Initial update
    this.update();

    // Update when timers change
    const { ConfigManager } = require('../../src/config/ConfigManager');
    const configManager = ConfigManager.getInstance();
    configManager.setOnTimeTrackerChange(() => {
      this.update();
    });
  }

  public update(): void {
    // Check if time tracking is enabled
    if (!this.timeTrackerManager.isEnabled()) {
      this.statusBarItem.hide();
      return;
    }

    const config = this.timeTrackerManager.getConfig();

    // Get all running timers
    const runningTimer = this.getRunningTimer();
    
    if (!runningTimer) {
      this.statusBarItem.hide();
      return;
    }

    // Calculate elapsed time
    const elapsedTime = this.calculateElapsedTime(runningTimer);
    const formattedTime = this.formatTime(elapsedTime);

    // Truncate timer name to 20 characters
    const timerLabel = runningTimer.label.length > 20 
      ? runningTimer.label.substring(0, 20) + '...' 
      : runningTimer.label;

    this.statusBarItem.text = `$(play) ${timerLabel}: ${formattedTime}`;
    this.statusBarItem.tooltip = `Timer: ${runningTimer.label}\nElapsed: ${formattedTime}`;
    this.statusBarItem.show();
  }

  private getRunningTimer(): Timer | null {
    const config = this.timeTrackerManager.getConfig();
    const findAllTimers = (folders: any[]): Timer[] => {
      const timers: Timer[] = [];
      for (const folder of folders) {
        timers.push(...folder.timers);
        if (folder.subfolders) {
          timers.push(...findAllTimers(folder.subfolders));
        }
      }
      return timers;
    };

    const allTimers = findAllTimers(config.folders || []);
    
    // Find the first timer with a running subtimer
    for (const timer of allTimers) {
      if (timer.subtimers && timer.subtimers.some(st => !st.endTime)) {
        return timer;
      }
    }

    return null;
  }

  private calculateElapsedTime(timer: Timer): number {
    if (!timer.subtimers) return 0;

    let totalMs = 0;
    const now = Date.now();

    for (const subtimer of timer.subtimers) {
      const startTime = new Date(subtimer.startTime).getTime();
      const endTime = subtimer.endTime ? new Date(subtimer.endTime).getTime() : now;
      totalMs += (endTime - startTime);
    }

    return Math.floor(totalMs / 1000); // Return seconds
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  public dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.statusBarItem.dispose();
  }

  public getConfig(): any {
    return this.timeTrackerManager.getConfig();
  }
}

