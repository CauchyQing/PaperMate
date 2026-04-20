import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PageTranslation {
  pageNumber: number;
  content: string;
  updatedAt: number;
}

export interface PaperTranslationDB {
  paperId: string;
  pages: Record<number, PageTranslation>;
}

export class TranslationStore {
  private workspacePath: string;
  private translationsDir: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.translationsDir = path.join(workspacePath, '.papermate', 'database', 'translations');
  }

  private getPaperDbPath(paperId: string): string {
    // Use SHA256 hash of the paperId (file path) to ensure unique and safe filenames
    const hash = crypto.createHash('sha256').update(paperId).digest('hex');
    return path.join(this.translationsDir, `${hash}.json`);
  }

  async getTranslation(paperId: string): Promise<Record<number, string>> {
    try {
      const dbPath = this.getPaperDbPath(paperId);
      const content = await fs.readFile(dbPath, 'utf-8');
      const db: PaperTranslationDB = JSON.parse(content);
      
      const result: Record<number, string> = {};
      Object.entries(db.pages).forEach(([page, trans]) => {
        result[Number(page)] = trans.content;
      });
      return result;
    } catch {
      return {};
    }
  }

  async savePageTranslation(paperId: string, pageNumber: number, content: string): Promise<void> {
    const dbPath = this.getPaperDbPath(paperId);
    let db: PaperTranslationDB;

    try {
      const existing = await fs.readFile(dbPath, 'utf-8');
      db = JSON.parse(existing);
    } catch {
      db = { paperId, pages: {} };
    }

    db.pages[pageNumber] = {
      pageNumber,
      content,
      updatedAt: Date.now(),
    };

    await fs.mkdir(this.translationsDir, { recursive: true });
    await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
  }
}

const stores = new Map<string, TranslationStore>();

export function getTranslationStore(workspacePath: string): TranslationStore {
  if (!stores.has(workspacePath)) {
    stores.set(workspacePath, new TranslationStore(workspacePath));
  }
  return stores.get(workspacePath)!;
}
