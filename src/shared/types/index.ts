// Workspace types
export interface WorkspaceSettings {
  version: string;
  name: string;
  description?: string;
  createdAt: number;
  papersRoot: string;
  categories: {
    enabled: string[];
    custom: Array<{
      id: string;
      name: string;
      type: 'single' | 'multiple';
      options?: string[];
    }>;
  };
  agent: {
    systemPrompt?: string;
    model?: string;
    contextLength?: number;
  };
  ui: {
    sidebarWidth: number;
    pdfSidebarVisible: boolean;
    theme: 'light' | 'dark' | 'system';
  };
}

export interface GlobalConfig {
  version: string;
  recentWorkspaces: Array<{
    path: string;
    name: string;
    lastOpenedAt: number;
  }>;
  settings: {
    apiKey?: string;
    defaultModel: string;
    autoSaveInterval: number;
    maxRecentWorkspaces: number;
  };
  windowState?: {
    width: number;
    height: number;
    maximized: boolean;
  };
}

// Paper types
export interface Paper {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  title?: string;
  authors?: string[];
  abstract?: string;
  doi?: string;
  url?: string;
  publishYear?: number;
  journal?: string;
  importedAt: number;
  lastReadAt?: number;
  readProgress: number;
  totalPages?: number;
  isFavorite: boolean;
  isArchived: boolean;
  notes?: string;
}

// Tag types
export interface Tag {
  id: string;
  name: string;
  type: 'topic' | 'keyword' | 'custom';
  color?: string;
  createdAt: number;
}

// Conversation types
export interface Conversation {
  id: string;
  paperId?: string;
  paperTitle?: string;
  topic: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  contextSummary?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  contentType: 'text' | 'image' | 'mixed';
  metadata?: {
    pageNumber?: number;
    selectedText?: string;
    imageData?: string;
  };
  timestamp: number;
}

// Highlight types
export interface Highlight {
  id: string;
  paperId: string;
  pageNumber: number;
  selectedText?: string;
  note?: string;
  color: string;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: number;
}
