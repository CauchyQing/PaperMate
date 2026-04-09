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

      // Paper categorization
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
