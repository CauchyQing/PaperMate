import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { GlobalConfig, WorkspaceSettings } from '../../shared/types';

const GLOBAL_CONFIG_DIR = path.join(app.getPath('home'), '.papermate');
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'global-config.json');

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  version: '1.0.0',
  recentWorkspaces: [],
  settings: {
    defaultModel: 'claude-opus-4-6',
    autoSaveInterval: 30,
    maxRecentWorkspaces: 10,
  },
};

export class ConfigService {
  private config: GlobalConfig = DEFAULT_GLOBAL_CONFIG;

  async init(): Promise<void> {
    try {
      const content = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf-8');
      this.config = { ...DEFAULT_GLOBAL_CONFIG, ...JSON.parse(content) };
    } catch {
      // Config doesn't exist, use defaults
      await this.save();
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(GLOBAL_CONFIG_DIR, { recursive: true });
    await fs.writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(this.config, null, 2));
  }

  getConfig(): GlobalConfig {
    return this.config;
  }

  getRecentWorkspaces(): GlobalConfig['recentWorkspaces'] {
    return this.config.recentWorkspaces;
  }

  async addRecentWorkspace(path: string, name: string): Promise<void> {
    // Remove if already exists
    this.config.recentWorkspaces = this.config.recentWorkspaces.filter(
      (w) => w.path !== path
    );

    // Add to front
    this.config.recentWorkspaces.unshift({
      path,
      name,
      lastOpenedAt: Date.now(),
    });

    // Limit max number
    if (this.config.recentWorkspaces.length > this.config.settings.maxRecentWorkspaces) {
      this.config.recentWorkspaces = this.config.recentWorkspaces.slice(
        0,
        this.config.settings.maxRecentWorkspaces
      );
    }

    await this.save();
  }

  getSettings(): GlobalConfig['settings'] {
    return this.config.settings;
  }

  async updateSettings(settings: Partial<GlobalConfig['settings']>): Promise<void> {
    this.config.settings = { ...this.config.settings, ...settings };
    await this.save();
  }
}

export const configService = new ConfigService();
