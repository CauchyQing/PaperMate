// Paper categorization types

export type ReadStatus = 'unread' | 'reading' | 'read' | 'deep_read';
export type Rating = 1 | 2 | 3 | 4 | 5;

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
  // 阅读状态和重要性（需求5.5.2）
  readStatus: ReadStatus;
  rating?: Rating;
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

// 需求5.5.2: 年份、期刊/会议、主题、关键词、阅读状态、重要性
export type CategoryType = 'year' | 'journal' | 'topic' | 'keyword' | 'readStatus' | 'rating' | 'folder';

export interface CategoryViewConfig {
  type: CategoryType;
  name: string;
  icon: string;
}

// 阅读状态显示配置
export const ReadStatusConfig: Record<ReadStatus, { label: string; color: string }> = {
  unread: { label: '未读', color: '#9CA3AF' },
  reading: { label: '阅读中', color: '#3B82F6' },
  read: { label: '已读', color: '#10B981' },
  deep_read: { label: '精读', color: '#8B5CF6' },
};
