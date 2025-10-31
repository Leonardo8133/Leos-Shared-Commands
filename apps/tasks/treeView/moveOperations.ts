import { CommandConfig, Folder } from '../../../src/types';

export type DropPosition = 'before' | 'after' | 'into';

export interface CommandDescriptor {
  path: number[];
  commandId: string;
}

export interface CommandDestination {
  folderPath: number[];
  index?: number;
  position?: DropPosition;
}

export interface FolderDescriptor {
  path: number[];
}

export interface FolderDestination {
  parentPath: number[];
  index?: number;
  position?: DropPosition;
}

export function moveCommandInConfig(
  config: CommandConfig,
  descriptor: CommandDescriptor,
  destination: CommandDestination
): boolean {
  const { DebugLogger, DebugTag } = require('../../../src/utils/DebugLogger');
  
  const sourceFolder = getFolderAtPath(config, descriptor.path);
  if (!sourceFolder) {
    return false;
  }

  const sourceIndex = sourceFolder.commands.findIndex(command => command.id === descriptor.commandId);
  if (sourceIndex === -1) {
    return false;
  }

  const destinationFolder = getFolderAtPath(config, destination.folderPath);
  if (!destinationFolder) {
    return false;
  }

  // Log initial state
  const initialOrder = sourceFolder.commands.map(c => c.id);
  const sourceCommandId = sourceFolder.commands[sourceIndex].id;

  // If moving within the same folder, handle index adjustment carefully
  const isSameFolder = destinationFolder === sourceFolder;
  
  // Calculate insertIndex BEFORE removal (using original length)
  const originalLength = isSameFolder ? sourceFolder.commands.length : destinationFolder.commands.length;
  let insertIndex = destination.index ?? (isSameFolder ? originalLength : destinationFolder.commands.length);

  if (destination.position === 'after') {
    insertIndex += 1;
  }

  DebugLogger.log(DebugTag.MOVE, 'moveCommandInConfig: Before removal', {
    sourceCommandId,
    sourceIndex,
    insertIndex,
    destinationIndex: destination.index,
    destinationPosition: destination.position,
    isSameFolder,
    originalLength,
    initialOrder
  });

  // Remove command from source first
  const [command] = sourceFolder.commands.splice(sourceIndex, 1);
  if (!command) {
    return false;
  }

  // Log after removal
  const afterRemovalOrder = sourceFolder.commands.map(c => c.id);

  // When moving within same folder, adjust insertIndex AFTER removing
  // because the removal shifts indices
  if (isSameFolder) {
    DebugLogger.log(DebugTag.MOVE, 'moveCommandInConfig: Checking adjustment', {
      sourceIndex,
      insertIndex,
      originalLength,
      condition1: sourceIndex < insertIndex,
      condition2: insertIndex < originalLength - 1,
      willAdjust: sourceIndex < insertIndex && insertIndex < originalLength - 1
    });
    
    if (sourceIndex < insertIndex) {
      // Only adjust if insertIndex points to an item before the last
      // insertIndex == originalLength - 1 means "at end", don't adjust
      // When moving forward, we need to adjust insertIndex because removal shifts indices
      // But if insertIndex is at the end (originalLength - 1), don't adjust
      // Example: [A, B, C, D], move B(1) to "before index 2" (before C):
      //   - insertIndex = 2, originalLength = 4
      //   - After removal: [A, C, D], C is now at index 1
      //   - We want to insert before C, so insert at index 1
      //   - Adjust: 2 - 1 = 1 ✓
      // Example: [A, B, C], move A(0) to "before index 2" (before C):
      //   - insertIndex = 2, originalLength = 3
      //   - After removal: [B, C], C is at index 1
      //   - "before index 2" means "at the end", so insert at index 2 (after C)
      //   - Don't adjust: keep insertIndex = 2 ✓
      // When moving forward, we need to adjust insertIndex because removal shifts indices
      // Special case: if insertIndex == sourceIndex + 1 (moving to immediate next position),
      // we want to insert AFTER the item at that position, not before it
      // Example: [A, B, C, D], move B(1) to "before index 2" (before C):
      //   - insertIndex = 2, sourceIndex = 1
      //   - insertIndex (2) == sourceIndex + 1 (2) → special case!
      //   - After removal: [A, C, D], C is at index 1
      //   - We want B after C, so insert at index 2 (not 1!)
      //   - So DON'T adjust when insertIndex == sourceIndex + 1
      if (insertIndex === sourceIndex + 1) {
        // Moving to immediate next position - don't adjust, insert at insertIndex (after removal)
        // This puts the item AFTER the target, which is what "move down" means
        DebugLogger.log(DebugTag.MOVE, 'moveCommandInConfig: Not adjusting (immediate next position)', { insertIndex });
      } else if (insertIndex < originalLength - 1) {
        insertIndex -= 1;
        DebugLogger.log(DebugTag.MOVE, 'moveCommandInConfig: Adjusted insertIndex', { insertIndex });
      } else {
        DebugLogger.log(DebugTag.MOVE, 'moveCommandInConfig: Not adjusting (insertIndex is at end)', {
          insertIndex,
          originalLength,
          insertIndexIsAtEnd: insertIndex >= originalLength - 1
        });
      }
    } else {
      DebugLogger.log(DebugTag.MOVE, 'moveCommandInConfig: Not adjusting (moving backward)', {
        sourceIndex,
        insertIndex
      });
    }
  }

  insertIndex = clamp(insertIndex, 0, destinationFolder.commands.length);
  destinationFolder.commands.splice(insertIndex, 0, command);
  
  // Log final state
  const finalOrder = destinationFolder.commands.map(c => c.id);
  
  DebugLogger.log(DebugTag.MOVE, `moveCommandInConfig details`, {
    sourceCommandId,
    sourceIndex,
    insertIndex,
    destinationIndex: destination.index,
    destinationPosition: destination.position,
    isSameFolder,
    originalLength,
    initialOrder,
    afterRemovalOrder,
    finalOrder
  });
  
  return true;
}

