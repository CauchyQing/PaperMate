import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  BookOpen,
  Tag,
  Hash,
  Eye,
  Star,
  FileText,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useCategoryStore } from '../../stores/category';
import { useWorkspaceStore } from '../../stores/workspace';
import { useFileStore } from '../../stores/file';
import PaperEditor from '../PaperEditor/PaperEditor';
import type {
  CategoryType,
  CategoryGroup,
  Paper,
} from '../../../shared/types/category';

// 5个分类维度（不含文件夹）
const categoryButtons: {
  type: CategoryType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { type: 'year', label: '年份', icon: <Calendar className="w-4 h-4" /> },
  { type: 'journal', label: '期刊/会议', icon: <BookOpen className="w-4 h-4" /> },
  { type: 'topic', label: '主题', icon: <Tag className="w-4 h-4" /> },
  { type: 'keyword', label: '关键词', icon: <Hash className="w-4 h-4" /> },
  { type: 'readStatus', label: '阅读状态', icon: <Eye className="w-4 h-4" /> },
  { type: 'rating', label: '重要性', icon: <Star className="w-4 h-4" /> },
];

const CategoryView: React.FC = () => {
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const openFile = useFileStore((s) => s.openFile);
  const categoryGroups = useCategoryStore((s) => s.categoryGroups);
  const activeCategory = useCategoryStore((s) => s.activeCategory);
  const isLoading = useCategoryStore((s) => s.isLoading);
  const loadCategories = useCategoryStore((s) => s.loadCategories);
  const setActiveCategory = useCategoryStore((s) => s.setActiveCategory);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);

  useEffect(() => {
    if (currentWorkspace && activeCategory !== 'folder') {
      loadCategories(currentWorkspace.path, activeCategory as CategoryType);
      setExpandedGroups(new Set()); // 重置展开状态
    }
  }, [currentWorkspace?.path, activeCategory, loadCategories]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const handlePaperClick = useCallback((paper: Paper) => {
    const pdfFile = {
      id: paper.filePath,
      name: paper.fileName,
      path: paper.filePath,
      relativePath: paper.filePath,
      size: 0,
      lastModified: paper.importedAt,
    };
    openFile(pdfFile);
  }, [openFile]);

  const handleEditorClose = useCallback(() => {
    setEditingPaper(null);
    // 重新加载分类数据以反映可能的分类变更
    if (currentWorkspace && activeCategory !== 'folder') {
      loadCategories(currentWorkspace.path, activeCategory as CategoryType);
    }
  }, [currentWorkspace, activeCategory, loadCategories]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800 relative">
      {/* 分类选择器 */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-1">
          {categoryButtons.map((btn) => (
            <button
              key={btn.type}
              onClick={() => setActiveCategory(btn.type)}
              className={`
                flex flex-col items-center gap-1 p-2 rounded text-xs
                transition-colors
                ${
                  activeCategory === btn.type
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 分类列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : categoryGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            <p>暂无分类数据</p>
            <p className="mt-1 text-xs">在文件浏览器中右键PDF编辑分类</p>
          </div>
        ) : (
          categoryGroups.map((group: CategoryGroup) => (
            <CategoryGroupItem
              key={group.id}
              group={group}
              isExpanded={expandedGroups.has(group.id)}
              onToggle={() => toggleGroup(group.id)}
              onPaperClick={handlePaperClick}
              onEditPaper={setEditingPaper}
            />
          ))
        )}
      </div>

      {/* Paper Editor Modal */}
      <PaperEditor
        paper={editingPaper}
        isOpen={!!editingPaper}
        onClose={handleEditorClose}
      />
    </div>
  );
};

interface CategoryGroupItemProps {
  group: CategoryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onPaperClick: (paper: Paper) => void;
  onEditPaper: (paper: Paper) => void;
}

const CategoryGroupItem: React.FC<CategoryGroupItemProps> = ({
  group,
  isExpanded,
  onToggle,
  onPaperClick,
  onEditPaper,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; paper: Paper } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, paper: Paper) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, paper });
  };

  const handleEditCategory = () => {
    if (contextMenu?.paper) {
      onEditPaper(contextMenu.paper);
    }
    setContextMenu(null);
  };

  return (
    <div className="mb-1 relative">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
      >
        <span className="text-gray-500">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {group.name}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
          {group.count}
        </span>
      </button>

      {isExpanded && (
        <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700 relative">
          {group.papers.map((paper: any) => (
            <div key={paper.id}>
              <button
                onClick={() => onPaperClick(paper)}
                onContextMenu={(e) => handleContextMenu(e, paper)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {paper.displayTitle}
                </span>
                {paper.isFavorite && <span className="text-yellow-500">★</span>}
              </button>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
};

export default CategoryView;
