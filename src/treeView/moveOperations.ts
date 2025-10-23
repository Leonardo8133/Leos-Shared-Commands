import { CommandConfig, Folder } from '../types';

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
  const sourceFolder = getFolderAtPath(config, descriptor.path);
  if (!sourceFolder) {
    return false;
  }

  const sourceIndex = sourceFolder.commands.findIndex(command => command.id === descriptor.commandId);
  if (sourceIndex === -1) {
    return false;
  }

  const [command] = sourceFolder.commands.splice(sourceIndex, 1);
  if (!command) {
    return false;
  }

  const destinationFolder = getFolderAtPath(config, destination.folderPath);
  if (!destinationFolder) {
    sourceFolder.commands.splice(sourceIndex, 0, command);
    return false;
  }

  let insertIndex = destination.index ?? destinationFolder.commands.length;

  if (destination.position === 'after') {
    insertIndex += 1;
  }

  if (destinationFolder === sourceFolder && insertIndex > sourceIndex) {
    insertIndex -= 1;
  }

  insertIndex = clamp(insertIndex, 0, destinationFolder.commands.length);
  destinationFolder.commands.splice(insertIndex, 0, command);
  return true;
}

export function moveFolderInConfig(
  config: CommandConfig,
  descriptor: FolderDescriptor,
  destination: FolderDestination
): boolean {
  const sourcePath = [...descriptor.path];
  const removalInfo = removeFolderFromConfig(config, sourcePath);
  const folder = removalInfo.folder;

  if (!folder) {
    return false;
  }

  if (isAncestorPath(sourcePath, destination.parentPath)) {
    insertFolderBack(config, removalInfo);
    return false;
  }

  const collection = getFolderCollection(config, destination.parentPath);
  if (!collection) {
    insertFolderBack(config, removalInfo);
    return false;
  }

  let insertIndex = destination.index ?? collection.length;
  if (destination.position === 'after' && destination.index !== undefined) {
    insertIndex += 1;
  }

  if (
    destination.index !== undefined &&
    pathsEqual(destination.parentPath, removalInfo.parentPath) &&
    removalInfo.index < insertIndex
  ) {
    insertIndex -= 1;
  }

  insertIndex = clamp(insertIndex, 0, collection.length);
  collection.splice(insertIndex, 0, folder);
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

