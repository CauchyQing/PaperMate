export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export interface PDFFile {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  size: number;
  lastModified: number;
}
