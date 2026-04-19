import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, RotateCw, FileText, Bookmark, List, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useFileStore } from '../../stores/file';
import { useConversationStore } from '../../stores/conversation';
import { useWorkspaceStore } from '../../stores/workspace';
import { useAnnotationStore } from '../../stores/annotation';
import SelectionToolbar from '../SelectionToolbar/SelectionToolbar';
import { PageAnnotations } from './PageAnnotations';
import { AnnotationEditPopover } from './AnnotationEditPopover';
import { AnnotationCreateDialog } from '../AnnotationDialog/AnnotationCreateDialog';
import PDFOutline from './PDFOutline';
import type { Annotation, AnnotationType } from '../../../shared/types/annotation';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.DEV
  ? '/pdf.worker.min.js'
  : './pdf.worker.min.js';

// Suppress harmless react-pdf / pdfjs warnings when pages are unmounted before text-layer finishes
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const msg = args[0]?.toString?.() || '';
  if (
    msg.includes('TextLayer task cancelled') ||
    msg.includes('Worker task was terminated') ||
    msg.includes('ignoring errors during "GetTextContent')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

const PAGE_MARGIN = 16; // 1rem
const FALLBACK_PAGE_HEIGHT = 800;
const BUFFER_PAGES = 2;


interface SearchMatch {
  pageNumber: number;
  itemIndex: number;
  matchIndexInItem: number;
}

interface PDFPageItemProps {
  pageNum: number;
  scale: number;
  rotation: number;
  annotations: Annotation[];
  editingAnnotation: { annotation: Annotation; pageNumber: number; rect: { left: number; top: number; width: number; height: number } } | null;
  onAnnotationClick: (anno: Annotation, rect: { left: number; top: number; width: number; height: number }) => void;
  onSave: (id: string, title: string, comment: string) => void;
  onDelete: (id: string) => void;
  onCloseEdit: () => void;
  onPageLoadSuccess?: (page: any) => void;
  customTextRenderer?: (textItem: any) => string;
}

const PDFPageItem = React.memo<PDFPageItemProps>(({
  pageNum,
  scale,
  rotation,
  annotations,
  editingAnnotation,
  onAnnotationClick,
  onSave,
  onDelete,
  onCloseEdit,
  onPageLoadSuccess,
  customTextRenderer,
}) => {
  return (
    <div data-page-num={pageNum} style={{ marginBottom: PAGE_MARGIN }} className="shadow-lg bg-white dark:bg-gray-900 relative">
      <Page
        pageNumber={pageNum}
        scale={scale}
        rotate={rotation}
        renderTextLayer={true}
        renderAnnotationLayer={true}
        customTextRenderer={customTextRenderer}
        onLoadSuccess={onPageLoadSuccess}
        loading={
          <div style={{ width: 600, height: 800 }} className="flex items-center justify-center bg-gray-200 dark:bg-gray-700">
            <div className="animate-pulse text-gray-400">Loading page {pageNum}...</div>
          </div>
        }
      />
      <PageAnnotations
        annotations={annotations}
        scale={scale}
        onAnnotationClick={onAnnotationClick}
      />
      {editingAnnotation && editingAnnotation.pageNumber === pageNum && (
        <AnnotationEditPopover
          annotation={editingAnnotation.annotation}
          rect={editingAnnotation.rect}
          onSave={onSave}
          onDelete={onDelete}
          onClose={onCloseEdit}
        />
      )}
    </div>
  );
});

const PDFViewer: React.FC = () => {
  const { activeFileId, openFiles } = useFileStore();
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspaceStore();
  const { createConversation, sendMessage, activeConversationId, setPrefillText } = useConversationStore();
  const { annotations, loadAnnotations, createAnnotation, updateAnnotation, deleteAnnotation } = useAnnotationStore();
  const workspacePath = currentWorkspace?.path || '';

  // PDF outline
  const [outline, setOutline] = useState<Awaited<ReturnType<PDFDocumentProxy['getOutline']>> | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [showOutlinePanel, setShowOutlinePanel] = useState<boolean>(false);

  // Virtual scrolling state
  const [visibleRange, setVisibleRange] = useState({ start: 1, end: 1 + BUFFER_PAGES * 2 });
  const [currentPage, setCurrentPage] = useState(1);

  // Page size cache for stable placeholders
  const pageSizesRef = useRef<Map<number, { width: number; height: number }>>(new Map());
  const [pageSizesVersion, setPageSizesVersion] = useState(0);

  // Annotation creation dialog state
  const [creatingAnnotation, setCreatingAnnotation] = useState<{
    text: string;
    rects: Array<{ left: number; top: number; width: number; height: number }>;
    pageNumber: number;
    defaultType: AnnotationType;
  } | null>(null);

  // In-PDF annotation panel visibility
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);

  // Inline annotation editor state
  const [editingAnnotation, setEditingAnnotation] = useState<{
    annotation: Annotation;
    pageNumber: number;
    rect: { left: number; top: number; width: number; height: number };
  } | null>(null);

  // Jump target from sidebar / outline
  const jumpTargetRef = useRef<{ paperId: string; pageNumber: number } | null>(null);
  const hasRestoredRef = useRef(false);

  const activeFile = openFiles.find((f) => f.id === activeFileId);

  // Refs to avoid recreating callbacks/effects on every state change
  const activeFileRef = useRef(activeFile);
  const numPagesRef = useRef(numPages);
  const scaleRef = useRef(scale);
  const workspacePathRef = useRef(workspacePath);
  const paperIdRef = useRef<string | null>(null);

  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { numPagesRef.current = numPages; }, [numPages]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { workspacePathRef.current = workspacePath; }, [workspacePath]);

  const getPageHeight = useCallback((pageNum: number) => {
    const size = pageSizesRef.current.get(pageNum);
    return size ? size.height * scaleRef.current : FALLBACK_PAGE_HEIGHT * scaleRef.current;
  }, []);

  const getPageOffset = useCallback((pageNum: number) => {
    let offset = 0;
    for (let i = 1; i < pageNum; i++) {
      offset += getPageHeight(i) + PAGE_MARGIN;
    }
    return offset;
  }, [getPageHeight]);

  const totalHeight = useMemo(() => {
    let h = 0;
    for (let i = 1; i <= numPages; i++) {
      h += getPageHeight(i) + PAGE_MARGIN;
    }
    return h + 64; // py-8 padding top+bottom approx
  }, [numPages, scale, pageSizesVersion]);

  const getCurrentPage = useCallback(() => {
    const container = scrollContainerRef.current;
    const np = numPagesRef.current;
    if (!container || np === 0) return 1;
    const scrollTop = container.scrollTop;
    let cp = 1;
    let accumulated = 0;
    for (let i = 1; i <= np; i++) {
      const h = getPageHeight(i) + PAGE_MARGIN;
      if (accumulated + h / 2 > scrollTop) {
        cp = i;
        break;
      }
      accumulated += h;
      if (i === np) cp = np;
    }
    return cp;
  }, [getPageHeight]);

  const suppressScrollRef = useRef(false);

  const jumpToPage = useCallback((pageNumber: number) => {
    const container = scrollContainerRef.current;
    if (!container || numPagesRef.current === 0) return;
    const targetScrollTop = getPageOffset(pageNumber);
    suppressScrollRef.current = true;
    container.style.scrollBehavior = 'auto';
    container.scrollTop = targetScrollTop;
    container.style.scrollBehavior = '';
    const newStart = Math.max(1, pageNumber - BUFFER_PAGES);
    const newEnd = Math.min(numPagesRef.current, pageNumber + BUFFER_PAGES + 1);
    setVisibleRange({ start: newStart, end: newEnd });
    setCurrentPage(pageNumber);
    window.setTimeout(() => {
      suppressScrollRef.current = false;
    }, 150);
  }, [getPageOffset]);

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = useCallback(async (text: string) => {
    if (!text.trim() || !pdfRef.current) {
      setSearchResults([]);
      setCurrentMatchIndex(-1);
      setSearchText('');
      return;
    }
    setIsSearching(true);
    setSearchText(text);
    const pdf = pdfRef.current;
    const numPages = pdf.numPages;
    const results: SearchMatch[] = [];

    try {
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        textContent.items.forEach((item: any, itemIndex: number) => {
          if (item.str) {
            const regex = new RegExp(text, 'gi');
            let matchIndexInItem = 0;
            while (regex.exec(item.str) !== null) {
              results.push({
                pageNumber: i,
                itemIndex,
                matchIndexInItem
              });
              matchIndexInItem++;
            }
          }
        });
      }
      setSearchResults(results);
      if (results.length > 0) {
        setCurrentMatchIndex(0);
        jumpToPage(results[0].pageNumber);
      } else {
        setCurrentMatchIndex(-1);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [jumpToPage]);

  const handleNextMatch = useCallback(() => {
    if (searchResults.length === 0) return;
    const next = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(next);
    jumpToPage(searchResults[next].pageNumber);
  }, [currentMatchIndex, searchResults, jumpToPage]);

  const handlePrevMatch = useCallback(() => {
    if (searchResults.length === 0) return;
    const prev = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prev);
    jumpToPage(searchResults[prev].pageNumber);
  }, [currentMatchIndex, searchResults, jumpToPage]);

  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const textRenderer = useCallback((textItem: { str: string, itemIndex: number, pageIndex: number }) => {
    if (!searchText) return escapeHtml(textItem.str);
    
    const pageNumber = textItem.pageIndex + 1;
    const matchesInThisItem = searchResults.filter(
      r => r.pageNumber === pageNumber && r.itemIndex === textItem.itemIndex
    );
    
    if (matchesInThisItem.length === 0) {
      return escapeHtml(textItem.str);
    }

    const regex = new RegExp(`(${searchText})`, 'gi');
    const parts = textItem.str.split(regex);
    let matchCount = 0;
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const globalMatch = matchesInThisItem[matchCount];
        const globalIndex = searchResults.indexOf(globalMatch);
        const isActive = globalIndex === currentMatchIndex;
        matchCount++;
        
        const bg = isActive ? '#ff9800' : '#ffeb3b';
        const color = isActive ? 'white' : 'black';
        return `<mark style="background-color: ${bg}; color: ${color}; border-radius: 2px; padding: 0 1px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">${escapeHtml(part)}</mark>`;
      } else {
        return escapeHtml(part);
      }
    }).join('');
  }, [searchText, searchResults, currentMatchIndex]);


  // Expose jump target setter globally for AnnotationSidebar
  useEffect(() => {
    (window as any).setAnnotationJumpTarget = (paperId: string, pageNumber: number) => {
      jumpTargetRef.current = { paperId, pageNumber };
      const file = activeFileRef.current;
      if (file && (file.id === paperId || file.path === paperId) && numPagesRef.current > 0) {
        jumpToPage(pageNumber);
      }
    };
  }, [jumpToPage]);

  // Memoize options for CMap support - use local files
  const documentOptions = useMemo(() => ({
    cMapUrl: './cmaps/',
    cMapPacked: true,
  }), []);

  // Memoize the file object to prevent unnecessary reloads
  const fileProp = useMemo(() => {
    if (!pdfData) return undefined;
    const clonedData = pdfData.slice();
    return { data: clonedData };
  }, [pdfData]);

  // Load PDF file when active file changes
  useEffect(() => {
    if (!activeFile) {
      setPdfData(null);
      setNumPages(0);
      setVisibleRange({ start: 1, end: 1 + BUFFER_PAGES * 2 });
      setCurrentPage(1);
      setOutline(null);
      pdfRef.current = null;
      paperIdRef.current = null;
      pageSizesRef.current.clear();
      setPageSizesVersion(0);
      jumpTargetRef.current = null;
      hasRestoredRef.current = false;
      return;
    }

    setPdfData(null);
    setNumPages(0);
    setOutline(null);
    pdfRef.current = null;
    paperIdRef.current = null;
    pageSizesRef.current.clear();
    setPageSizesVersion(0);
    hasRestoredRef.current = false;

    if (jumpTargetRef.current) {
      if (jumpTargetRef.current.paperId !== activeFile.id && jumpTargetRef.current.paperId !== activeFile.path) {
        jumpTargetRef.current = null;
      } else {
        hasRestoredRef.current = true;
      }
    }

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    const loadPdf = async () => {
      setError(null);
      try {
        const base64 = await window.electronAPI.readFile(activeFile.path);
        if (base64.length === 0) {
          throw new Error('File is empty');
        }
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        setPdfData(bytes);

        if (workspacePath) {
          try {
            const papers = await window.electronAPI.paperGetAll(workspacePath);
            const paper = papers.find((p: any) => p.filePath === activeFile.path);
            if (paper) {
              paperIdRef.current = paper.id;
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    loadPdf();

    return () => {
      if (debounceSaveRef.current) {
        clearTimeout(debounceSaveRef.current);
        debounceSaveRef.current = null;
      }
      saveReadPosition();
    };
  }, [activeFile, workspacePath]);

  // Load annotations when active file changes
  useEffect(() => {
    if (activeFile && workspacePath) {
      loadAnnotations(workspacePath, activeFile.path);
    }
  }, [activeFile, workspacePath, loadAnnotations]);

  const restorePosition = useCallback(async () => {
    const file = activeFileRef.current;
    const ws = workspacePathRef.current;
    const container = scrollContainerRef.current;
    if (!file || !ws || !container) return;
    try {
      const papers = await window.electronAPI.paperGetAll(ws);
      const paper = papers.find((p: any) => p.filePath === file.path);
      if (paper?.lastReadPosition) {
        const { pageNumber, scrollTop } = paper.lastReadPosition;
        if (container.scrollTop === 0) {
          // 先用 jumpToPage 设置正确的 visibleRange 并跳转到目标页
          jumpToPage(pageNumber);
          // 短暂延迟后，用保存的精确 scrollTop 做微调
          window.setTimeout(() => {
            suppressScrollRef.current = true;
            container.style.scrollBehavior = 'auto';
            container.scrollTop = scrollTop;
            container.style.scrollBehavior = '';
            window.setTimeout(() => {
              suppressScrollRef.current = false;
            }, 600);
          }, 80);
        }
      }
    } catch {
      // ignore
    }
  }, [jumpToPage]);

  // Document load success
  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
    pdfRef.current = pdf;
    numPagesRef.current = pdf.numPages;
    setError(null);

    pdf.getOutline().then(setOutline).catch(() => setOutline(null));

    const file = activeFileRef.current;
    if (file && jumpTargetRef.current) {
      if (jumpTargetRef.current.paperId === file.id || jumpTargetRef.current.paperId === file.path) {
        jumpToPage(jumpTargetRef.current.pageNumber);
        jumpTargetRef.current = null;
        return;
      }
    }

    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      restorePosition();
    }
  }, [jumpToPage, restorePosition]);

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(error.message);
  }, []);

  const onPageLoadSuccess = useCallback((page: any) => {
    const prev = pageSizesRef.current.get(page.pageNumber);
    if (!prev || prev.height !== page.originalHeight || prev.width !== page.originalWidth) {
      pageSizesRef.current.set(page.pageNumber, {
        width: page.originalWidth,
        height: page.originalHeight,
      });
      setPageSizesVersion((v) => v + 1);
    }
  }, []);

  // Save read position (debounced)
  const saveReadPosition = useCallback(() => {
    const file = activeFileRef.current;
    const ws = workspacePathRef.current;
    const container = scrollContainerRef.current;
    if (!file || !ws || !container) return;

    const scrollTop = container.scrollTop;
    const np = numPagesRef.current;
    let pageNumber = 1;
    let accumulated = 0;
    for (let i = 1; i <= np; i++) {
      const h = getPageHeight(i) + PAGE_MARGIN;
      if (accumulated + h / 2 > scrollTop) {
        pageNumber = i;
        break;
      }
      accumulated += h;
      if (i === np) pageNumber = np;
    }

    const pid = paperIdRef.current;
    if (pid) {
      window.electronAPI.paperUpdate(ws, pid, {
        lastReadPosition: { pageNumber, scrollTop },
        lastReadAt: Date.now(),
      }).catch(() => {});
    } else {
      window.electronAPI.paperGetAll(ws).then((papers: any[]) => {
        const paper = papers.find((p: any) => p.filePath === file.path);
        if (paper) {
          paperIdRef.current = paper.id;
          window.electronAPI.paperUpdate(ws, paper.id, {
            lastReadPosition: { pageNumber, scrollTop },
            lastReadAt: Date.now(),
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [getPageHeight]);

  const debounceSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafScrollRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (suppressScrollRef.current || rafScrollRef.current) return;

    rafScrollRef.current = requestAnimationFrame(() => {
      rafScrollRef.current = null;
      const container = scrollContainerRef.current;
      const np = numPagesRef.current;
      if (!container || np === 0) return;

      const cp = getCurrentPage();
      const newStart = Math.max(1, cp - BUFFER_PAGES);
      const newEnd = Math.min(np, cp + BUFFER_PAGES + 1);

      setVisibleRange((prev) => {
        if (newStart === prev.start && newEnd === prev.end) {
          return prev;
        }
        return { start: newStart, end: newEnd };
      });
      setCurrentPage(cp);

      if (debounceSaveRef.current) {
        clearTimeout(debounceSaveRef.current);
      }
      debounceSaveRef.current = setTimeout(() => {
        saveReadPosition();
      }, 1000);
    });
  }, [getCurrentPage, saveReadPosition]);


  // Trackpad pinch-to-zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Mac trackpad pinch-to-zoom is represented as wheel event with ctrlKey=true
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        // e.deltaY is negative when zooming in (pinching out)
        const delta = e.deltaY * -0.01;
        
        setScale((prev) => {
          const next = prev + delta;
          return Math.min(Math.max(next, 0.5), 3.0);
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Mouse Drag to Pan
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    const handleMouseDown = (e: MouseEvent) => {
      // Middle click (button 1) or Left click + Alt/Space (button 0 + altKey) or empty space on container (not on text)
      // By default we check if target is the container itself or a page background
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
        container.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    };

    const handleMouseUp = () => {
      isDragging = false;
      container.style.cursor = '';
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  }, []);

  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const visiblePageNumbers = useMemo(() => {
    if (numPages === 0) return [];
    const pages: number[] = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      pages.push(i);
    }
    return pages;
  }, [numPages, visibleRange]);

  // Pre-group annotations by page
  const annotationsByPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    if (!activeFile) return map;
    annotations.forEach((a) => {
      if (a.paperId !== activeFile.path) return;
      const list = map.get(a.pageNumber);
      if (list) {
        list.push(a);
      } else {
        map.set(a.pageNumber, [a]);
      }
    });
    return map;
  }, [annotations, activeFile?.path]);

  // Text selection handlers
  const handleTranslate = useCallback(async (text: string) => {
    const ws = workspacePathRef.current;
    const file = activeFileRef.current;
    if (!ws) return;
    const prompt = `请将以下学术文献内容翻译成中文，保持学术性和准确性：\n\n${text}`;
    if (!activeConversationId) {
      await createConversation(ws, {
        topic: `翻译: ${text.slice(0, 20)}...`,
        paperTitle: file?.name,
      });
    }
    await sendMessage(ws, prompt);
  }, [activeConversationId, createConversation, sendMessage]);

  const handleExplain = useCallback(async (text: string) => {
    const ws = workspacePathRef.current;
    const file = activeFileRef.current;
    if (!ws) return;
    const prompt = `请解释以下学术文献内容的含义，用通俗易懂的语言说明：\n\n${text}`;
    if (!activeConversationId) {
      await createConversation(ws, {
        topic: `解释: ${text.slice(0, 20)}...`,
        paperTitle: file?.name,
      });
    }
    await sendMessage(ws, prompt);
  }, [activeConversationId, createConversation, sendMessage]);

  const handleAsk = useCallback(async (text: string, prefillText?: string) => {
    const ws = workspacePathRef.current;
    const file = activeFileRef.current;
    if (!ws) return;
    if (!activeConversationId) {
      await createConversation(ws, {
        topic: `问答: ${text.slice(0, 20)}...`,
        paperTitle: file?.name,
      });
    }
    if (prefillText) {
      setPrefillText(prefillText);
    }
  }, [activeConversationId, createConversation, setPrefillText]);

  // Annotation helpers
  const findPageElementFromSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    let el = selection.getRangeAt(0).commonAncestorContainer as HTMLElement;
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement!;
    return el.closest('[data-page-num]') as HTMLDivElement | null;
  }, []);

  const mergeAnnotationRects = useCallback((
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ) => {
    if (rects.length === 0) return [];
    
    let validRects = rects.filter((r) => r.width > 0.5 && r.height > 0.5);
    if (validRects.length === 0) return [];

    // Calculate median height to filter out large container rects that span multiple lines
    const heights = validRects.map(r => r.height).sort((a, b) => a - b);
    const medianHeight = heights[Math.floor(heights.length / 2)];
    validRects = validRects.filter(r => r.height <= medianHeight * 1.5);
    if (validRects.length === 0) return [];

    const sorted = validRects.sort((a, b) => a.top - b.top || a.left - b.left);
    
    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const curr = sorted[i];
      
      // Two rects are on the same line if their vertical centers are close
      const lastCenter = last.top + last.height / 2;
      const currCenter = curr.top + curr.height / 2;
      
      if (Math.abs(currCenter - lastCenter) < Math.min(last.height, curr.height) / 2) {
        const right = Math.max(last.left + last.width, curr.left + curr.width);
        last.left = Math.min(last.left, curr.left);
        last.width = right - last.left;
        last.top = Math.min(last.top, curr.top);
        last.height = Math.max(last.height, curr.height);
      } else {
        merged.push({ ...curr });
      }
    }
    return merged;
  }, []);

  const handleHighlight = useCallback((text: string, rects: DOMRectList) => {
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
  }, [findPageElementFromSelection, mergeAnnotationRects]);

  const handleUnderline = useCallback((text: string, rects: DOMRectList) => {
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
  }, [findPageElementFromSelection, mergeAnnotationRects]);

  const saveAnnotation = useCallback(async (type: AnnotationType, color: string, title: string, comment: string) => {
    if (!creatingAnnotation || !activeFileRef.current) return;
    const file = activeFileRef.current;

    await createAnnotation(workspacePathRef.current, {
      paperId: file.path,
      pageNumber: creatingAnnotation.pageNumber,
      type,
      color,
      title: title || undefined,
      comment: comment || undefined,
      selectedText: creatingAnnotation.text,
      rects: creatingAnnotation.rects,
      createdScale: scaleRef.current,
    });

    setCreatingAnnotation(null);
  }, [creatingAnnotation, createAnnotation]);

  const jumpToAnnotation = useCallback((target: { pageNumber: number }) => {
    jumpToPage(target.pageNumber);
  }, [jumpToPage]);

  const handleAnnotationClick = useCallback((
    anno: Annotation,
    rect: { left: number; top: number; width: number; height: number }
  ) => {
    setEditingAnnotation({ annotation: anno, pageNumber: anno.pageNumber, rect });
  }, []);

  const handleUpdateAnnotation = useCallback(async (id: string, title: string, comment: string) => {
    await updateAnnotation(workspacePathRef.current, id, {
      title: title.trim() || undefined,
      comment: comment.trim() || undefined,
    });
    setEditingAnnotation(null);
  }, [updateAnnotation]);

  const handleDeleteAnnotation = useCallback(async (id: string) => {
    await deleteAnnotation(workspacePathRef.current, id);
    setEditingAnnotation(null);
  }, [deleteAnnotation]);

  const handleCloseEdit = useCallback(() => setEditingAnnotation(null), []);

  // Close editor when clicking outside
  useEffect(() => {
    if (!editingAnnotation) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.annotation-edit-popover')) {
        setEditingAnnotation(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingAnnotation]);

  const paperAnnotations = useMemo(() => {
    if (!activeFile) return [];
    return annotations
      .filter((a) => a.paperId === activeFile.path)
      .sort((a, b) => a.pageNumber - b.pageNumber || a.createdAt - b.createdAt);
  }, [annotations, activeFile]);

  const toggleOutlinePanel = useCallback(() => setShowOutlinePanel((v) => !v), []);
  const toggleAnnotationPanel = useCallback(() => setShowAnnotationPanel((v) => !v), []);

  const handleOutlineItemClick = useCallback((pageNumber: number) => {
    jumpToPage(pageNumber);
  }, [jumpToPage]);

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
            {numPages > 0 && `第 ${currentPage} / ${numPages} 页`}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Search toggle */}
          <button
            onClick={() => {
              if (isSearchOpen) {
                setIsSearchOpen(false);
                setSearchInput('');
                performSearch('');
              } else {
                setIsSearchOpen(true);
              }
            }}
            className={`p-1.5 rounded transition-colors ${
              isSearchOpen || searchText
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="搜索"
          >
            <Search className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-2" />

          {/* Outline toggle */}
          <button
            onClick={toggleOutlinePanel}
            className={`p-1.5 rounded transition-colors ${
              showOutlinePanel
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="目录"
          >
            <List className="w-5 h-5" />
          </button>

          {/* Annotation toggle */}
          <button
            onClick={toggleAnnotationPanel}
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


      {/* Secondary Search Toolbar */}
      {isSearchOpen && (
        <div className="flex items-center px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 gap-3 text-sm transition-all">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="搜索词语..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performSearch(searchInput);
              }
            }}
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-gray-800 dark:text-gray-200"
            autoFocus
          />
          {isSearching && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
          )}
          {!isSearching && searchResults.length > 0 && (
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {currentMatchIndex + 1} / {searchResults.length}
            </span>
          )}
          {!isSearching && searchResults.length === 0 && searchText && (
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
              无匹配项
            </span>
          )}
          <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-700 pl-2">
            <button
              onClick={handlePrevMatch}
              disabled={searchResults.length === 0}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={searchResults.length === 0}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchInput('');
                performSearch('');
              }}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PDF Content - Virtual Scrolling */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Outline Panel */}
        {showOutlinePanel && (
          <div className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">目录</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PDFOutline
                outline={outline}
                pdf={pdfRef.current || false}
                onItemClick={handleOutlineItemClick}
              />
            </div>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto scroll-smooth relative"
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
            <div
              className="py-8 flex flex-col items-center"
              style={{ minHeight: totalHeight }}
            >
              <div style={{ height: getPageOffset(visibleRange.start) }} />
              <Document
                file={fileProp}
                onLoadSuccess={(pdf: any) => onDocumentLoadSuccess(pdf)}
                onLoadError={onDocumentLoadError}
                options={documentOptions}
                loading={null}
              >
                {visiblePageNumbers.map((pageNum) => (
                  <PDFPageItem
                    key={`page-${pageNum}`}
                    pageNum={pageNum}
                    scale={scale}
                    rotation={rotation}
                    annotations={annotationsByPage.get(pageNum) || []}
                    editingAnnotation={editingAnnotation}
                    onAnnotationClick={handleAnnotationClick}
                    onSave={handleUpdateAnnotation}
                    onDelete={handleDeleteAnnotation}
                    onCloseEdit={handleCloseEdit}
                    onPageLoadSuccess={onPageLoadSuccess}
                    customTextRenderer={textRenderer}
                  />
                ))}
              </Document>
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
