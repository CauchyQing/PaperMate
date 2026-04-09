import { create } from 'zustand';
import type {
  Paper,
  Tag,
  CategoryGroup,
  CategoryType,
  ReadStatus,
  Rating,
} from '../../shared/types/category';

interface CategoryState {
  papers: Paper[];
  tags: Tag[];
  categoryGroups: CategoryGroup[];
  activeCategory: CategoryType | 'folder';
  isLoading: boolean;
  error: string | null;

  loadPapers: (workspacePath: string) => Promise<void>;
  loadCategories: (workspacePath: string, type: CategoryType) => Promise<void>;
  setActiveCategory: (type: CategoryType | 'folder') => void;
  importPaper: (
    workspacePath: string,
    filePath: string,
    relativePath: string
  ) => Promise<void>;

  // Paper actions
  updatePaper: (
    workspacePath: string,
    paperId: string,
    updates: Partial<Paper>
  ) => Promise<void>;
  setReadStatus: (
    workspacePath: string,
    paperId: string,
    status: ReadStatus
  ) => Promise<void>;
  setRating: (
    workspacePath: string,
    paperId: string,
    rating: Rating
  ) => Promise<void>;

  // Tag actions
  loadTags: (workspacePath: string) => Promise<void>;
  addTag: (
    workspacePath: string,
    tag: Omit<Tag, 'id' | 'createdAt'>
  ) => Promise<void>;
  deleteTag: (workspacePath: string, tagId: string) => Promise<void>;
  assignTagToPaper: (
    workspacePath: string,
    paperId: string,
    tagId: string
  ) => Promise<void>;
  removeTagFromPaper: (
    workspacePath: string,
    paperId: string,
    tagId: string
  ) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>()((set, get) => ({
  papers: [],
  tags: [],
  categoryGroups: [],
  activeCategory: 'folder',
  isLoading: false,
  error: null,

  loadPapers: async (workspacePath: string) => {
    set({ isLoading: true, error: null });
    try {
      const papers = await window.electronAPI.paperGetAll(workspacePath);
      set({ papers, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  // 需求5.5.2: 支持所有分类维度
  loadCategories: async (workspacePath: string, type: CategoryType) => {
    set({ isLoading: true, error: null, activeCategory: type });
    try {
      let groups: CategoryGroup[] = [];
      switch (type) {
        case 'year':
          groups = await window.electronAPI.paperGetByYear(workspacePath);
          break;
        case 'journal':
          groups = await window.electronAPI.paperGetByJournal(workspacePath);
          break;
        case 'topic':
        case 'keyword':
          groups = await window.electronAPI.paperGetByTag(workspacePath, type);
          break;
        case 'readStatus':
          groups = await window.electronAPI.paperGetByReadStatus(workspacePath);
          break;
        case 'rating':
          groups = await window.electronAPI.paperGetByRating(workspacePath);
          break;
      }
      set({ categoryGroups: groups, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  setActiveCategory: (type: CategoryType | 'folder') => {
    set({ activeCategory: type });
  },

  importPaper: async (
    workspacePath: string,
    filePath: string,
    relativePath: string
  ) => {
    try {
      const paper = await window.electronAPI.paperImport(
        workspacePath,
        filePath,
        relativePath
      );
      set((state) => ({ papers: [...state.papers, paper] }));
    } catch (error) {
      console.error('Failed to import paper:', error);
    }
  },

  updatePaper: async (
    workspacePath: string,
    paperId: string,
    updates: Partial<Paper>
  ) => {
    try {
      await window.electronAPI.paperUpdate(workspacePath, paperId, updates);
      set((state) => ({
        papers: state.papers.map((p) =>
          p.id === paperId ? { ...p, ...updates } : p
        ),
      }));
    } catch (error) {
      console.error('Failed to update paper:', error);
    }
  },

  // 需求5.5.2: 设置阅读状态
  setReadStatus: async (
    workspacePath: string,
    paperId: string,
    status: ReadStatus
  ) => {
    const paper = get().papers.find((p) => p.id === paperId);
    if (!paper) return;

    await get().updatePaper(workspacePath, paperId, { readStatus: status });
  },

  // 需求5.5.2: 设置重要性评分
  setRating: async (
    workspacePath: string,
    paperId: string,
    rating: Rating
  ) => {
    const paper = get().papers.find((p) => p.id === paperId);
    if (!paper) return;

    await get().updatePaper(workspacePath, paperId, { rating });
  },

  loadTags: async (workspacePath: string) => {
    try {
      const tags = await window.electronAPI.tagGetAll(workspacePath);
      set({ tags });
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  },

  addTag: async (
    workspacePath: string,
    tag: Omit<Tag, 'id' | 'createdAt'>
  ) => {
    try {
      const newTag = await window.electronAPI.tagAdd(workspacePath, tag);
      set((state) => ({ tags: [...state.tags, newTag] }));
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  },

  deleteTag: async (workspacePath: string, tagId: string) => {
    try {
      await window.electronAPI.tagDelete(workspacePath, tagId);
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== tagId),
        papers: state.papers.map((p) => ({
          ...p,
          tags: p.tags.filter((t) => t !== tagId),
        })),
      }));
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  },

  assignTagToPaper: async (
    workspacePath: string,
    paperId: string,
    tagId: string
  ) => {
    const paper = get().papers.find((p) => p.id === paperId);
    if (!paper || paper.tags.includes(tagId)) return;

    const updates = { tags: [...paper.tags, tagId] };
    await get().updatePaper(workspacePath, paperId, updates);
  },

  removeTagFromPaper: async (
    workspacePath: string,
    paperId: string,
    tagId: string
  ) => {
    const paper = get().papers.find((p) => p.id === paperId);
    if (!paper) return;

    const updates = { tags: paper.tags.filter((t) => t !== tagId) };
    await get().updatePaper(workspacePath, paperId, updates);
  },
}));
