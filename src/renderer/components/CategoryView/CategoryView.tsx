import React, { useEffect, useState } from 'react';
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
  const { currentWorkspace } = useWorkspaceStore();
  const { openFile } = useFileStore();
  const {
    categoryGroups,
    activeCategory,
    isLoading,
    loadCategories,
    setActiveCategory,
  } = useCategoryStore();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentWorkspace && activeCategory !== 'folder') {
      loadCategories(currentWorkspace.path, activeCategory as CategoryType);
      setExpandedGroups(new Set()); // 重置展开状态
    }
  }, [currentWorkspace, activeCategory, loadCategories]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handlePaperClick = (paper: Paper) => {
    const pdfFile = {
      id: paper.id,
      name: paper.fileName,
      path: paper.filePath,
      relativePath: paper.filePath,
      size: 0,
      lastModified: paper.importedAt,
    };
    openFile(pdfFile);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
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
            />
          ))
        )}
      </div>
    </div>
  );
};

interface CategoryGroupItemProps {
  group: CategoryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onPaperClick: (paper: Paper) => void;
}

const CategoryGroupItem: React.FC<CategoryGroupItemProps> = ({
  group,
  isExpanded,
  onToggle,
  onPaperClick,
}) => {
  return (
    <div className="mb-1">
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
        <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700">
          {group.papers.map((paper: any) => (
            <button
              key={paper.id}
              onClick={() => onPaperClick(paper)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
            >
              <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {paper.displayTitle}
              </span>
              {paper.isFavorite && <span className="text-yellow-500">★</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryView;
