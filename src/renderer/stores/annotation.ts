import { create } from 'zustand';
import type { Annotation } from '../../shared/types/annotation';

interface AnnotationState {
  annotations: Annotation[];
  allAnnotations: Annotation[];
  isLoading: boolean;
  error: string | null;

  loadAnnotations: (workspacePath: string, paperId: string) => Promise<void>;
  loadAllAnnotations: (workspacePath: string) => Promise<void>;
  createAnnotation: (workspacePath: string, annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Annotation>;
  updateAnnotation: (workspacePath: string, id: string, updates: Partial<Annotation>) => Promise<void>;
  deleteAnnotation: (workspacePath: string, id: string) => Promise<void>;
  getAnnotationsByPage: (paperId: string, pageNumber: number) => Annotation[];
  getAnnotationsByPaper: (paperId: string) => Annotation[];
}

export const useAnnotationStore = create<AnnotationState>()((set, get) => ({
  annotations: [],
  allAnnotations: [],
  isLoading: false,
  error: null,

  loadAnnotations: async (workspacePath: string, paperId: string) => {
    set({ isLoading: true, error: null });
    try {
      const annotations = await window.electronAPI.annotationGetByPaper(workspacePath, paperId);
      set({ annotations, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  loadAllAnnotations: async (workspacePath: string) => {
    set({ isLoading: true, error: null });
    try {
      const allAnnotations = await window.electronAPI.annotationGetAll(workspacePath);
      set({ allAnnotations, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createAnnotation: async (workspacePath: string, annotation) => {
    const created = await window.electronAPI.annotationCreate(workspacePath, annotation);
    set((state) => ({
      annotations: [...state.annotations, created],
      allAnnotations: [...state.allAnnotations, created],
    }));
    return created;
  },

  updateAnnotation: async (workspacePath: string, id: string, updates: Partial<Annotation>) => {
    const updated = await window.electronAPI.annotationUpdate(workspacePath, id, updates);
    if (updated) {
      set((state) => ({
        annotations: state.annotations.map((a) => (a.id === id ? updated : a)),
        allAnnotations: state.allAnnotations.map((a) => (a.id === id ? updated : a)),
      }));
    }
  },

  deleteAnnotation: async (workspacePath: string, id: string) => {
    await window.electronAPI.annotationDelete(workspacePath, id);
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      allAnnotations: state.allAnnotations.filter((a) => a.id !== id),
    }));
  },

  getAnnotationsByPage: (paperId: string, pageNumber: number) => {
    return get().annotations.filter(
      (a) => a.paperId === paperId && a.pageNumber === pageNumber
    );
  },

  getAnnotationsByPaper: (paperId: string) => {
    return get().annotations
      .filter((a) => a.paperId === paperId)
      .sort((a, b) => a.pageNumber - b.pageNumber || a.createdAt - b.createdAt);
  },
}));
