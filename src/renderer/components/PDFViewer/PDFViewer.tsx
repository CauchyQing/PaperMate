import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, RotateCw, FileText, Bookmark } from 'lucide-react';
import { useFileStore } from '../../stores/file';
import { useConversationStore } from '../../stores/conversation';
import { useWorkspaceStore } from '../../stores/workspace';
import { useAnnotationStore } from '../../stores/annotation';
import SelectionToolbar from '../SelectionToolbar/SelectionToolbar';
import { PageAnnotations } from './PageAnnotations';
import { AnnotationCreateDialog } from '../AnnotationDialog/AnnotationCreateDialog';
import type { AnnotationType } from '../../../shared/types/annotation';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set PDF.js worker - different paths for dev and production
// In dev: use node_modules directly, in production: use copied file
pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.DEV
  ? new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href
  : './pdf.worker.min.js';

const PDFViewer: React.FC = () => {
  const { activeFileId, openFiles } = useFileStore();
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspaceStore();
  const { createConversation, sendMessage, activeConversationId, setPrefillText } = useConversationStore();
  const { annotations, loadAnnotations, createAnnotation, deleteAnnotation } = useAnnotationStore();
  const workspacePath = currentWorkspace?.path || '';

  // Virtual scrolling state - only render visible pages
  const [visibleRange, setVisibleRange] = useState({ start: 1, end: 3 });
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Annotation creation dialog state
  const [creatingAnnotation, setCreatingAnnotation] = useState<{
    text: string;
    rects: Array<{ left: number; top: number; width: number; height: number }>;
    pageNumber: number;
    defaultType: AnnotationType;
  } | null>(null);

  // In-PDF annotation panel visibility
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);

  const activeFile = openFiles.find((f) => f.id === activeFileId);

  // Global jump target for sidebar navigation
  const globalPendingJump = useRef<{ paperId: string | null; pageNumber: number | null }>({ paperId: null, pageNumber: null });
  useEffect(() => {
    (window as any).setAnnotationJumpTarget = (paperId: string, pageNumber: number) => {
      console.log('[PDFViewer] Jump target set:', { paperId, pageNumber });
      globalPendingJump.current = { paperId, pageNumber };
    };
  }, []);

  // Memoize options for CMap support - use local files
  const documentOptions = useMemo(() => ({
    cMapUrl: './cmaps/',
    cMapPacked: true,
  }), []);

  // Memoize the file object to prevent unnecessary reloads
  const fileProp = useMemo(() => {
    if (!pdfData) return undefined;
    // Create a deep copy of the data for react-pdf
    const clonedData = pdfData.slice();
    return { data: clonedData };
  }, [pdfData]);

  // Load PDF file when active file changes
  useEffect(() => {
    console.log('[PDFViewer] activeFile changed:', activeFile?.id, activeFile?.name);
    if (!activeFile) {
      setPdfData(null);
      setNumPages(0);
      setVisibleRange({ start: 1, end: 3 });
      return;
    }

    setPdfData(null);
    setNumPages(0);

    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      console.log('[PDFViewer] Loading PDF:', activeFile.path);
      try {
        const base64 = await window.electronAPI.readFile(activeFile.path);
        console.log('[PDFViewer] File read success, base64 length:', base64.length);
        if (base64.length === 0) {
          throw new Error('File is empty');
        }
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        console.log('[PDFViewer] Base64 decoded, binary length:', binaryString.length);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log('[PDFViewer] Uint8Array created, bytes:', bytes.length);
        // Check if it looks like a PDF (starts with %PDF)
        const header = String.fromCharCode(...bytes.slice(0, 5));
        console.log('[PDFViewer] File header:', header);
        if (!header.startsWith('%PDF')) {
          console.warn('[PDFViewer] Warning: File does not look like a PDF');
        }
        setPdfData(bytes);
      } catch (err) {
        console.error('[PDFViewer] Load error:', err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [activeFile]);

  // Load annotations when active file changes
  useEffect(() => {
    if (activeFile && workspacePath) {
      loadAnnotations(workspacePath, activeFile.path);
    }
  }, [activeFile, workspacePath, loadAnnotations]);

  // Handle pending jump from sidebar for already-loaded documents
  useEffect(() => {
    console.log('[PDFViewer] Pending jump check:', {
      hasActiveFile: !!activeFile,
      activeFileId: activeFile?.id,
      pendingPaperId: globalPendingJump.current.paperId,
      pendingPageNumber: globalPendingJump.current.pageNumber,
      hasPdfData: !!pdfData,
      numPages,
    });
    if (
      activeFile &&
      (globalPendingJump.current.paperId === activeFile.id || globalPendingJump.current.paperId === activeFile.path) &&
      globalPendingJump.current.pageNumber &&
      pdfData &&
      numPages > 0
    ) {
      const pageNumber = globalPendingJump.current.pageNumber;
      globalPendingJump.current.paperId = null;
      globalPendingJump.current.pageNumber = null;
      console.log('[PDFViewer] Executing jump for already-loaded doc, page:', pageNumber);
      jumpToAnnotation({ pageNumber });
    }
  }, [activeFile, pdfData, numPages]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log('[PDFViewer] Document loaded, numPages:', numPages, 'activeFile:', activeFile?.id);
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);

    // Handle pending jump after new document loads
    if (
      activeFile &&
      (globalPendingJump.current.paperId === activeFile.id || globalPendingJump.current.paperId === activeFile.path) &&
      globalPendingJump.current.pageNumber
    ) {
      const pageNumber = globalPendingJump.current.pageNumber;
      globalPendingJump.current.paperId = null;
      globalPendingJump.current.pageNumber = null;
      console.log('[PDFViewer] Executing jump after document load, page:', pageNumber);
      jumpToAnnotation({ pageNumber });
      return;
    }

    // Scroll to top when new document loads (only if no pending jump)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeFile]);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('[PDFViewer] Document load error:', error);
    setError(error.message);
    setIsLoading(false);
  }, []);

  // Setup intersection observer for virtual scrolling
  useEffect(() => {
    if (numPages === 0) return;

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute('data-page-num') || '1', 10);
          if (entry.isIntersecting) {
            // Page is visible, ensure it's in the render range
            setVisibleRange((prev) => {
              const newStart = Math.min(prev.start, Math.max(1, pageNum - 1));
              const newEnd = Math.max(prev.end, Math.min(numPages, pageNum + 2));
              if (newStart !== prev.start || newEnd !== prev.end) {
                return { start: newStart, end: newEnd };
              }
              return prev;
            });
          }
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '200px 0px', // Larger margin to preload more pages
        threshold: 0.01,
      }
    );

    // Observe all currently rendered page containers
    pageRefs.current.forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [numPages, visibleRange.start, visibleRange.end]);

  // Update visible range when scrolling - always extend range to include current viewport
  const pendingJumpPageRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || numPages === 0) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;

    // Estimate current page based on scroll position
    // Assuming average page height of ~800px at scale 1.0
    const avgPageHeight = 800 * scale;
    const currentPage = Math.max(1, Math.min(numPages, Math.floor(scrollTop / avgPageHeight) + 1));

    // Always update visible range to include current page and buffer
    // This ensures smooth scrolling by pre-loading pages in the scroll direction
    const newStart = Math.max(1, currentPage - 1);
    const newEnd = Math.min(numPages, currentPage + 3);

    setVisibleRange((prev) => {
      // Extend range if needed to include the current viewport
      const start = Math.min(prev.start, newStart);
      const end = Math.max(prev.end, newEnd);
      // Only update if range actually changed
      if (start !== prev.start || end !== prev.end) {
        return { start, end };
      }
      return prev;
    });
  }, [numPages, scale]);

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Generate array of page numbers - only render visible pages
  const visiblePageNumbers = useMemo(() => {
    if (numPages === 0) return [];
    const pages = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      pages.push(i);
    }
    return pages;
  }, [numPages, visibleRange]);

  // Handle text selection actions
  const handleTranslate = async (text: string) => {
    if (!workspacePath) return;
    const prompt = `请将以下学术文献内容翻译成中文，保持学术性和准确性：\n\n${text}`;
    if (!activeConversationId) {
      await createConversation(workspacePath, {
        topic: `翻译: ${text.slice(0, 20)}...`,
        paperTitle: activeFile?.name,
      });
    }
    await sendMessage(workspacePath, prompt);
  };

  const handleExplain = async (text: string) => {
    if (!workspacePath) return;
    const prompt = `请解释以下学术文献内容的含义，用通俗易懂的语言说明：\n\n${text}`;
    if (!activeConversationId) {
      await createConversation(workspacePath, {
        topic: `解释: ${text.slice(0, 20)}...`,
        paperTitle: activeFile?.name,
      });
    }
    await sendMessage(workspacePath, prompt);
  };

  const handleAsk = async (text: string, prefillText?: string) => {
    if (!workspacePath) return;
    // Create conversation if none exists
    if (!activeConversationId) {
      await createConversation(workspacePath, {
        topic: `问答: ${text.slice(0, 20)}...`,
        paperTitle: activeFile?.name,
      });
    }
    // Set prefill text to populate the input box instead of sending immediately
    if (prefillText) {
      setPrefillText(prefillText);
    }
  };

  // Annotation helpers
  const findPageElementFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    let el = selection.getRangeAt(0).commonAncestorContainer as HTMLElement;
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement!;
    return el.closest('[data-page-num]') as HTMLDivElement | null;
  };

  // Merge rects on the same text line to avoid duplicated underlines/overlays
  const mergeAnnotationRects = (
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => {
    if (rects.length === 0) return [];
    const sorted = [...rects]
      .filter((r) => r.width > 0.5 && r.height > 0.5)
      .sort((a, b) => a.top - b.top || a.left - b.left);
    if (sorted.length === 0) return [];
    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const curr = sorted[i];
      if (Math.abs(curr.top - last.top) < 4) {
        const right = Math.max(last.left + last.width, curr.left + curr.width);
        last.left = Math.min(last.left, curr.left);
        last.width = right - last.left;
        last.height = Math.max(last.height, curr.height);
      } else {
        merged.push({ ...curr });
      }
    }
    return merged;
  };

  const handleHighlight = (text: string, rects: DOMRectList) => {
    const pageEl = findPageElementFromSelection();
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const pageNumber = parseInt(pageEl.getAttribute('data-page-num') || '1', 10);
    const rawRects = Array.from(rects).map((r) => ({
      left: r.left - pageRect.left,
      top: r.top - pageRect.top,
      width: r.width,
      height: r.height,
    }));
    setCreatingAnnotation({
      text,
      rects: mergeAnnotationRects(rawRects),
      pageNumber,
      defaultType: 'highlight',
    });
  };

  const handleUnderline = (text: string, rects: DOMRectList) => {
    const pageEl = findPageElementFromSelection();
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const pageNumber = parseInt(pageEl.getAttribute('data-page-num') || '1', 10);
    const rawRects = Array.from(rects).map((r) => ({
      left: r.left - pageRect.left,
      top: r.top - pageRect.top,
      width: r.width,
      height: r.height,
    }));
    setCreatingAnnotation({
      text,
      rects: mergeAnnotationRects(rawRects),
      pageNumber,
      defaultType: 'underline',
    });
  };

  const saveAnnotation = async (type: AnnotationType, color: string, title: string, comment: string) => {
    if (!creatingAnnotation || !activeFile) return;

    await createAnnotation(workspacePath, {
      paperId: activeFile.path,
      pageNumber: creatingAnnotation.pageNumber,
      type,
      color,
      title: title || undefined,
      comment: comment || undefined,
      selectedText: creatingAnnotation.text,
      rects: creatingAnnotation.rects,
      createdScale: scale,
    });

    setCreatingAnnotation(null);
  };

  const jumpToAnnotation = (annotation: { pageNumber: number }) => {
    console.log('[PDFViewer] jumpToAnnotation called for page:', annotation.pageNumber);
    pendingJumpPageRef.current = annotation.pageNumber;
    // Ensure the page is in visible range first
    setVisibleRange((prev) => {
      const next = {
        start: Math.min(prev.start, annotation.pageNumber),
        end: Math.max(prev.end, annotation.pageNumber),
      };
      console.log('[PDFViewer] Extending visibleRange from', prev, 'to', next);
      return next;
    });
  };

  const paperAnnotations = useMemo(() => {
    if (!activeFile) return [];
    return annotations
      .filter((a) => a.paperId === activeFile.path)
      .sort((a, b) => a.pageNumber - b.pageNumber || a.createdAt - b.createdAt);
  }, [annotations, activeFile]);

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>选择一个 PDF 文件开始阅读</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
            {activeFile.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {numPages > 0 && `${numPages} 页`}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Annotation toggle */}
          <button
            onClick={() => setShowAnnotationPanel((v) => !v)}
            className={`p-1.5 rounded transition-colors ${
              showAnnotationPanel
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="标记列表"
          >
            <Bookmark className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-2" />

          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            title="缩小"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            title="放大"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-2" />

          {/* Rotate */}
          <button
            onClick={rotate}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            title="旋转"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Content - Virtual Scrolling */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth relative"
        >
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-500">
                <p>Failed to load PDF</p>
                <p className="text-sm mt-2">{error}</p>
              </div>
            </div>
          ) : !pdfData ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center gap-4">
              <Document
                file={fileProp}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                options={documentOptions}
                loading={null}
              >
                {visiblePageNumbers.map((pageNum) => (
                  <div
                    key={`page-${pageNum}`}
                    ref={(el) => {
                      if (el) {
                        // Only observe if not already observed
                        if (!pageRefs.current.has(pageNum)) {
                          pageRefs.current.set(pageNum, el);
                          observerRef.current?.observe(el);
                        }
                        // Handle pending jump from sidebar
                        if (pendingJumpPageRef.current === pageNum) {
                          console.log('[PDFViewer] Page ref matched pending jump, scrolling to page:', pageNum);
                          pendingJumpPageRef.current = null;
                          setTimeout(() => {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }
                      }
                    }}
                    data-page-num={pageNum}
                    className="shadow-lg mb-4 last:mb-0 bg-white dark:bg-gray-900 relative"
                  >
                    <Page
                      pageNumber={pageNum}
                      scale={scale}
                      rotate={rotation}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div className="w-[600px] h-[800px] flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                          <div className="animate-pulse text-gray-400">Loading page {pageNum}...</div>
                        </div>
                      }
                    />
                    <PageAnnotations
                      annotations={useAnnotationStore.getState().getAnnotationsByPage(activeFile.path, pageNum)}
                      scale={scale}
                      onAnnotationClick={(anno) => {
                        // Scroll to annotation
                        jumpToAnnotation(anno);
                      }}
                    />
                  </div>
                ))}
              </Document>
              {numPages > 0 && (
                <div className="text-sm text-gray-500 mt-4">
                  显示第 {visibleRange.start} - {visibleRange.end} 页，共 {numPages} 页
                </div>
              )}
            </div>
          )}

          <SelectionToolbar
            containerRef={scrollContainerRef}
            onTranslate={handleTranslate}
            onExplain={handleExplain}
            onAsk={handleAsk}
            onHighlight={handleHighlight}
            onUnderline={handleUnderline}
          />
        </div>

        {/* In-PDF Annotation Panel */}
        {showAnnotationPanel && (
          <div className="w-64 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">本文标记</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{paperAnnotations.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {paperAnnotations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  暂无标记
                </div>
              ) : (
                paperAnnotations.map((anno) => (
                  <div
                    key={anno.id}
                    className="group p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => jumpToAnnotation(anno)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      >
                        第 {anno.pageNumber} 页
                      </span>
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: anno.type === 'highlight' ? anno.color : 'transparent',
                          borderBottom: anno.type === 'underline' ? `2px solid ${anno.color}` : 'none',
                        }}
                      />
                    </div>
                    {anno.title && (
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {anno.title}
                      </div>
                    )}
                    {anno.comment && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {anno.comment}
                      </div>
                    )}
                    {!anno.title && !anno.comment && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {anno.selectedText}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnnotation(workspacePath, anno.id);
                      }}
                      className="mt-1 text-xs text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      删除
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {creatingAnnotation && (
        <AnnotationCreateDialog
          isOpen={true}
          defaultType={creatingAnnotation.defaultType}
          selectedText={creatingAnnotation.text}
          onClose={() => setCreatingAnnotation(null)}
          onConfirm={saveAnnotation}
        />
      )}
    </div>
  );
};

export default PDFViewer;
