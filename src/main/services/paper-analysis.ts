import { chatSync } from './ai-service';
import { estimateTokens, splitIntoChunks } from './context-manager';
import type { PaperAnalysis } from '../../shared/types/ai';
import type { Paper, Tag } from '../../shared/types';

const ANALYSIS_PROMPT = `你是一位学术文献分析专家。请分析以下论文内容，提取关键信息并以JSON格式返回。

要求：
1. suggestedTitle: 论文的中文标题（如果没有中文标题则提供翻译）
2. suggestedJournal: 期刊/会议名称（如有）
3. suggestedYear: 发表年份（如有）
4. suggestedTopics: 主题标签数组（3-5个，描述论文的研究领域和主题）
5. suggestedKeywords: 关键词数组（5-8个，包括方法、技术、领域等）
6. summary: 用2-3句话概括论文的核心贡献

请确保返回的是有效的JSON格式，不要包含任何其他文字。`;

/**
 * Analyze a paper using AI.
 * @param content Paper content (title, abstract, etc.)
 * @returns Analysis result with suggested metadata
 */
export async function analyzePaper(
  content: string,
  existingTags: Tag[] = []
): Promise<PaperAnalysis> {
  // Truncate content if too long
  const maxTokens = 6000;
  let truncatedContent = content;

  if (estimateTokens(content) > maxTokens) {
    const { chunks } = splitIntoChunks(content, maxTokens);
    truncatedContent = chunks[0] + '\n\n[内容已截断...]';
  }

  const existingTagsStr = existingTags.length > 0
    ? `\n\n已有的标签：${existingTags.map(t => t.name).join(', ')}（请避免重复）`
    : '';

  const messages = [
    { role: 'system' as const, content: ANALYSIS_PROMPT },
    { role: 'user' as const, content: `论文内容：\n\n${truncatedContent}${existingTagsStr}` },
  ];

  const response = await chatSync(messages, { temperature: 0.3 });

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误，无法解析分析结果');
  }

  try {
    const result = JSON.parse(jsonMatch[0]) as PaperAnalysis;

    // Validate required fields
    if (!result.suggestedTitle || !result.suggestedTopics || !result.suggestedKeywords) {
      throw new Error('AI 返回结果缺少必要字段');
    }

    return result;
  } catch (error) {
    throw new Error(`解析 AI 分析结果失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a prompt for paper analysis based on available metadata.
 */
export function createAnalysisPrompt(paper: Paper): string {
  const parts: string[] = [];

  if (paper.title) {
    parts.push(`标题: ${paper.title}`);
  }

  if (paper.authors && paper.authors.length > 0) {
    parts.push(`作者: ${paper.authors.join(', ')}`);
  }

  if (paper.abstract) {
    parts.push(`摘要: ${paper.abstract}`);
  }

  if (paper.journal) {
    parts.push(`期刊/会议: ${paper.journal}`);
  }

  if (paper.publishYear) {
    parts.push(`年份: ${paper.publishYear}`);
  }

  if (paper.doi) {
    parts.push(`DOI: ${paper.doi}`);
  }

  return parts.join('\n\n');
}
