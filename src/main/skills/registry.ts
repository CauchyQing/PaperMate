import type { LoadedSkill } from '../../shared/types/skill';

let cachedSkills: LoadedSkill[] | null = null;

export function setCachedSkills(skills: LoadedSkill[]): void {
  cachedSkills = skills;
}

export function getCachedSkills(): LoadedSkill[] {
  return cachedSkills || [];
}

export function getSkillByName(name: string): LoadedSkill | undefined {
  return cachedSkills?.find(s => s.name === name);
}

export function clearCachedSkills(): void {
  cachedSkills = null;
}
