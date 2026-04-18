import * as os from 'os';
import * as path from 'path';
import type { LoadedSkill } from '../../shared/types/skill';
import { loadSkillsFromDir } from './loader';

const GLOBAL_SKILLS_DIR = path.join(os.homedir(), '.papermate', 'skills');

export async function getAllSkillDirs(): Promise<string[]> {
  // 未来可扩展：resources/skills/ 内置, 全局, 工作区级
  return [GLOBAL_SKILLS_DIR];
}

export async function loadAllSkills(): Promise<LoadedSkill[]> {
  const dirs = await getAllSkillDirs();
  const nested = await Promise.all(dirs.map(d => loadSkillsFromDir(d)));
  const flat = nested.flat();
  // 去重：同名 skill，后加载的覆盖先加载的
  const map = new Map<string, LoadedSkill>();
  for (const skill of flat) {
    map.set(skill.name, skill);
  }
  return Array.from(map.values());
}

/**
 * 简单的 Skill 选择器（关键词匹配）。
 * 未来可替换为 LLM-based selector。
 */
export function selectSkills(userInput: string, skills: LoadedSkill[], attachments?: Array<{ type: string }>): LoadedSkill[] {
  const inputLower = userInput.toLowerCase();
  const selected: LoadedSkill[] = [];

  for (const skill of skills) {
    const nameLower = skill.name.toLowerCase();
    const descLower = skill.description.toLowerCase();
    const whenLower = (skill.whenToUse || '').toLowerCase();

    // 直接匹配 skill 名称
    if (inputLower.includes(nameLower)) {
      selected.push(skill);
      continue;
    }

    // 根据附件类型自动选择
    if (attachments) {
      if (attachments.some(a => a.type === 'pdf') && nameLower.includes('pdf')) {
        selected.push(skill);
        continue;
      }
    }

    // 关键词启发式匹配
    const keywords: Record<string, string[]> = {
      'web-access': ['搜索', '网页', 'google', 'scholar', '浏览器', '访问', '爬取', '抓取', 'site:', 'http'],
      'pdf': ['pdf', '提取', 'extract', '阅读pdf', 'pdf文件'],
    };

    const triggers = keywords[skill.name] || [];
    if (triggers.some(k => inputLower.includes(k.toLowerCase()))) {
      selected.push(skill);
      continue;
    }

    // 如果描述或使用时机中包含查询词
    if (descLower.includes(inputLower.slice(0, 20)) || whenLower.includes(inputLower.slice(0, 20))) {
      selected.push(skill);
    }
  }

  return selected;
}

export function buildAgentSystemPrompt(skills: LoadedSkill[], basePrompt?: string): string {
  const base = basePrompt || `你是一位学术助手，擅长帮助研究人员阅读、理解和分析学术论文。

你的能力包括：
1. 翻译学术文献，保持专业术语的准确性
2. 解释复杂概念、数学公式和图表
3. 分析论文的核心贡献、方法和实验结果
4. 回答关于论文内容的具体问题
5. 提供相关领域的背景知识和上下文

回答要求：
- 使用清晰、准确的语言
- 对专业术语进行必要的解释
- 使用 Markdown 格式（包括公式块 $...$ 和 $$...$$）
- 对回答中的关键词、核心概念和重要术语使用 Markdown 加粗（如 **关键词**）
- 如有需要，提供具体的例子帮助理解
- 如果用户要求翻译，只翻译文本，不进行其他解释
- 如果不确定，诚实说明而非猜测`;

  const skillSections = skills.map(skill => {
    const content = skill.markdownContent.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skill.skillRoot);
    return `--- Skill: ${skill.name} ---\n${content}`;
  });

  return [base, ...skillSections, buildOutputFormatPrompt()].join('\n\n');
}

function buildOutputFormatPrompt(): string {
  return `--- 输出格式 ---
请严格按以下 XML 标签格式输出，不要使用 JSON：

当你需要调用工具时，必须输出 <thought> 和 <tool_call> 标签（<tool_call> 内容为 JSON）：
<thought>
你的思考过程
</thought>
<tool_call>
{"id": "call_1", "name": "tool_name", "arguments": { "key": "value" }}
</tool_call>

当你不需要调用工具，直接回复用户时，必须输出 <thought> 和 <answer> 标签：
<thought>
你的思考过程
</thought>
<answer>
你的最终回复
</answer>

[极其重要]
1. 只要用户的请求还没有完全满足，你就必须继续调用工具（输出 <tool_call>），绝对不能提前输出 <answer>。
2. 像"页面已加载"、"正在提取"、"准备搜索"、"现在查看"这类话只是中间过程，不是最终答案。说完这类话后，你必须立即调用对应的工具去真正完成操作。
3. 只有当你确实获取了最终的具体结果（如具体的数据、标题、链接、结论等），并且确认可以直接回答用户时，才能输出 <answer>。
4. 不要编造没有获取到的信息。如果你还没有拿到结果，就继续调用工具。
5. 每轮最多只能输出一次 <tool_call>。完成一个 tool_call 拿到结果后，再决定下一步，不要把多个步骤合并到一轮中。
6. 直接、高效地完成任务。不要进行不必要的截图或冗余操作，能用 eval 提取信息就不要截图。`;
}

export function getAllowedToolsFromSkills(skills: LoadedSkill[]): string[] {
  const set = new Set<string>();
  for (const skill of skills) {
    for (const t of skill.allowedTools) {
      set.add(t);
    }
  }
  return Array.from(set);
}
