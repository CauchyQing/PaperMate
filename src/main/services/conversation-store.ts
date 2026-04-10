import * as fs from 'fs/promises';
import * as path from 'path';
import type { Conversation, Message } from '../../shared/types';

interface ConversationDB {
  conversations: Conversation[];
  messages: Message[];
}

export class ConversationStore {
  private dbPath: string;
  private data: ConversationDB = { conversations: [], messages: [] };
  private initialized = false;

  constructor(workspacePath: string) {
    this.dbPath = path.join(workspacePath, '.papermate', 'database', 'conversations.json');
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const content = await fs.readFile(this.dbPath, 'utf-8');
      this.data = JSON.parse(content);
    } catch {
      this.data = { conversations: [], messages: [] };
      await this.save();
    }
    this.initialized = true;
  }

  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2));
  }

  // Conversations
  getAll(): Conversation[] {
    return this.data.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getById(id: string): Conversation | undefined {
    return this.data.conversations.find(c => c.id === id);
  }

  async create(conv: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt' | 'messageCount'>): Promise<Conversation> {
    const now = Date.now();
    const conversation: Conversation = {
      ...conv,
      id: `conv_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    this.data.conversations.push(conversation);
    await this.save();
    return conversation;
  }

  async update(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const idx = this.data.conversations.findIndex(c => c.id === id);
    if (idx < 0) return null;
    this.data.conversations[idx] = { ...this.data.conversations[idx], ...updates, updatedAt: Date.now() };
    await this.save();
    return this.data.conversations[idx];
  }

  async delete(id: string): Promise<boolean> {
    const before = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter(c => c.id !== id);
    this.data.messages = this.data.messages.filter(m => m.conversationId !== id);
    if (this.data.conversations.length < before) {
      await this.save();
      return true;
    }
    return false;
  }

  // Messages
  getMessages(conversationId: string): Message[] {
    return this.data.messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async addMessage(msg: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const message: Message = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.data.messages.push(message);
    // Update conversation message count and timestamp
    const conv = this.data.conversations.find(c => c.id === msg.conversationId);
    if (conv) {
      conv.messageCount = this.data.messages.filter(m => m.conversationId === msg.conversationId).length;
      conv.updatedAt = Date.now();
    }
    await this.save();
    return message;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | null> {
    const idx = this.data.messages.findIndex(m => m.id === id);
    if (idx < 0) return null;
    this.data.messages[idx] = { ...this.data.messages[idx], ...updates };
    await this.save();
    return this.data.messages[idx];
  }
}

// Cache stores per workspace
const stores = new Map<string, ConversationStore>();

export function getConversationStore(workspacePath: string): ConversationStore {
  if (!stores.has(workspacePath)) {
    stores.set(workspacePath, new ConversationStore(workspacePath));
  }
  return stores.get(workspacePath)!;
}
