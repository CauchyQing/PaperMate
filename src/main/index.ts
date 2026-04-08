import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { configService } from './services/config';
import {
  createWorkspace,
  openWorkspace,
  isWorkspace,
  WorkspaceInfo,
} from './services/workspace';
import {
  scanDirectory,
  expandDirectory,
  getAllPDFFiles,
  importPDFFile,
} from './services/file-system';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _currentWorkspace: WorkspaceInfo | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the app
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Initialize config service
  await configService.init();

  createWindow();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择工作区文件夹',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Workspace IPC handlers
ipcMain.handle('workspace:getRecent', async () => {
  return configService.getRecentWorkspaces();
});

ipcMain.handle('workspace:open', async (_event, folderPath: string) => {
  // Check if it's already a workspace
  if (await isWorkspace(folderPath)) {
    const result = await openWorkspace(folderPath);
    if (result.success && result.workspace) {
      _currentWorkspace = result.workspace;
      await configService.addRecentWorkspace(
        folderPath,
        result.workspace.name
      );
      return { success: true, workspace: result.workspace };
    }
    return { success: false, error: result.error };
  }

  // Not a workspace, ask to create one
  return {
    success: false,
    error: 'NOT_WORKSPACE',
    message: '此文件夹尚未初始化为 PaperMate 工作区',
  };
});

ipcMain.handle(
  'workspace:create',
  async (_event, folderPath: string, name: string) => {
    const result = await createWorkspace(folderPath, name);
    if (result.success && result.workspace) {
      _currentWorkspace = result.workspace;
      await configService.addRecentWorkspace(folderPath, name);
      return { success: true, workspace: result.workspace };
    }
    return { success: false, error: result.error };
  }
);

ipcMain.handle('workspace:close', () => {
  _currentWorkspace = null;
  return true;
});

// File IPC handlers
ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filePath);
    // Convert to base64 for safe IPC transfer
    return buffer.toString('base64');
  } catch (error) {
    throw error;
  }
});

// File system IPC handlers
ipcMain.handle(
  'fs:scanDirectory',
  async (_event, dirPath: string, workspaceRoot: string) => {
    return scanDirectory(dirPath, workspaceRoot);
  }
);

ipcMain.handle(
  'fs:expandDirectory',
  async (_event, node: any, workspaceRoot: string) => {
    return expandDirectory(node, workspaceRoot);
  }
);

ipcMain.handle(
  'fs:getAllPDFFiles',
  async (_event, dirPath: string, workspaceRoot: string) => {
    return getAllPDFFiles(dirPath, workspaceRoot);
  }
);

ipcMain.handle(
  'fs:importPDF',
  async (_event, sourcePath: string, targetDir: string) => {
    return importPDFFile(sourcePath, targetDir);
  }
);

console.log('[Main] PaperMate main process started');
