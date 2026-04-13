import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, RotateCw, FileText } from 'lucide-react';
import { useFileStore } from '../../stores/file';
import { useConversationStore } from '../../stores/conversation';
import { useWorkspaceStore } from '../../stores/workspace';
import SelectionToolbar from '../SelectionToolbar/SelectionToolbar';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set PDF.js worker - use local file for faster loading and offline support
// Use the copied file in dist/renderer directory
pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';

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
  const workspacePath = currentWorkspace?.path || '';

  // Virtual scrolling state - only render visible pages
  const [visibleRange, setVisibleRange] = useState({ start: 1, end: 3 });
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const activeFile = openFiles.find((f) => f.id === activeFileId);

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
    if (!activeFile) {
      setPdfData(null);
      setNumPages(0);
      setVisibleRange({ start: 1, end: 3 });
      return;
    }

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

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
    // Scroll to top when new document loads
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, []);

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
            setVisibleRange((prev) => ({
              start: Math.min(prev.start, Math.max(1, pageNum - 1)),
              end: Math.max(prev.end, Math.min(numPages, pageNum + 2)),
            }));
          }
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '100px 0px', // Load pages slightly before they become visible
        threshold: 0.1,
      }
    );

    // Observe all page containers
    pageRefs.current.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [numPages]);

  // Update visible range when scrolling
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || numPages === 0) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    // Estimate current page based on scroll position
    // Assuming average page height of ~800px at scale 1.0
    const avgPageHeight = 800 * scale;
    const currentPage = Math.max(1, Math.min(numPages, Math.floor(scrollTop / avgPageHeight) + 1));

    // Update visible range to include current page and buffer
    const newStart = Math.max(1, currentPage - 1);
    const newEnd = Math.min(numPages, currentPage + 3);

    setVisibleRange((prev) => {
      if (currentPage < prev.start || currentPage > prev.end) {
        return { start: newStart, end: newEnd };
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
                    }
                  }}
                  data-page-num={pageNum}
                  className="shadow-lg mb-4 last:mb-0 bg-white dark:bg-gray-900"
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
        />
      </div>
    </div>
  );
};

export default PDFViewer;
