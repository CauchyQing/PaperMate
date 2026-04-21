import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Dialog
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // Workspace management
  openWorkspace: (path: string) => ipcRenderer.invoke('workspace:open', path),
  createWorkspace: (path: string, name: string) => ipcRenderer.invoke('workspace:create', path, name),
  getRecentWorkspaces: () => ipcRenderer.invoke('workspace:getRecent'),
  closeWorkspace: () => ipcRenderer.invoke('workspace:close'),

  // File operations - returns base64, renderer converts to Uint8Array
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),

  // File system operations
  scanDirectory: (dirPath: string, workspaceRoot: string) =>
    ipcRenderer.invoke('fs:scanDirectory', dirPath, workspaceRoot),
  expandDirectory: (node: any, workspaceRoot: string) =>
    ipcRenderer.invoke('fs:expandDirectory', node, workspaceRoot),
  getAllPDFFiles: (dirPath: string, workspaceRoot: string) =>
    ipcRenderer.invoke('fs:getAllPDFFiles', dirPath, workspaceRoot),
  importPDF: (sourcePath: string, targetDir: string) =>
    ipcRenderer.invoke('fs:importPDF', sourcePath, targetDir),

  // Paper categorization operations
  paperGetAll: (workspacePath: string) => ipcRenderer.invoke('paper:getAll', workspacePath),
  paperImport: (workspacePath: string, filePath: string, relativePath: string) =>
    ipcRenderer.invoke('paper:import', workspacePath, filePath, relativePath),
  paperUpdate: (workspacePath: string, paperId: string, updates: any) =>
    ipcRenderer.invoke('paper:update', workspacePath, paperId, updates),
  paperGetByYear: (workspacePath: string) => ipcRenderer.invoke('paper:getByYear', workspacePath),
  paperGetByJournal: (workspacePath: string) => ipcRenderer.invoke('paper:getByJournal', workspacePath),
  paperGetByTag: (workspacePath: string, tagType: string) =>
    ipcRenderer.invoke('paper:getByTag', workspacePath, tagType),
  paperGetByReadStatus: (workspacePath: string) =>
    ipcRenderer.invoke('paper:getByReadStatus', workspacePath),
  paperGetByRating: (workspacePath: string) =>
    ipcRenderer.invoke('paper:getByRating', workspacePath),

  // Tag operations
  tagGetAll: (workspacePath: string) => ipcRenderer.invoke('tag:getAll', workspacePath),
  tagAdd: (workspacePath: string, tag: any) => ipcRenderer.invoke('tag:add', workspacePath, tag),
  tagDelete: (workspacePath: string, tagId: string) => ipcRenderer.invoke('tag:delete', workspacePath, tagId),

  // AI Provider operations
  aiGetProviders: () => ipcRenderer.invoke('ai:getProviders'),
  aiGetActiveProvider: () => ipcRenderer.invoke('ai:getActiveProvider'),
  aiSaveProvider: (provider: any) => ipcRenderer.invoke('ai:saveProvider', provider),
  aiDeleteProvider: (providerId: string) => ipcRenderer.invoke('ai:deleteProvider', providerId),
  aiSetActive: (providerId: string) => ipcRenderer.invoke('ai:setActive', providerId),
  aiTestConnection: (provider: any) => ipcRenderer.invoke('ai:testConnection', provider),
  aiChat: (messages: any[], options?: { requestId?: string; temperature?: number; maxTokens?: number; stream?: boolean; providerId?: string }) => ipcRenderer.invoke('ai:chat', messages, options),
  aiStop: (requestId: string) => ipcRenderer.invoke('ai:stop', requestId),
  agentRun: (messages: any[], options?: { requestId?: string; maxIterations?: number; providerId?: string; attachments?: Array<{ type: string; path: string; name: string }> }) => ipcRenderer.invoke('agent:run', messages, options),
  agentStop: (requestId: string) => ipcRenderer.invoke('agent:stop', requestId),
  showOpenDialog: (options?: any) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  buildPdfContext: (filePath: string, fileName: string) => ipcRenderer.invoke('pdf:buildContext', filePath, fileName),
  onAIStreamEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('ai:stream-event', handler);
    return () => ipcRenderer.removeListener('ai:stream-event', handler);
  },

  // Conversation operations
  conversationList: (workspacePath: string) => ipcRenderer.invoke('conversation:list', workspacePath),
  conversationCreate: (workspacePath: string, data: any) => ipcRenderer.invoke('conversation:create', workspacePath, data),
  conversationUpdate: (workspacePath: string, id: string, updates: any) => ipcRenderer.invoke('conversation:update', workspacePath, id, updates),
  conversationDelete: (workspacePath: string, id: string) => ipcRenderer.invoke('conversation:delete', workspacePath, id),
  messageList: (workspacePath: string, conversationId: string) => ipcRenderer.invoke('message:list', workspacePath, conversationId),
  messageAdd: (workspacePath: string, message: any) => ipcRenderer.invoke('message:add', workspacePath, message),
  messageUpdate: (workspacePath: string, id: string, updates: any) => ipcRenderer.invoke('message:update', workspacePath, id, updates),
  messageDeleteMany: (workspacePath: string, ids: string[]) => ipcRenderer.invoke('message:deleteMany', workspacePath, ids),

  // Context management operations
  contextEstimateTokens: (text: string) => ipcRenderer.invoke('context:estimateTokens', text),
  contextSplitIntoChunks: (text: string, maxTokensPerChunk?: number) => ipcRenderer.invoke('context:splitIntoChunks', text, maxTokensPerChunk),
  contextBuildWindow: (messages: any[], maxTokens?: number, reserveTokens?: number) => ipcRenderer.invoke('context:buildWindow', messages, maxTokens, reserveTokens),

  // Paper analysis
  paperAnalyze: (paper: any, existingTags: any[]) => ipcRenderer.invoke('paper:analyze', paper, existingTags),

  // Annotation operations
  annotationGetAll: (workspacePath: string) => ipcRenderer.invoke('annotation:getAll', workspacePath),
  annotationGetByPaper: (workspacePath: string, paperId: string) => ipcRenderer.invoke('annotation:getByPaper', workspacePath, paperId),
  annotationCreate: (workspacePath: string, annotation: any) => ipcRenderer.invoke('annotation:create', workspacePath, annotation),
  annotationUpdate: (workspacePath: string, id: string, updates: any) => ipcRenderer.invoke('annotation:update', workspacePath, id, updates),
  annotationDelete: (workspacePath: string, id: string) => ipcRenderer.invoke('annotation:delete', workspacePath, id),

  // Translation operations
  translationGet: (workspacePath: string, paperId: string) => ipcRenderer.invoke('translation:get', workspacePath, paperId),
  translationSavePage: (workspacePath: string, paperId: string, pageNumber: number, content: string) => ipcRenderer.invoke('translation:savePage', workspacePath, paperId, pageNumber, content),

  // Desktop capturer (fallback)
  desktopCapturerGetSources: (options: any) => ipcRenderer.invoke('desktopCapturer:getSources', options),
  // Window capture - captures app window region without screen recording permission
  captureWindowRegion: (rect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('window:captureRegion', rect),

  // Shell operations
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
});

