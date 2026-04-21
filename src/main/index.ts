import { app, BrowserWindow, ipcMain, dialog, desktopCapturer, shell } from 'electron';
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
import { chatStream, cancelRequest, testConnection, cancelAllRequests } from './services/ai-service';
import { getConversationStore } from './services/conversation-store';
import { getAnnotationStore } from './services/annotation-store';
import { estimateTokens, splitIntoChunks, buildContextWindow } from './services/context-manager';
import { analyzePaper, createAnalysisPrompt } from './services/paper-analysis';
import { stopCdpProxy } from './agent/tools/cdp-bridge';
import { startAgentLoop, stopAgentLoop, stopAllAgentLoops } from './agent/agent-service';
import { buildPdfContext } from './services/pdf-context';
import { getTranslationStore } from './services/translation-store';
import type { AIProviderConfig } from '../shared/types/ai';

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

  // Load the app
  const isDev = !app.isPackaged;

  // Show window when content is ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Hide default menu bar (File, Edit, View, etc.) in production
  if (!isDev) {
    mainWindow.setMenuBarVisibility(false);
    // Remove the menu completely to prevent Alt key from showing it
    mainWindow.setMenu(null);
  }
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

  // Prevent external links from navigating the app window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Trackpad pinch-to-zoom handling on macOS:
  // Electron forwards trackpad pinch to Chromium as a page-zoom gesture.
  // We listen for the resulting zoom-changed event and forward it to the
  // renderer via IPC so the PDF viewer can handle scaling itself.
  // NOTE: setVisualZoomLevelLimits(1,1) is intentionally OMITTED here because
  // on macOS it suppresses the zoom-changed event entirely. Instead we let the
  // browser zoom momentarily and reset it instantly inside the handler.
  console.log('[Main] Setting up zoom-changed listener for trackpad pinch');

  mainWindow.webContents.on('zoom-changed', (event, direction) => {
    console.log('[Main] zoom-changed event fired, direction:', direction);
    // Reset browser-level zoom instantly so the app UI stays at 100%
    mainWindow?.webContents.setZoomFactor(1);
    // Notify renderer to perform PDF-internal zoom
    mainWindow?.webContents.send('pdf:pinch-zoom', direction);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      (input.control || input.meta) &&
      ['equal', 'minus', '0', 'numpad0', 'numpadadd', 'numpadsub'].includes(
        input.key.toLowerCase()
      )
    ) {
      console.log('[Main] Blocking keyboard zoom shortcut');
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('will-navigate', (e, url) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (url !== currentUrl) {
      e.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
    }
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
    // Clean up active resources so the process can exit cleanly on Windows.
    // Hanging fetch/SSE readers and uncleared timers prevent Node.js event loop from exiting.
    cancelAllRequests();
    stopAllAgentLoops();
    stopCdpProxy();
    app.quit();
  }
});

