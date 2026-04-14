import { chatSync } from './ai-service';
import { getTool } from '../agent/tool-registry';
import type { PdfContext } from '../../shared/types';

const SUMMARY_PROMPT = `你是一位学术论文分析专家。请阅读以下从PDF中提取的论文文本，并生成一份结构化摘要。

请严格按以下JSON格式输出，不要包含任何额外的Markdown代码块标记：
{
  "title": "论文标题（如有）",
  "background": "研究背景与动机，1-2句话",
  "methodology": "核心方法、模型或技术路线，3-5句话",
  "experiments": "实验设置、数据集和主要结果，3-5句话",
  "conclusion": "主要结论和未来方向，1-2句话",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

如果某些部分在文本中无法找到，请写"文中未明确提及"。

论文文本：`;

export async function buildPdfContext(filePath: string, fileName: string): Promise<PdfContext> {
  const pdfTool = getTool('pdf_extract');
  if (!pdfTool) {
    throw new Error('pdf_extract tool not found');
  }

  // 1. Extract text (default up to 20 pages)
  const extractedText = await pdfTool.handler({ filePath, maxPages: 20 });

  // 2. Generate structured summary via LLM
  let structuredSummary = '';
  try {
    const summary = await chatSync([
      { role: 'system', content: SUMMARY_PROMPT + '\n\n' + extractedText.slice(0, 15000) },
    ], { temperature: 0.3 });
    structuredSummary = summary.trim();
  } catch (err: any) {
    console.error('[PdfContext] Failed to generate summary:', err);
    structuredSummary = '摘要生成失败，将使用原始文本进行回答。';
  }

  return {
    filePath,
    fileName,
    extractedText: extractedText.slice(0, 20000),
    structuredSummary,
    extractedAt: Date.now(),
  };
}
