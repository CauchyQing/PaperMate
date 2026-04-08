// Temporary JSON file storage for development
// Will be replaced with SQLite in production

import * as fs from 'fs/promises';
import * as path from 'path';

export class JsonStore {
  private dbPath: string;
  private data: any = {};

  constructor(workspacePath: string) {
    this.dbPath = path.join(workspacePath, '.papermate', 'database', 'data.json');
  }

  async init(): Promise<void> {
    try {
      const content = await fs.readFile(this.dbPath, 'utf-8');
      this.data = JSON.parse(content);
    } catch {
      // File doesn't exist, start with empty data
      this.data = {
        papers: [],
        tags: [],
        paper_tags: [],
        highlights: [],
        conversations: [],
        messages: [],
      };
      await this.save();
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2));
  }

  // Papers
  getPapers(): any[] {
    return this.data.papers || [];
  }

  async addPaper(paper: any): Promise<void> {
    this.data.papers = this.data.papers || [];
    this.data.papers.push(paper);
    await this.save();
  }

  // Tags
  getTags(): any[] {
    return this.data.tags || [];
  }

  async addTag(tag: any): Promise<void> {
    this.data.tags = this.data.tags || [];
    this.data.tags.push(tag);
    await this.save();
  }

  // Conversations
  getConversations(): any[] {
    return this.data.conversations || [];
  }

  async addConversation(conv: any): Promise<void> {
    this.data.conversations = this.data.conversations || [];
    this.data.conversations.push(conv);
    await this.save();
  }

  // Messages
  getMessages(conversationId: string): any[] {
    return (this.data.messages || []).filter((m: any) => m.conversationId === conversationId);
  }

  async addMessage(message: any): Promise<void> {
    this.data.messages = this.data.messages || [];
    this.data.messages.push(message);
    await this.save();
  }
}
