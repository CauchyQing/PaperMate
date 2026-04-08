import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Workspace {
  id: string;
  name: string;
  path: string;
  papersRoot: string;
}

export interface RecentWorkspace {
  path: string;
  name: string;
  lastOpenedAt: number;
}

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  recentWorkspaces: RecentWorkspace[];
  isLoading: boolean;
  error: string | null;

  // Actions
  openWorkspace: (path: string) => Promise<void>;
  createWorkspace: (path: string, name: string) => Promise<void>;
  closeWorkspace: () => void;
  loadLastWorkspace: () => Promise<void>;
  getRecentWorkspaces: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      currentWorkspace: null,
      recentWorkspaces: [],
      isLoading: false,
      error: null,

      openWorkspace: async (path: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await window.electronAPI.openWorkspace(path);
          if (result.success) {
            set({
              currentWorkspace: result.workspace,
              isLoading: false,
            });
            // Refresh recent workspaces
            await get().getRecentWorkspaces();
          } else {
            set({ error: result.error, isLoading: false });
          }
        } catch (error) {
          set({ error: String(error), isLoading: false });
        }
      },

      createWorkspace: async (path: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await window.electronAPI.createWorkspace(path, name);
          if (result.success) {
            set({
              currentWorkspace: result.workspace,
              isLoading: false,
            });
            await get().getRecentWorkspaces();
          } else {
            set({ error: result.error, isLoading: false });
          }
        } catch (error) {
          set({ error: String(error), isLoading: false });
        }
      },

      closeWorkspace: () => {
        window.electronAPI.closeWorkspace();
        set({ currentWorkspace: null });
      },

      loadLastWorkspace: async () => {
        // Try to load the most recent workspace
        const { recentWorkspaces } = get();
        if (recentWorkspaces.length > 0) {
          const lastWorkspace = recentWorkspaces[0];
          await get().openWorkspace(lastWorkspace.path);
        }
      },

      getRecentWorkspaces: async () => {
        try {
          const workspaces = await window.electronAPI.getRecentWorkspaces();
          set({ recentWorkspaces: workspaces });
        } catch (error) {
          console.error('Failed to get recent workspaces:', error);
        }
      },
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        recentWorkspaces: state.recentWorkspaces,
      }),
    }
  )
);