app.on('before-quit', () => {
  // Extra safety net: cancel any in-flight requests / child processes
  // that may still be keeping the event loop alive.
  cancelAllRequests();
  stopAllAgentLoops();
  stopCdpProxy();
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
    console.log('[Main] Reading file:', filePath);
    const fs = await import('fs/promises');
    const stats = await fs.stat(filePath);
    console.log('[Main] File stats:', { size: stats.size, isFile: stats.isFile() });
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }
    const buffer = await fs.readFile(filePath);
    console.log('[Main] File read success, buffer size:', buffer.length);
    // Convert to base64 for safe IPC transfer
    const base64 = buffer.toString('base64');
    console.log('[Main] Base64 encoded, length:', base64.length);
    return base64;
  } catch (error) {
    console.error('[Main] File read error:', error);
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

// AI Provider IPC handlers
ipcMain.handle('ai:getProviders', () => {
  return configService.getAIProviders();
});

ipcMain.handle('ai:getActiveProvider', () => {
  return configService.getActiveProvider();
});

ipcMain.handle('ai:saveProvider', async (_event, provider: AIProviderConfig) => {
  await configService.saveAIProvider(provider);
  return true;
});

ipcMain.handle('ai:deleteProvider', async (_event, providerId: string) => {
  await configService.deleteAIProvider(providerId);
  return true;
});

ipcMain.handle('ai:setActive', async (_event, providerId: string) => {
  await configService.setActiveProvider(providerId);
  return true;
});

ipcMain.handle('ai:testConnection', async (_event, provider: AIProviderConfig) => {
  return testConnection(provider);
});

ipcMain.handle('ai:chat', async (_event, messages: any[], options?: { requestId?: string; temperature?: number; maxTokens?: number; stream?: boolean; providerId?: string }) => {
  if (!mainWindow) throw new Error('窗口未就绪');
  return chatStream(mainWindow, messages, options);
});

ipcMain.handle('ai:stop', (_event, requestId: string) => {
  return cancelRequest(requestId);
});

// Conversation IPC handlers
ipcMain.handle('conversation:list', async (_event, workspacePath: string) => {
  const store = getConversationStore(workspacePath);
  await store.init();
  return store.getAll();
});

ipcMain.handle('conversation:create', async (_event, workspacePath: string, data: any) => {
  const store = getConversationStore(workspacePath);
  await store.init();
  return store.create(data);
});

ipcMain.handle('conversation:update', async (_event, workspacePath: string, id: string, updates: any) => {
  const store = getConversationStore(workspacePath);
  await store.init();
  return store.update(id, updates);
});

ipcMain.handle('conversation:delete', async (_event, workspacePath: string, id: string) => {
  const store = getConversationStore(workspacePath);
  await store.init();
  return store.delete(id);
});

ipcMain.handle('message:list', async (_event, workspacePath: string, conversationId: string) => {
  const store = getConversationStore(workspacePath);
  await store.init();
  return store.getMessages(conversationId);
});

ipcMain.handle('message:add', async (_event, workspacePath: string, message: any) => {
  const store = getConversationStore(workspacePath);
  await store.init();
  return store.addMessage(message);
});

ipcMain.handle('message:update', async (_event, workspacePath: string, id: string, updates: any) => {
  const store = getConversationStore(workspacePath);
  await store.init();
  return store.updateMessage(id, updates);
});

ipcMain.handle('message:deleteMany', async (_event, workspacePath: string, ids: string[]) => {
  const store = getConversationStore(workspacePath);
  await store.init();
  return store.deleteMessages(ids);
});

// Annotation IPC handlers
ipcMain.handle('annotation:getAll', async (_event, workspacePath: string) => {
  const store = getAnnotationStore(workspacePath);
  await store.init();
  return store.getAll();
});

ipcMain.handle('annotation:getByPaper', async (_event, workspacePath: string, paperId: string) => {
  const store = getAnnotationStore(workspacePath);
  await store.init();
  return store.getByPaper(paperId);
});

ipcMain.handle('annotation:create', async (_event, workspacePath: string, data: any) => {
  const store = getAnnotationStore(workspacePath);
  await store.init();
  return store.create(data);
});

ipcMain.handle('annotation:update', async (_event, workspacePath: string, id: string, updates: any) => {
  const store = getAnnotationStore(workspacePath);
  await store.init();
  return store.update(id, updates);
});

ipcMain.handle('annotation:delete', async (_event, workspacePath: string, id: string) => {
  const store = getAnnotationStore(workspacePath);
  await store.init();
  return store.delete(id);
});

// Translation IPC handlers
ipcMain.handle('translation:get', async (_event, workspacePath: string, paperId: string) => {
  const store = getTranslationStore(workspacePath);
  return store.getTranslation(paperId);
});

ipcMain.handle('translation:savePage', async (_event, workspacePath: string, paperId: string, pageNumber: number, content: string) => {
  const store = getTranslationStore(workspacePath);
  return store.savePageTranslation(paperId, pageNumber, content);
});

// Context management IPC handlers
ipcMain.handle('context:estimateTokens', (_event, text: string) => {
  return estimateTokens(text);
});

ipcMain.handle('context:splitIntoChunks', (_event, text: string, maxTokensPerChunk?: number) => {
  return splitIntoChunks(text, maxTokensPerChunk);
});

ipcMain.handle('context:buildWindow', (_event, messages: any[], maxTokens?: number, reserveTokens?: number) => {
  return buildContextWindow(messages, maxTokens, reserveTokens);
});

// Paper analysis IPC handler
ipcMain.handle('paper:analyze', async (_event, paper: any, existingTags: any[]) => {
  const prompt = createAnalysisPrompt(paper);
  return analyzePaper(prompt, existingTags);
});

// Agent IPC handlers
ipcMain.handle('agent:run', async (_event, messages: any[], options?: any) => {
  if (!mainWindow) throw new Error('窗口未就绪');
  return startAgentLoop(mainWindow, messages, options);
});

ipcMain.handle('agent:stop', async (_event, requestId: string) => {
  return stopAgentLoop(requestId);
});

// PDF context builder
ipcMain.handle('pdf:buildContext', async (_event, filePath: string, fileName: string) => {
  return buildPdfContext(filePath, fileName);
});

// Dialog helper for renderer
ipcMain.handle('dialog:showOpenDialog', async (_event, options?: any) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await dialog.showOpenDialog(mainWindow, options || {});
  return result;
});

// Desktop capturer IPC handler
ipcMain.handle('desktopCapturer:getSources', async (_event, options: any) => {
  return desktopCapturer.getSources(options);
});

// Window capture IPC handler - captures a region of the app window
// This does NOT require screen recording permission on macOS (unlike desktopCapturer)
ipcMain.handle('window:captureRegion', async (_event, rect: { x: number; y: number; width: number; height: number }) => {
  if (!mainWindow) throw new Error('窗口未就绪');
  try {
    console.log('[Main] Capturing window region:', rect);
    const image = await mainWindow.webContents.capturePage(rect);
    console.log('[Main] Capture success, size:', image.getSize());
    return image.toDataURL();
  } catch (error) {
    console.error('[Main] Window capture error:', error);
    throw error;
  }
});

// Shell IPC handler
ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  await shell.openExternal(url);
});

console.log('[Main] PaperMate main process started');
