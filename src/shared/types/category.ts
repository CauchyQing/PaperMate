// Paper categorization types

export interface Paper {
  id: string;
  filePath: string;
  fileName: string;
  title?: string;
  authors?: string[];
  abstract?: string;
  doi?: string;
  url?: string;
  publishYear?: number;
  journal?: string;
  tags: string[];
  isFavorite: boolean;
  isArchived: boolean;
  importedAt: number;
  lastReadAt?: number;
}

export interface Tag {
  id: string;
  name: string;
  type: 'topic' | 'keyword' | 'custom';
  color?: string;
  createdAt: number;
}

export interface PaperWithMeta extends Paper {
  // Computed fields for display
  displayTitle: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  count: number;
  papers: PaperWithMeta[];
}

export type CategoryType = 'year' | 'journal' | 'topic' | 'keyword' | 'folder';

export interface CategoryViewConfig {
  type: CategoryType;
  name: string;
  icon: string;
}
