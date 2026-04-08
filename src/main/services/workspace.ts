import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { WorkspaceSettings } from '../../shared/types';
import { JsonStore } from '../db/json-store';

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  papersRoot: string;
}

const WORKSPACE_DIR = '.papermate';
const SETTINGS_FILE = 'settings.json';

export async function isWorkspace(folderPath: string): Promise<boolean> {
  try {
    const settingsPath = path.join(folderPath, WORKSPACE_DIR, SETTINGS_FILE);
    await fs.access(settingsPath);
    return true;
  } catch {
    return false;
  }
}

export async function createWorkspace(
  folderPath: string,
  name: string
): Promise<{ success: boolean; workspace?: WorkspaceInfo; error?: string }> {
  try {
    // Check if folder exists
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return { success: false, error: 'Selected path is not a directory' };
    }

    // Create workspace directory structure
    const workspaceDir = path.join(folderPath, WORKSPACE_DIR);
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'database'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'cache', 'thumbnails'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'cache', 'snapshots'), { recursive: true });

    // Create default papers directory
    const papersDir = path.join(folderPath, 'papers');
    await fs.mkdir(papersDir, { recursive: true });

    // Create settings file
    const settings: WorkspaceSettings = {
      version: '1.0.0',
      name,
      createdAt: Date.now(),
      papersRoot: './papers',
      categories: {
        enabled: ['year', 'journal', 'topic', 'keyword'],
        custom: [],
      },
      agent: {
        model: 'claude-opus-4-6',
        contextLength: 4000,
      },
      ui: {
        sidebarWidth: 250,
        pdfSidebarVisible: true,
        theme: 'system',
      },
    };

    await fs.writeFile(
      path.join(workspaceDir, SETTINGS_FILE),
      JSON.stringify(settings, null, 2)
    );

    // Initialize JSON store
    const store = new JsonStore(folderPath);
    await store.init();

    return {
      success: true,
      workspace: {
        id: uuidv4(),
        name,
        path: folderPath,
        papersRoot: settings.papersRoot,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function openWorkspace(
  folderPath: string
): Promise<{ success: boolean; workspace?: WorkspaceInfo; error?: string }> {
  try {
    // Check if it's a valid workspace
    if (!(await isWorkspace(folderPath))) {
      return { success: false, error: 'Not a valid workspace' };
    }

    // Read settings
    const settingsPath = path.join(folderPath, WORKSPACE_DIR, SETTINGS_FILE);
    const settingsContent = await fs.readFile(settingsPath, 'utf-8');
    const settings: WorkspaceSettings = JSON.parse(settingsContent);

    // Initialize JSON store
    const store = new JsonStore(folderPath);
    await store.init();

    return {
      success: true,
      workspace: {
        id: uuidv4(),
        name: settings.name,
        path: folderPath,
        papersRoot: settings.papersRoot,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getWorkspaceSettings(
  folderPath: string
): Promise<WorkspaceSettings | null> {
  try {
    const settingsPath = path.join(folderPath, WORKSPACE_DIR, SETTINGS_FILE);
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function updateWorkspaceSettings(
  folderPath: string,
  settings: Partial<WorkspaceSettings>
): Promise<boolean> {
  try {
    const currentSettings = await getWorkspaceSettings(folderPath);
    if (!currentSettings) return false;

    const newSettings = { ...currentSettings, ...settings };
    const settingsPath = path.join(folderPath, WORKSPACE_DIR, SETTINGS_FILE);
    await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2));
    return true;
  } catch {
    return false;
  }
}
