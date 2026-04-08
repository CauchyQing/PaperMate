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
      readFile: (path: string) => Promise<Uint8Array>;
      dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
      dbRun: (sql: string, params?: any[]) => Promise<any>;
    };
  }
}
