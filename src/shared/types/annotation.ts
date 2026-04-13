export type AnnotationType = 'highlight' | 'underline';

export interface AnnotationRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  paperId: string;
  pageNumber: number;
  type: AnnotationType;
  color: string;
  title?: string;
  comment?: string;
  selectedText: string;
  rects: AnnotationRect[];
  createdScale: number;
  createdAt: number;
  updatedAt: number;
}
