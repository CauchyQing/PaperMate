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

  // File operations
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  importPaper: (sourcePath: string, targetDir: string) => ipcRenderer.invoke('paper:import', sourcePath, targetDir),

  // Agent SDK
  sendToAgent: (message: string, context?: any) => ipcRenderer.invoke('agent:send', message, context),

  // Database operations
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
      closeWorkspace: () => Promise<void>;
      readFile: (path: string) => Promise<Buffer>;
      importPaper: (sourcePath: string, targetDir: string) => Promise<any>;
      sendToAgent: (message: string, context?: any) => Promise<any>;
      dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
      dbRun: (sql: string, params?: any[]) => Promise<any>;
    };
  }
}
