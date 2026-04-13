import * as fs from 'fs/promises';
import * as path from 'path';
import type { Annotation } from '../../shared/types/annotation';

interface AnnotationDB {
  annotations: Annotation[];
}

export class AnnotationStore {
  private dbPath: string;
  private data: AnnotationDB = { annotations: [] };
  private initialized = false;

  constructor(workspacePath: string) {
    this.dbPath = path.join(workspacePath, '.papermate', 'database', 'annotations.json');
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const content = await fs.readFile(this.dbPath, 'utf-8');
      this.data = JSON.parse(content);
    } catch {
      this.data = { annotations: [] };
      await this.save();
    }
    this.initialized = true;
  }

  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2));
  }

  getAll(): Annotation[] {
    return this.data.annotations.sort((a, b) => b.createdAt - a.createdAt);
  }

  getByPaper(paperId: string): Annotation[] {
    return this.data.annotations
      .filter((a) => a.paperId === paperId)
      .sort((a, b) => a.pageNumber - b.pageNumber || a.createdAt - b.createdAt);
  }

  getByPage(paperId: string, pageNumber: number): Annotation[] {
    return this.data.annotations
      .filter((a) => a.paperId === paperId && a.pageNumber === pageNumber)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async create(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation> {
    const now = Date.now();
    const item: Annotation = {
      ...annotation,
      id: `anno_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.data.annotations.push(item);
    await this.save();
    return item;
  }

  async update(id: string, updates: Partial<Annotation>): Promise<Annotation | null> {
    const idx = this.data.annotations.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    this.data.annotations[idx] = { ...this.data.annotations[idx], ...updates, updatedAt: Date.now() };
    await this.save();
    return this.data.annotations[idx];
  }

  async delete(id: string): Promise<boolean> {
    const before = this.data.annotations.length;
    this.data.annotations = this.data.annotations.filter((a) => a.id !== id);
    if (this.data.annotations.length < before) {
      await this.save();
      return true;
    }
    return false;
  }
}

const stores = new Map<string, AnnotationStore>();

export function getAnnotationStore(workspacePath: string): AnnotationStore {
  if (!stores.has(workspacePath)) {
    stores.set(workspacePath, new AnnotationStore(workspacePath));
  }
  return stores.get(workspacePath)!;
}
