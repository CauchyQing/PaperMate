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
import { getPaperStore } from './services/paper-store';

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
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Show window when content is ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  const isDev = !app.isPackaged;
  if (isDev) {
    // In dev mode, Vite dev server may not be ready yet.
    // Retry loading until the server is available.
    const devUrl = 'http://localhost:3000';
    const loadDevUrl = () => {
      mainWindow?.loadURL(devUrl).catch(() => {
        console.log('[Main] Vite dev server not ready, retrying in 1s...');
        setTimeout(loadDevUrl, 1000);
      });
    };
    loadDevUrl();
    mainWindow.webContents.openDevTools();
  } else {
    // Production: dist/main/main/index.js → ../../renderer/index.html
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
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

// Paper categorization IPC handlers
ipcMain.handle('paper:getAll', async (_event, workspacePath: string) => {
  const store = getPaperStore(workspacePath);
  await store.init();
  return store.getAllPapers();
});

ipcMain.handle(
  'paper:import',
  async (_event, workspacePath: string, filePath: string, relativePath: string) => {
    const store = getPaperStore(workspacePath);
    await store.init();
    return store.importPaper(filePath, relativePath);
  }
);

ipcMain.handle(
  'paper:update',
  async (_event, workspacePath: string, paperId: string, updates: any) => {
    const store = getPaperStore(workspacePath);
    await store.init();
    return store.updatePaper(paperId, updates);
  }
);

ipcMain.handle('paper:getByYear', async (_event, workspacePath: string) => {
  const store = getPaperStore(workspacePath);
  await store.init();
  return store.getPapersByYear();
});

ipcMain.handle('paper:getByJournal', async (_event, workspacePath: string) => {
  const store = getPaperStore(workspacePath);
  await store.init();
  return store.getPapersByJournal();
});

ipcMain.handle(
  'paper:getByTag',
  async (_event, workspacePath: string, tagType: string) => {
    const store = getPaperStore(workspacePath);
    await store.init();
    return store.getPapersByTag(tagType as any);
  }
);

// 需求5.5.2: 按阅读状态分类
ipcMain.handle('paper:getByReadStatus', async (_event, workspacePath: string) => {
  const store = getPaperStore(workspacePath);
  await store.init();
  return store.getPapersByReadStatus();
});

// 需求5.5.2: 按重要性（评分）分类
ipcMain.handle('paper:getByRating', async (_event, workspacePath: string) => {
  const store = getPaperStore(workspacePath);
  await store.init();
  return store.getPapersByRating();
});

ipcMain.handle('tag:getAll', async (_event, workspacePath: string) => {
  const store = getPaperStore(workspacePath);
  await store.init();
  return store.getAllTags();
});

ipcMain.handle(
  'tag:add',
  async (_event, workspacePath: string, tag: any) => {
    const store = getPaperStore(workspacePath);
    await store.init();
    return store.addTag(tag);
  }
);

ipcMain.handle(
  'tag:delete',
  async (_event, workspacePath: string, tagId: string) => {
    const store = getPaperStore(workspacePath);
    await store.init();
    return store.deleteTag(tagId);
  }
);

console.log('[Main] PaperMate main process started');