export function moveFolderInConfig(
  config: CommandConfig,
  descriptor: FolderDescriptor,
  destination: FolderDestination
): boolean {
  const { DebugLogger, DebugTag } = require('../../../src/utils/DebugLogger');
  
  const sourcePath = [...descriptor.path];
  const removalInfo = removeFolderFromConfig(config, sourcePath);
  const folder = removalInfo.folder;

  if (!folder) {
    DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: No folder found to move');
    return false;
  }

  const sourceCollection = getFolderCollection(config, removalInfo.parentPath);
  const initialOrder = sourceCollection ? sourceCollection.map(f => f.name) : [];
  
  DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: After removal', {
    sourceFolderName: folder.name,
    sourceIndex: removalInfo.index,
    destinationIndex: destination.index,
    destinationPosition: destination.position,
    destinationParentPath: destination.parentPath,
    removalParentPath: removalInfo.parentPath,
    initialOrder,
    afterRemovalOrder: sourceCollection ? sourceCollection.map(f => f.name) : []
  });

  if (isAncestorPath(sourcePath, destination.parentPath)) {
    DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Cannot move folder into its own descendant');
    insertFolderBack(config, removalInfo);
    return false;
  }

  const collection = getFolderCollection(config, destination.parentPath);
  if (!collection) {
    DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Destination collection not found');
    insertFolderBack(config, removalInfo);
    return false;
  }

  let insertIndex = destination.index ?? collection.length;
  if (destination.position === 'after' && destination.index !== undefined) {
    insertIndex += 1;
  }

  DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Before adjustment', {
    insertIndex,
    removalIndex: removalInfo.index,
    sameCollection: pathsEqual(destination.parentPath, removalInfo.parentPath),
    collectionLength: collection.length,
    originalLength: pathsEqual(destination.parentPath, removalInfo.parentPath) ? collection.length + 1 : undefined
  });

  // Adjust insertIndex when moving within same collection
  if (
    destination.index !== undefined &&
    pathsEqual(destination.parentPath, removalInfo.parentPath)
  ) {
    const originalLength = collection.length + 1; // +1 because we removed one
    DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Checking adjustment', {
      removalIndex: removalInfo.index,
      insertIndex,
      originalLength,
      condition1: removalInfo.index < insertIndex,
      condition2: insertIndex < originalLength - 1,
      condition3: insertIndex === removalInfo.index + 1,
      willAdjust: removalInfo.index < insertIndex && insertIndex < originalLength - 1 && insertIndex !== removalInfo.index + 1
    });
    
    if (removalInfo.index < insertIndex) {
      // Special case: if insertIndex == removalInfo.index + 1 (moving to immediate next position),
      // we want to insert AFTER the item at that position, not before it
      if (insertIndex === removalInfo.index + 1) {
        // Moving to immediate next position - don't adjust, insert at insertIndex (after removal)
        DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Not adjusting (immediate next position)', { insertIndex });
      } else if (insertIndex < originalLength - 1) {
        insertIndex -= 1;
        DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Adjusted insertIndex', { insertIndex });
      } else {
        DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Not adjusting (insertIndex is at end)', { 
          insertIndex, 
          originalLength,
          insertIndexIsAtEnd: insertIndex >= originalLength - 1
        });
      }
    } else {
      DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Not adjusting (moving backward)', {
        removalIndex: removalInfo.index,
        insertIndex
      });
    }
  }

  insertIndex = clamp(insertIndex, 0, collection.length);
  DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: Final insert', {
    insertIndex,
    collectionLength: collection.length,
    beforeInsertOrder: collection.map(f => f.name)
  });
  
  collection.splice(insertIndex, 0, folder);
  
  DebugLogger.log(DebugTag.MOVE, 'moveFolderInConfig: After insert', {
    finalOrder: collection.map(f => f.name)
  });
  
  return true;
}

