import React, { useEffect } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import { useFileStore } from '../../stores/file';
import { useWorkspaceStore } from '../../stores/workspace';
import type { FileNode } from '../../../shared/types/file';

interface FileTreeItemProps {
  node: FileNode;
  level: number;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level }) => {
  const { expandNode, collapseNode, openFile } = useFileStore();
  const { currentWorkspace } = useWorkspaceStore();

  const handleToggle = async () => {
    if (!currentWorkspace) return;

    if (node.type === 'directory') {
      if (node.isExpanded) {
        collapseNode(node.id);
      } else {
        await expandNode(node, currentWorkspace.path);
      }
    } else {
      // It's a PDF file, open it
      const pdfFile = {
        id: node.id,
        name: node.name,
        path: node.path,
        relativePath: node.id,
        size: 0,
        lastModified: Date.now(),
      };
      openFile(pdfFile);
    }
  };

  const paddingLeft = level * 16 + 8;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded mx-1"
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleToggle}
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
          <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}

        <span className="text-sm text-gray-700 dark:text-gray-300 truncate ml-1">
          {node.name}
        </span>
      </div>

      {node.type === 'directory' &&
        node.isExpanded &&
        node.children?.map((child) => (
          <FileTreeItem key={child.id} node={child} level={level + 1} />
        ))}
    </div>
  );
};

const FileBrowser: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const { rootNodes, isLoading, loadFiles, refreshFiles } = useFileStore();

  useEffect(() => {
    if (currentWorkspace) {
      loadFiles(currentWorkspace.path);
    }
  }, [currentWorkspace, loadFiles]);

  const handleRefresh = () => {
    if (currentWorkspace) {
      refreshFiles(currentWorkspace.path);
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
        {isLoading ? (
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
            <FileTreeItem key={node.id} node={node} level={0} />
          ))
        )}
      </div>
    </div>
  );
};

export default FileBrowser;
