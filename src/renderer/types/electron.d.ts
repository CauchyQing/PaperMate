import type { FileNode, PDFFile } from '../shared/types/file';

export {};

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
      scanDirectory: (dirPath: string, workspaceRoot: string) => Promise<FileNode[]>;
      expandDirectory: (node: FileNode, workspaceRoot: string) => Promise<FileNode[]>;
      getAllPDFFiles: (dirPath: string, workspaceRoot: string) => Promise<PDFFile[]>;
      importPDF: (sourcePath: string, targetDir: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
      dbRun: (sql: string, params?: any[]) => Promise<any>;
    };
  }
}
