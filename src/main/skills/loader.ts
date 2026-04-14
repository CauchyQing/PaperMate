import * as fs from 'fs/promises';
import * as path from 'path';
import type { LoadedSkill, SkillFrontmatter } from '../../shared/types/skill';

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  if (!content.startsWith('---')) {
    return { frontmatter: {}, body: content };
  }
  const end = content.indexOf('---', 3);
  if (end === -1) {
    return { frontmatter: {}, body: content };
  }
  const yamlText = content.slice(3, end).trim();
  const body = content.slice(end + 3).trimStart();

  const frontmatter: Record<string, unknown> = {};
  let currentKey = '';
  const lines = yamlText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (match) {
      currentKey = match[1];
      const value = match[2].trim();
      if (value) {
        frontmatter[currentKey] = tryParseValue(value);
      } else {
        frontmatter[currentKey] = '';
      }
    } else if (line.trim().startsWith('- ')) {
      // Array item under current key
      const item = line.trim().slice(2).trim();
      const existing = frontmatter[currentKey];
      if (Array.isArray(existing)) {
        existing.push(tryParseValue(item));
      } else if (existing !== undefined && existing !== '') {
        frontmatter[currentKey] = [existing, tryParseValue(item)];
      } else {
        frontmatter[currentKey] = [tryParseValue(item)];
      }
    } else if (line.trim() === '' && currentKey && Array.isArray(frontmatter[currentKey])) {
      // empty line inside array block - skip
    }
  }

  return { frontmatter, body };
}

function tryParseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  return value;
}

function coerceString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(String).join('\n');
  return String(value);
}

function parseAllowedTools(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function parseArguments(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

export async function loadSkillFromDir(skillDir: string): Promise<LoadedSkill | null> {
  const skillFilePath = path.join(skillDir, 'SKILL.md');
  try {
    const content = await fs.readFile(skillFilePath, 'utf-8');
    const { frontmatter: rawFm, body } = parseFrontmatter(content);
    const fm = rawFm as SkillFrontmatter;
    const skillName = path.basename(skillDir);
    const description = coerceString(fm.description);

    return {
      name: skillName,
      description: description || skillName,
      allowedTools: parseAllowedTools(fm['allowed-tools']),
      argNames: parseArguments(fm.arguments).length > 0 ? parseArguments(fm.arguments) : undefined,
      argumentHint: fm['argument-hint'] ? String(fm['argument-hint']) : undefined,
      whenToUse: fm.when_to_use ? String(fm.when_to_use) : undefined,
      version: fm.version ? String(fm.version) : undefined,
      userInvocable: fm['user-invocable'] !== false,
      skillRoot: skillDir,
      markdownContent: body,
      frontmatter: fm,
    };
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      console.error(`[SkillLoader] Failed to load ${skillFilePath}:`, e);
    }
    return null;
  }
}

export async function loadSkillsFromDir(skillsDir: string): Promise<LoadedSkill[]> {
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const results = await Promise.all(
      entries
        .filter(e => e.isDirectory() || e.isSymbolicLink())
        .map(e => loadSkillFromDir(path.join(skillsDir, e.name)))
    );
    return results.filter((s): s is LoadedSkill => s !== null);
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      console.error(`[SkillLoader] Failed to read ${skillsDir}:`, e);
    }
    return [];
  }
}
