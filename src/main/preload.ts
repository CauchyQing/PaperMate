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

  // Tag operations
  tagGetAll: (workspacePath: string) => ipcRenderer.invoke('tag:getAll', workspacePath),
  tagAdd: (workspacePath: string, tag: any) => ipcRenderer.invoke('tag:add', workspacePath, tag),
  tagDelete: (workspacePath: string, tagId: string) => ipcRenderer.invoke('tag:delete', workspacePath, tagId),
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
      tagGetAll: (workspacePath: string) => Promise<any[]>;
      tagAdd: (workspacePath: string, tag: any) => Promise<any>;
      tagDelete: (workspacePath: string, tagId: string) => Promise<boolean>;
    };
  }
}
