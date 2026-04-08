import { create } from 'zustand';
import type { FileNode, PDFFile } from '../../shared/types/file';

interface FileState {
  // File tree
  rootNodes: FileNode[];
  isLoading: boolean;
  error: string | null;

  // PDF files (flat list)
  pdfFiles: PDFFile[];

  // Currently selected file
  selectedFile: PDFFile | null;

  // Open files (for tabs)
  openFiles: PDFFile[];
  activeFileId: string | null;

  // Actions
  loadFiles: (workspacePath: string) => Promise<void>;
  expandNode: (node: FileNode, workspacePath: string) => Promise<void>;
  collapseNode: (nodeId: string) => void;
  selectFile: (file: PDFFile) => void;
  openFile: (file: PDFFile) => void;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string) => void;
  importFile: (sourcePath: string, targetDir: string, workspacePath: string) => Promise<void>;
  refreshFiles: (workspacePath: string) => Promise<void>;
}

export const useFileStore = create<FileState>()((set, get) => ({
  rootNodes: [],
  isLoading: false,
  error: null,
  pdfFiles: [],
  selectedFile: null,
  openFiles: [],
  activeFileId: null,

  loadFiles: async (workspacePath: string) => {
    set({ isLoading: true, error: null });
    try {
      const nodes = await window.electronAPI.scanDirectory(
        workspacePath,
        workspacePath
      );
      set({ rootNodes: nodes, isLoading: false });

      // Also load all PDFs
      const pdfs = await window.electronAPI.getAllPDFFiles(
        workspacePath,
        workspacePath
      );
      set({ pdfFiles: pdfs });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  expandNode: async (node: FileNode, workspacePath: string) => {
    if (node.type !== 'directory' || !node.children) return;

    try {
      const children = await window.electronAPI.expandDirectory(
        node,
        workspacePath
      );

      // Update the node in the tree
      const updateTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((n) => {
          if (n.id === node.id) {
            return { ...n, children, isExpanded: true };
          }
          if (n.children) {
            return { ...n, children: updateTree(n.children) };
          }
          return n;
        });
      };

      set((state) => ({ rootNodes: updateTree(state.rootNodes) }));
    } catch (error) {
      console.error('Failed to expand directory:', error);
    }
  },

  collapseNode: (nodeId: string) => {
    const updateTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((n) => {
        if (n.id === nodeId) {
          return { ...n, isExpanded: false };
        }
        if (n.children) {
          return { ...n, children: updateTree(n.children) };
        }
        return n;
      });
    };

    set((state) => ({ rootNodes: updateTree(state.rootNodes) }));
  },

  selectFile: (file: PDFFile) => {
    set({ selectedFile: file });
  },

  openFile: (file: PDFFile) => {
    const { openFiles } = get();
    // Check if already open
    if (!openFiles.find((f) => f.id === file.id)) {
      set((state) => ({
        openFiles: [...state.openFiles, file],
      }));
    }
    set({ activeFileId: file.id });
  },

  closeFile: (fileId: string) => {
    const { openFiles, activeFileId } = get();
    const newOpenFiles = openFiles.filter((f) => f.id !== fileId);

    // If we closed the active file, switch to another one
    let newActiveFileId = activeFileId;
    if (activeFileId === fileId) {
      newActiveFileId = newOpenFiles.length > 0 ? newOpenFiles[0].id : null;
    }

    set({ openFiles: newOpenFiles, activeFileId: newActiveFileId });
  },

  setActiveFile: (fileId: string) => {
    set({ activeFileId: fileId });
  },

  importFile: async (sourcePath: string, targetDir: string, workspacePath: string) => {
    try {
      const result = await window.electronAPI.importPDF(sourcePath, targetDir);
      if (result.success) {
        // Refresh files
        await get().refreshFiles(workspacePath);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to import file:', error);
      throw error;
    }
  },

  refreshFiles: async (workspacePath: string) => {
    await get().loadFiles(workspacePath);
  },
}));