export function getFolderAtPath(config: CommandConfig, path: number[]): Folder | undefined {
  if (path.length === 0) {
    return undefined;
  }

  let folders = config.folders;
  let folder: Folder | undefined;

  for (const index of path) {
    folder = folders[index];
    if (!folder) {
      return undefined;
    }

    if (!folder.subfolders) {
      folder.subfolders = [];
    }

    folders = folder.subfolders;
  }

  return folder;
}

export function getFolderCollection(config: CommandConfig, parentPath: number[]): Folder[] | undefined {
  let folders = config.folders;

  if (parentPath.length === 0) {
    return folders;
  }

  let folder: Folder | undefined;
  for (const index of parentPath) {
    folder = folders[index];
    if (!folder) {
      return undefined;
    }

    if (!folder.subfolders) {
      folder.subfolders = [];
    }

    folders = folder.subfolders;
  }

  return folders;
}

export function removeFolderFromConfig(
  config: CommandConfig,
  path: number[]
): { folder?: Folder; parentPath: number[]; index: number } {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  const collection = getFolderCollection(config, parentPath);
  if (!collection) {
    return { parentPath, index: -1 };
  }

  const [folder] = collection.splice(index, 1);
  return { folder, parentPath, index };
}

export function insertFolderBack(
  config: CommandConfig,
  info: { folder?: Folder; parentPath: number[]; index: number }
): void {
  if (!info.folder) {
    return;
  }

  const collection = getFolderCollection(config, info.parentPath);
  if (!collection) {
    return;
  }

  const insertIndex = clamp(info.index, 0, collection.length);
  collection.splice(insertIndex, 0, info.folder);
}

export function pathsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

export function isAncestorPath(ancestor: number[], descendant: number[]): boolean {
  if (ancestor.length === 0 || ancestor.length > descendant.length) {
    return false;
  }

  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) {
      return false;
    }
  }

  return true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

