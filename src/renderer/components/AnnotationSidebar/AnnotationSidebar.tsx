import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { FileText, ChevronRight, ChevronDown, Highlighter, Underline } from 'lucide-react';
import { useAnnotationStore } from '../../stores/annotation';
import { useCategoryStore } from '../../stores/category';
import { useWorkspaceStore } from '../../stores/workspace';
import { useFileStore } from '../../stores/file';
import type { Annotation } from '../../../shared/types/annotation';

const getFileName = (p: string) => p.split(/[\\/]/).pop() || p;

const AnnotationSidebar: React.FC = () => {
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const openFile = useFileStore((s) => s.openFile);
  const papers = useCategoryStore((s) => s.papers);
  const loadPapers = useCategoryStore((s) => s.loadPapers);
  const allAnnotations = useAnnotationStore((s) => s.allAnnotations);
  const isLoading = useAnnotationStore((s) => s.isLoading);
  const loadAllAnnotations = useAnnotationStore((s) => s.loadAllAnnotations);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const [expandedPapers, setExpandedPapers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentWorkspace) {
      loadAllAnnotations(currentWorkspace.path);
      loadPapers(currentWorkspace.path);
    }
  }, [currentWorkspace?.path, loadAllAnnotations, loadPapers]);

  const paperMap = useMemo(() => {
    const map = new Map<string, typeof papers[0]>();
    papers.forEach((p) => {
      map.set(p.id, p);
      map.set(p.filePath, p);
    });
    return map;
  }, [papers]);

  const groupedAnnotations = useMemo(() => {
    const groups = new Map<string, Annotation[]>();
    allAnnotations.forEach((a) => {
      if (!groups.has(a.paperId)) {
        groups.set(a.paperId, []);
      }
      groups.get(a.paperId)!.push(a);
    });
    groups.forEach((list) => {
      list.sort((a, b) => a.pageNumber - b.pageNumber || a.createdAt - b.createdAt);
    });
    return Array.from(groups.entries());
  }, [allAnnotations]);

  const togglePaper = useCallback((paperId: string) => {
    setExpandedPapers((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
      return next;
    });
  }, []);

  const findPaperByAnnotationId = useCallback((paperId: string) => {
    let paper = paperMap.get(paperId);
    if (paper) return paper;
    return papers.find(
      (p) =>
        p.filePath === paperId ||
        p.fileName === paperId ||
        p.filePath.endsWith(paperId) ||
        getFileName(p.filePath) === getFileName(paperId)
    );
  }, [paperMap, papers]);

  const handleAnnotationClick = useCallback(async (paperId: string, pageNumber: number) => {
    let paper = findPaperByAnnotationId(paperId);

    if (!paper && currentWorkspace) {
      try {
        const allPapers = await window.electronAPI.paperGetAll(currentWorkspace.path);
        paper = allPapers.find(
          (p: any) =>
            p.id === paperId ||
            p.filePath === paperId ||
            p.fileName === paperId ||
            p.filePath.endsWith(paperId) ||
            getFileName(p.filePath) === getFileName(paperId)
        );
      } catch (err) {
        // ignore
      }
    }

    if (!paper) return;

    const pdfFile = {
      id: paper.filePath,
      name: paper.fileName,
      path: paper.filePath,
      relativePath: paper.filePath,
      size: 0,
      lastModified: paper.importedAt,
    };
    openFile(pdfFile);

    (window as any).setAnnotationJumpTarget?.(paper.filePath, pageNumber);
  }, [currentWorkspace, findPaperByAnnotationId, openFile]);

  const workspacePath = currentWorkspace?.path || '';

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">标记导航</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          共 {allAnnotations.length} 个标记
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : groupedAnnotations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            <p>暂无标记</p>
            <p className="mt-1 text-xs">在阅读 PDF 时选中文本即可添加标记</p>
          </div>
        ) : (
          groupedAnnotations.map(([paperId, paperAnnotations]) => {
            const paper = findPaperByAnnotationId(paperId);
            const displayTitle = (paper as any)?.displayTitle || paper?.fileName || getFileName(paperId);
            const isExpanded = expandedPapers.has(paperId);

            return (
              <div key={paperId} className="mb-1">
                <button
                  onClick={() => togglePaper(paperId)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <span className="text-gray-500">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                  <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {displayTitle}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {paperAnnotations.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700">
                    {paperAnnotations.map((anno) => (
                      <div
                        key={anno.id}
                        className="group px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => handleAnnotationClick(paperId, anno.pageNumber)}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex-shrink-0">
                            第 {anno.pageNumber} 页
                          </span>
                          {anno.type === 'highlight' ? (
                            <Highlighter className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Underline className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                        {anno.title && (
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate mt-1">
                            {anno.title}
                          </div>
                        )}
                        {anno.comment && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                            {anno.comment}
                          </div>
                        )}
                        {!anno.title && !anno.comment && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
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
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AnnotationSidebar;
