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

  // Database operations (temporary using JSON store)
  dbQuery: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
  dbRun: (sql: string, params?: any[]) => ipcRenderer.invoke('db:run', sql, params),
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
      readFile: (path: string) => Promise<string>; // returns base64
      scanDirectory: (dirPath: string, workspaceRoot: string) => Promise<any[]>;
      expandDirectory: (node: any, workspaceRoot: string) => Promise<any[]>;
      getAllPDFFiles: (dirPath: string, workspaceRoot: string) => Promise<any[]>;
      importPDF: (sourcePath: string, targetDir: string) => Promise<any>;
      dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
      dbRun: (sql: string, params?: any[]) => Promise<any>;
    };
  }
}