// TypeScript declarations
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      openDirectory: () => Promise<string | null>;
      openWorkspace: (path: string) => Promise<any>;
      createWorkspace: (path: string, name: string) => Promise<any>;
      getRecentWorkspaces: () => Promise<any[]>;
      closeWorkspace: () => Promise<boolean>;
      readFile: (path: string) => Promise<string>;
      scanDirectory: (dirPath: string, workspaceRoot: string) => Promise<any[]>;
      expandDirectory: (node: any, workspaceRoot: string) => Promise<any[]>;
      getAllPDFFiles: (dirPath: string, workspaceRoot: string) => Promise<any[]>;
      importPDF: (sourcePath: string, targetDir: string) => Promise<any>;
      paperGetAll: (workspacePath: string) => Promise<any[]>;
      paperImport: (workspacePath: string, filePath: string, relativePath: string) => Promise<any>;
      paperUpdate: (workspacePath: string, paperId: string, updates: any) => Promise<any>;
      paperGetByYear: (workspacePath: string) => Promise<any[]>;
      paperGetByJournal: (workspacePath: string) => Promise<any[]>;
      paperGetByTag: (workspacePath: string, tagType: string) => Promise<any[]>;
      paperGetByReadStatus: (workspacePath: string) => Promise<any[]>;
      paperGetByRating: (workspacePath: string) => Promise<any[]>;
      tagGetAll: (workspacePath: string) => Promise<any[]>;
      tagAdd: (workspacePath: string, tag: any) => Promise<any>;
      tagDelete: (workspacePath: string, tagId: string) => Promise<boolean>;
      // AI Provider operations
      aiGetProviders: () => Promise<any[]>;
      aiGetActiveProvider: () => Promise<any>;
      aiSaveProvider: (provider: any) => Promise<boolean>;
      aiDeleteProvider: (providerId: string) => Promise<boolean>;
      aiSetActive: (providerId: string) => Promise<boolean>;
      aiTestConnection: (provider: any) => Promise<{ success: boolean; error?: string }>;
      aiChat: (messages: any[], options?: { requestId?: string; temperature?: number; maxTokens?: number; stream?: boolean; providerId?: string }) => Promise<string>;
      aiStop: (requestId: string) => Promise<boolean>;
      agentRun: (messages: any[], options?: { requestId?: string; maxIterations?: number; providerId?: string; attachments?: Array<{ type: string; path: string; name: string }>; pdfContext?: { filePath: string; fileName: string; extractedText?: string; structuredSummary?: string; extractedAt?: number } }) => Promise<string>;
      agentStop: (requestId: string) => Promise<boolean>;
      showOpenDialog: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
      buildPdfContext: (filePath: string, fileName: string) => Promise<{ filePath: string; fileName: string; extractedText?: string; structuredSummary?: string; extractedAt?: number }>;
      onAIStreamEvent: (callback: (event: any) => void) => () => void;
      // Conversation operations
      conversationList: (workspacePath: string) => Promise<any[]>;
      conversationCreate: (workspacePath: string, data: any) => Promise<any>;
      conversationUpdate: (workspacePath: string, id: string, updates: any) => Promise<any>;
      conversationDelete: (workspacePath: string, id: string) => Promise<boolean>;
      messageList: (workspacePath: string, conversationId: string) => Promise<any[]>;
      messageAdd: (workspacePath: string, message: any) => Promise<any>;
      messageUpdate: (workspacePath: string, id: string, updates: any) => Promise<any>;
      messageDeleteMany: (workspacePath: string, ids: string[]) => Promise<number>;
      // Context management operations
      contextEstimateTokens: (text: string) => Promise<number>;
      contextSplitIntoChunks: (text: string, maxTokensPerChunk?: number) => Promise<{ chunks: string[]; totalTokens: number }>;
      contextBuildWindow: (messages: any[], maxTokens?: number, reserveTokens?: number) => Promise<{ messages: any[]; estimatedTokens: number }>;
      // Paper analysis
      paperAnalyze: (paper: any, existingTags: any[]) => Promise<{ suggestedTitle: string; suggestedJournal?: string; suggestedYear?: number; suggestedTopics: string[]; suggestedKeywords: string[]; summary: string }>;
      // Annotation operations
      annotationGetAll: (workspacePath: string) => Promise<any[]>;
      annotationGetByPaper: (workspacePath: string, paperId: string) => Promise<any[]>;
      annotationCreate: (workspacePath: string, annotation: any) => Promise<any>;
      annotationUpdate: (workspacePath: string, id: string, updates: any) => Promise<any>;
      annotationDelete: (workspacePath: string, id: string) => Promise<boolean>;
      // Translation operations
      translationGet: (workspacePath: string, paperId: string) => Promise<Record<number, string>>;
      translationSavePage: (workspacePath: string, paperId: string, pageNumber: number, content: string) => Promise<void>;
      // Desktop capturer
      desktopCapturerGetSources: (options: any) => Promise<any[]>;
      // Window capture
      captureWindowRegion: (rect: { x: number; y: number; width: number; height: number }) => Promise<string>;
      // Shell operations
      openExternal: (url: string) => Promise<void>;
    };
  }
}
