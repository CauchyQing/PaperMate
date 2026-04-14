// Claude-Code-compatible skill types

export interface SkillFrontmatter {
  name?: string;
  description?: string | string[];
  'allowed-tools'?: string | string[];
  arguments?: string | string[];
  'argument-hint'?: string;
  when_to_use?: string;
  'user-invocable'?: boolean;
  version?: string;
  model?: string;
  'disable-model-invocation'?: boolean;
  hooks?: unknown;
  context?: string;
  agent?: string;
  effort?: string | number;
  shell?: unknown;
  paths?: string;
  license?: string;
  github?: string;
  metadata?: Record<string, unknown>;
}

export interface LoadedSkill {
  name: string;
  description: string;
  allowedTools: string[];
  argNames?: string[];
  argumentHint?: string;
  whenToUse?: string;
  version?: string;
  userInvocable: boolean;
  skillRoot: string;
  markdownContent: string;
  frontmatter: SkillFrontmatter;
}
