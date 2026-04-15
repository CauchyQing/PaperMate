import * as fs from 'fs/promises';
import * as path from 'path';
import type { Paper, Tag, PaperWithMeta, CategoryGroup, CategoryType, ReadStatus } from '../../shared/types/category';
import { v4 as uuidv4 } from 'uuid';

export class PaperStore {
  private workspacePath: string;
  private dbPath: string;
  private data: {
    papers: Paper[];
    tags: Tag[];
  } = { papers: [], tags: [] };
  private initialized = false;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.dbPath = path.join(workspacePath, '.papermate', 'database', 'papers.json');
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const content = await fs.readFile(this.dbPath, 'utf-8');
      this.data = JSON.parse(content);
    } catch {
      // File doesn't exist, start with empty data
      this.data = { papers: [], tags: [] };
      await this.save();
    }
    this.initialized = true;
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2));
  }

  // Paper CRUD
  async addPaper(paper: Omit<Paper, 'id' | 'importedAt'>): Promise<Paper> {
    const newPaper: Paper = {
      ...paper,
      id: uuidv4(),
      importedAt: Date.now(),
    };
    this.data.papers.push(newPaper);
    await this.save();
    return newPaper;
  }

  async updatePaper(id: string, updates: Partial<Paper>): Promise<Paper | null> {
    const index = this.data.papers.findIndex((p) => p.id === id);
    if (index === -1) return null;

    this.data.papers[index] = { ...this.data.papers[index], ...updates };
    await this.save();
    return this.data.papers[index];
  }

  async deletePaper(id: string): Promise<boolean> {
    const index = this.data.papers.findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.data.papers.splice(index, 1);
    await this.save();
    return true;
  }

  getPaperById(id: string): Paper | undefined {
    return this.data.papers.find((p) => p.id === id);
  }

  getPaperByPath(filePath: string): Paper | undefined {
    return this.data.papers.find((p) => p.filePath === filePath);
  }

  getAllPapers(): Paper[] {
    return this.data.papers;
  }

  // Tag CRUD
  async addTag(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<Tag> {
    const newTag: Tag = {
      ...tag,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    this.data.tags.push(newTag);
    await this.save();
    return newTag;
  }

  async deleteTag(id: string): Promise<boolean> {
    const index = this.data.tags.findIndex((t) => t.id === id);
    if (index === -1) return false;

    this.data.tags.splice(index, 1);

    // Remove tag from all papers
    this.data.papers.forEach((paper) => {
      paper.tags = paper.tags.filter((t) => t !== id);
    });

    await this.save();
    return true;
  }

  getAllTags(): Tag[] {
    return this.data.tags;
  }

  getTagsByType(type: Tag['type']): Tag[] {
    return this.data.tags.filter((t) => t.type === type);
  }

  // Category views
  getPapersByYear(): CategoryGroup[] {
    const groups = new Map<number, PaperWithMeta[]>();

    this.data.papers.forEach((paper) => {
      const year = paper.publishYear || 0;
      if (!groups.has(year)) {
        groups.set(year, []);
      }
      groups.get(year)!.push(this.enrichPaper(paper));
    });

    return Array.from(groups.entries())
      .sort((a, b) => b[0] - a[0]) // Sort by year desc
      .map(([year, papers]) => ({
        id: `year-${year}`,
        name: year === 0 ? '未知年份' : String(year),
        count: papers.length,
        papers,
      }));
  }

  getPapersByJournal(): CategoryGroup[] {
    const groups = new Map<string, PaperWithMeta[]>();

    this.data.papers.forEach((paper) => {
      const journal = paper.journal || '未知期刊';
      if (!groups.has(journal)) {
        groups.set(journal, []);
      }
      groups.get(journal)!.push(this.enrichPaper(paper));
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([journal, papers]) => ({
        id: `journal-${journal}`,
        name: journal,
        count: papers.length,
        papers,
      }));
  }

  getPapersByTag(tagType: Tag['type']): CategoryGroup[] {
    const groups = new Map<string, PaperWithMeta[]>();

    this.data.papers.forEach((paper) => {
      paper.tags.forEach((tagId) => {
        const tag = this.data.tags.find((t) => t.id === tagId);
        if (tag && tag.type === tagType) {
          if (!groups.has(tag.name)) {
            groups.set(tag.name, []);
          }
          groups.get(tag.name)!.push(this.enrichPaper(paper));
        }
      });
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tagName, papers]) => ({
        id: `tag-${tagName}`,
        name: tagName,
        count: papers.length,
        papers,
      }));
  }

  getFavoritePapers(): PaperWithMeta[] {
    return this.data.papers
      .filter((p) => p.isFavorite)
      .map((p) => this.enrichPaper(p));
  }

  getArchivedPapers(): PaperWithMeta[] {
    return this.data.papers
      .filter((p) => p.isArchived)
      .map((p) => this.enrichPaper(p));
  }

  // 需求5.5.2: 按阅读状态分组
  getPapersByReadStatus(): CategoryGroup[] {
    const statusOrder: ReadStatus[] = ['unread', 'reading', 'read', 'deep_read'];
    const statusLabels: Record<ReadStatus, string> = {
      unread: '未读',
      reading: '阅读中',
      read: '已读',
      deep_read: '精读',
    };

    const groups = new Map<ReadStatus, PaperWithMeta[]>();

    // 初始化所有状态分组
    statusOrder.forEach((status) => groups.set(status, []));

    this.data.papers.forEach((paper) => {
      const status = paper.readStatus || 'unread';
      if (!groups.has(status)) {
        groups.set(status, []);
      }
      groups.get(status)!.push(this.enrichPaper(paper));
    });

    return statusOrder
      .filter((status) => groups.get(status)!.length > 0)
      .map((status) => ({
        id: `status-${status}`,
        name: statusLabels[status],
        count: groups.get(status)!.length,
        papers: groups.get(status)!,
      }));
  }

  // 需求5.5.2: 按重要性（评分）分组
  getPapersByRating(): CategoryGroup[] {
    const groups = new Map<number, PaperWithMeta[]>();

    this.data.papers.forEach((paper) => {
      const rating = paper.rating || 0;
      if (!groups.has(rating)) {
        groups.set(rating, []);
      }
      groups.get(rating)!.push(this.enrichPaper(paper));
    });

    return Array.from(groups.entries())
      .sort((a, b) => b[0] - a[0]) // 从高到低排序
      .map(([rating, papers]) => ({
        id: `rating-${rating}`,
        name: rating === 0 ? '未评分' : '⭐'.repeat(rating),
        count: papers.length,
        papers,
      }));
  }

  private enrichPaper(paper: Paper): PaperWithMeta {
    return {
      ...paper,
      displayTitle: paper.title || paper.fileName.replace('.pdf', ''),
    };
  }

  // Import paper from file
  async importPaper(filePath: string, relativePath: string): Promise<Paper> {
    // Check if already exists
    const existing = this.getPaperByPath(filePath);
    if (existing) {
      return existing;
    }

    // Extract metadata from filename (basic implementation)
    const fileName = path.basename(filePath);

    // Try to extract year from filename (e.g., "2023_paper_name.pdf")
    const yearMatch = fileName.match(/(19|20)\d{2}/);
    const publishYear = yearMatch ? parseInt(yearMatch[0]) : undefined;

    const paper = await this.addPaper({
      filePath,
      fileName,
      title: fileName.replace('.pdf', '').replace(/_/g, ' '),
      publishYear,
      tags: [],
      isFavorite: false,
      isArchived: false,
      readStatus: 'unread',
    });

    return paper;
  }

  // Auto-categorize papers based on filename patterns
  async autoCategorize(): Promise<void> {
    const yearPattern = /(19|20)\d{2}/;

    this.data.papers.forEach((paper) => {
      // Extract year from title if not set
      if (!paper.publishYear && paper.title) {
        const match = paper.title.match(yearPattern);
        if (match) {
          paper.publishYear = parseInt(match[0]);
        }
      }
    });

    await this.save();
  }
}

// Global store instance per workspace
const stores = new Map<string, PaperStore>();

export function getPaperStore(workspacePath: string): PaperStore {
  if (!stores.has(workspacePath)) {
    stores.set(workspacePath, new PaperStore(workspacePath));
  }
  return stores.get(workspacePath)!;
}
