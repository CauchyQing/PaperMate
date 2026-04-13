import React, { useEffect, useState, useRef } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import { useFileStore } from '../../stores/file';
import { useWorkspaceStore } from '../../stores/workspace';
import { useCategoryStore } from '../../stores/category';
import PaperEditor from '../PaperEditor/PaperEditor';
import type { FileNode } from '../../../shared/types/file';
import type { Paper } from '../../../shared/types/category';

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  onEditPaper: (paper: Paper) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level, onEditPaper }) => {
  const { expandNode, collapseNode, openFile } = useFileStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { papers, loadPapers } = useCategoryStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isPDF = node.type === 'file' && node.name.toLowerCase().endsWith('.pdf');

  const handleToggle = async () => {
    if (!currentWorkspace) return;

    if (node.type === 'directory') {
      if (node.isExpanded) {
        collapseNode(node.id);
      } else {
        await expandNode(node, currentWorkspace.path);
      }
    } else if (isPDF) {
      // 打开PDF文件
      const pdfFile = {
        id: node.path,
        name: node.name,
        path: node.path,
        relativePath: node.id,
        size: 0,
        lastModified: Date.now(),
      };
      openFile(pdfFile);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isPDF) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleEditCategory = async () => {
    setContextMenu(null);

    // 使用文件名匹配，更可靠
    const fileName = node.name;
    console.log('Looking for paper with filename:', fileName);
    console.log('Available papers:', papers.map((p) => ({ filePath: p.filePath, fileName: p.fileName })));

    // 先通过文件名匹配
    let paper = papers.find((p) => p.fileName === fileName);

    // 如果找不到，尝试通过 filePath 包含匹配
    if (!paper) {
      paper = papers.find(
        (p) =>
          p.filePath === node.path ||
          p.filePath.endsWith('/' + fileName) ||
          p.filePath.endsWith('\\' + fileName) ||
          p.filePath.endsWith(fileName)
      );
    }

    if (paper) {
      console.log('Found paper:', paper);
      onEditPaper(paper);
    } else if (currentWorkspace) {
      // 如果还是找不到，尝试重新加载 papers
      console.log('Paper not found, reloading papers...');
      await loadPapers(currentWorkspace.path);

      const refreshedPapers = useCategoryStore.getState().papers;
      console.log('Refreshed papers:', refreshedPapers.map((p) => ({ filePath: p.filePath, fileName: p.fileName })));

      // 重新通过文件名查找
      const refreshedPaper = refreshedPapers.find((p) => p.fileName === fileName);

      if (refreshedPaper) {
        onEditPaper(refreshedPaper);
      } else {
        alert('未找到论文数据，文件名: ' + fileName);
      }
    }
  };

  const paddingLeft = level * 16 + 8;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded mx-1"
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleToggle}
        onContextMenu={handleContextMenu}
      >
        {node.type === 'directory' && (
          <span className="w-4 h-4 flex items-center justify-center text-gray-500">
            {node.isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        )}
        {node.type === 'file' && <span className="w-4" />}

        {node.type === 'directory' ? (
          <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        ) : (
          <FileText className={`w-4 h-4 flex-shrink-0 ${isPDF ? 'text-red-500' : 'text-gray-400'}`} />
        )}

        <span className="text-sm text-gray-700 dark:text-gray-300 truncate ml-1">
          {node.name}
        </span>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={handleEditCategory}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              🏷️ 编辑分类
            </button>
          </div>
        </>
      )}

      {node.type === 'directory' &&
        node.isExpanded &&
        node.children?.map((child) => (
          <FileTreeItem key={child.id} node={child} level={level + 1} onEditPaper={onEditPaper} />
        ))}
    </div>
  );
};

const FileBrowser: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const { rootNodes, isLoading, loadFiles, refreshFiles } = useFileStore();
  const { papers, importPaper, loadPapers } = useCategoryStore();
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // 确保papers已加载
  useEffect(() => {
    if (currentWorkspace) {
      loadPapers(currentWorkspace.path);
    }
  }, [currentWorkspace, loadPapers]);

  // 加载文件并自动导入所有PDF（递归扫描子文件夹）
  // 使用 ref 来跟踪是否已初始化，避免重复运行
  const hasInitialized = useRef(false);
  useEffect(() => {
    const initFiles = async () => {
      if (!currentWorkspace) return;
      if (hasInitialized.current) return; // 防止重复运行

      setIsImporting(true);
      hasInitialized.current = true;
      try {
        // 先加载根目录文件显示UI
        await loadFiles(currentWorkspace.path);

        // 递归扫描所有PDF文件（包括子文件夹）
        const allPdfFiles = await window.electronAPI.getAllPDFFiles(
          currentWorkspace.path,
          currentWorkspace.path
        );

        // 获取已存在的论文路径（使用 store 获取最新状态，避免依赖 papers）
        const currentPapers = useCategoryStore.getState().papers;
        const existingPaths = new Set(currentPapers.map((p) => p.filePath));
        const newPdfs = allPdfFiles.filter((pdf) => !existingPaths.has(pdf.path));

        // 导入新PDF
        if (newPdfs.length > 0) {
          for (const pdf of newPdfs) {
            await importPaper(currentWorkspace.path, pdf.path, pdf.relativePath);
          }
          // 重新加载论文列表
          await loadPapers(currentWorkspace.path);
        }
      } catch (error) {
        console.error('[FileBrowser] Error importing papers:', error);
      } finally {
        setIsImporting(false);
      }
    };

    initFiles();
    // 只在组件挂载和工作区变化时运行，不依赖 papers 避免循环
  }, [currentWorkspace?.path]);

  const handleRefresh = async () => {
    if (!currentWorkspace) return;

    setIsImporting(true);
    try {
      // 刷新文件列表
      await refreshFiles(currentWorkspace.path);

      // 递归扫描所有PDF
      const allPdfFiles = await window.electronAPI.getAllPDFFiles(
        currentWorkspace.path,
        currentWorkspace.path
      );

      // 导入新PDF（使用 store 获取最新状态）
      const currentPapers = useCategoryStore.getState().papers;
      const existingPaths = new Set(currentPapers.map((p) => p.filePath));
      const newPdfs = allPdfFiles.filter((pdf) => !existingPaths.has(pdf.path));

      for (const pdf of newPdfs) {
        await importPaper(currentWorkspace.path, pdf.path, pdf.relativePath);
      }

      if (newPdfs.length > 0) {
        await loadPapers(currentWorkspace.path);
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          文件浏览器
        </h2>
        <button
          onClick={handleRefresh}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading && rootNodes.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : rootNodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            <p>暂无文件</p>
            <p className="mt-1 text-xs">拖入 PDF 文件或点击刷新</p>
          </div>
        ) : (
          rootNodes.map((node) => (
            <FileTreeItem key={node.id} node={node} level={0} onEditPaper={setEditingPaper} />
          ))
        )}
      </div>

      {/* Paper Editor Modal */}
      <PaperEditor
        paper={editingPaper}
        isOpen={!!editingPaper}
        onClose={() => setEditingPaper(null)}
      />
    </div>
  );
};

export default FileBrowser;
