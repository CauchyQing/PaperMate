import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, Play, Pause, RefreshCw } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface TranslationPanelProps {
  pdf: PDFDocumentProxy | null;
  visiblePageNumbers: number[];
  currentPage: number;
  isActive: boolean;
  width: number;
  workspacePath: string;
  paperId: string;
}

export const TranslationPanel: React.FC<TranslationPanelProps> = ({ 
  pdf, 
  visiblePageNumbers, 
  currentPage, 
  isActive, 
  width,
  workspacePath,
  paperId
}) => {
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
  const [isAutoTranslate, setIsAutoTranslate] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Load existing translations when paperId changes
  useEffect(() => {
    if (!workspacePath || !paperId) return;
    
    const loadTranslations = async () => {
      try {
        const existing = await window.electronAPI.translationGet(workspacePath, paperId);
        setTranslations(existing);
      } catch (err) {
        console.error('Failed to load existing translations:', err);
      }
    };
    
    loadTranslations();
  }, [workspacePath, paperId]);

  const translatePage = useCallback(async (pageNum: number) => {
    if (!pdf || translations[pageNum] || loadingPages.has(pageNum)) return;

    setLoadingPages((prev) => new Set(prev).add(pageNum));

    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Improved text extraction: Use coordinates to detect potential line breaks
      let lastY = -1;
      let text = '';
      for (const item of textContent.items as any[]) {
        const currentY = item.transform[5];
        if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
          text += '\n';
        } else if (lastY !== -1) {
          text += ' ';
        }
        text += item.str;
        lastY = currentY;
      }

      if (!text.trim()) {
        const emptyMsg = '*本页为空或无文本*';
        setTranslations((prev) => ({ ...prev, [pageNum]: emptyMsg }));
        window.electronAPI.translationSavePage(workspacePath, paperId, pageNum, emptyMsg).catch(() => {});
        setLoadingPages((prev) => {
          const next = new Set(prev);
          next.delete(pageNum);
          return next;
        });
        return;
      }

      const messages = [
        { 
          role: 'system' as const, 
          content: `你是一个顶级的学术论文翻译专家。请将以下来自论文第 ${pageNum} 页的文本翻译成中文。
**关键要求：**
1. **语义分段**：请你根据语义逻辑，自动重新划分为易读的段落，并在段落之间使用两个换行符（\\n\\n）。禁止输出大段不分行的文字。
2. **保留标题**：识别出章节标题（如 '1. Introduction', '3.2 Methodology' 等），并将其翻译后单独一行并加粗显示。
3. **专业术语**：保持术语翻译的一致性和准确性，且关键词语进行加粗显示。
4. **纯净输出**：只输出翻译后的 Markdown 内容。不要输出任何解释、页码标注或元数据。`
        },
        { role: 'user' as const, content: text }
      ];

      const requestId = `translate_page_${pageNum}_${Date.now()}`;
      let currentTranslation = '';

      const unsub = window.electronAPI.onAIStreamEvent((event: any) => {
        if (event.requestId !== requestId) return;
        if (event.type === 'chunk' && event.content) {
          currentTranslation += event.content;
          setTranslations((prev) => ({ ...prev, [pageNum]: currentTranslation }));
        } else if (event.type === 'done') {
          // Save the final translation to the database
          window.electronAPI.translationSavePage(workspacePath, paperId, pageNum, currentTranslation).catch(() => {});
          
          setLoadingPages((prev) => {
            const next = new Set(prev);
            next.delete(pageNum);
            return next;
          });
          unsub();
        } else if (event.type === 'error') {
           setTranslations((prev) => ({ ...prev, [pageNum]: currentTranslation + '\n\n*(翻译出错: ' + event.error + ')*' }));
           setLoadingPages((prev) => {
            const next = new Set(prev);
            next.delete(pageNum);
            return next;
          });
          unsub();
        }
      });

      await window.electronAPI.aiChat(messages, { requestId, stream: true });

    } catch (err) {
      console.error('Failed to translate page', pageNum, err);
      setTranslations((prev) => ({ ...prev, [pageNum]: '*(提取文本或翻译失败)*' }));
      setLoadingPages((prev) => {
        const next = new Set(prev);
        next.delete(pageNum);
        return next;
      });
    }
  }, [pdf, translations, loadingPages, workspacePath, paperId]);

  useEffect(() => {
    if (!isActive || !isAutoTranslate || !pdf) return;
    
    // Auto-translate only newly visible pages when enabled
    visiblePageNumbers.forEach((pageNum) => {
      if (!translations[pageNum]) {
        translatePage(pageNum);
      }
    });
  }, [visiblePageNumbers, isActive, isAutoTranslate, pdf, translatePage, translations]);

  // Scroll sync: scroll the translation panel to show the current active page
  useEffect(() => {
    if (!isActive || !currentPage) return;
    
    const targetRef = pageRefs.current[currentPage];

    if (targetRef && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        // Accurate offset: align the top of the page block to the top of the container
        const targetTop = targetRef.offsetTop;
        
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  }, [currentPage, isActive]);

  if (!isActive) return null;

  const allPageNums = Object.keys(translations).map(Number).sort((a, b) => a - b);
  const displayPages = Array.from(new Set([...allPageNums, ...visiblePageNumbers])).sort((a, b) => a - b);

  return (
    <div 
      className="bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 shadow-lg"
      style={{ width }}
    >
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <span>AI 沉浸式翻译</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoTranslate(!isAutoTranslate)}
            className={`p-1 rounded text-xs flex items-center gap-1 transition-colors ${
              isAutoTranslate 
                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30' 
                : 'bg-gray-200 text-gray-600 dark:bg-gray-700'
            }`}
            title={isAutoTranslate ? "停止自动翻译" : "开启自动翻译"}
          >
            {isAutoTranslate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isAutoTranslate ? "自动中" : "待机"}
          </button>
          {visiblePageNumbers.length > 0 && !translations[visiblePageNumbers[0]] && (
            <button
              onClick={() => translatePage(visiblePageNumbers[0])}
              className="p-1 text-gray-500 hover:text-primary-600 transition-colors"
              title="手动翻译当前页"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPages.has(visiblePageNumbers[0]) ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
      
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth">
        {displayPages.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
             <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
                <Play className="w-8 h-8 opacity-20" />
             </div>
             <div className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px]">
                点击上方 “播放” 按钮开启自动随页翻译，或在左侧阅读时手动触发。
             </div>
          </div>
        ) : (
          displayPages.map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => (pageRefs.current[pageNum] = el)}
              className="translation-page-block border-b border-gray-100 dark:border-gray-800 pb-8"
            >
              <div className="flex items-center justify-between mb-4">
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <div className="mx-4 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">
                    PAGE {pageNum}
                  </div>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
              </div>
              
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
                {translations[pageNum] ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {translations[pageNum]}
                  </ReactMarkdown>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400 italic text-xs gap-3">
                    {loadingPages.has(pageNum) ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                            <span>正在精准翻译第 {pageNum} 页...</span>
                        </>
                    ) : (
                        <button 
                            onClick={() => translatePage(pageNum)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors not-italic"
                        >
                            <Play className="w-3 h-3" />
                            翻译本页
                        </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
