import React, { useEffect, useState } from 'react';
import { Folder, Calendar, BookOpen, Tag, Hash, FileText, ChevronRight, ChevronDown, Edit3, Settings } from 'lucide-react';
import { useCategoryStore } from '../../stores/category';
import { useWorkspaceStore } from '../../stores/workspace';
import { useFileStore } from '../../stores/file';
import SearchBar from '../SearchBar/SearchBar';
import PaperEditor from '../PaperEditor/PaperEditor';
import TagManager from '../TagManager/TagManager';
import type { CategoryType, CategoryGroup, Paper } from '../../../shared/types/category';

interface CategoryViewProps {
  onSelectPaper?: (paper: any) => void;
}

const CategoryView: React.FC<CategoryViewProps> = ({ onSelectPaper }) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { openFile } = useFileStore();
  const {
    papers,
    categoryGroups,
    activeCategory,
    isLoading,
    loadCategories,
    loadPapers,
    setActiveCategory,
  } = useCategoryStore();

  const [searchResults, setSearchResults] = useState<Paper[] | null>(null);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadPapers(currentWorkspace.path);
      if (activeCategory !== 'folder') {
        loadCategories(currentWorkspace.path, activeCategory as CategoryType);
      }
    }
  }, [currentWorkspace, activeCategory, loadCategories, loadPapers]);

  const categoryButtons: { type: CategoryType | 'folder'; label: string; icon: React.ReactNode }[] = [
    { type: 'folder', label: '文件夹', icon: <Folder className="w-4 h-4" /> },
    { type: 'year', label: '年份', icon: <Calendar className="w-4 h-4" /> },
    { type: 'journal', label: '期刊', icon: <BookOpen className="w-4 h-4" /> },
    { type: 'topic', label: '主题', icon: <Tag className="w-4 h-4" /> },
    { type: 'keyword', label: '关键词', icon: <Hash className="w-4 h-4" /> },
  ];

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
    onSelectPaper?.(paper);
  };

  const displayGroups = searchResults
    ? [{
        id: 'search-results',
        name: `搜索结果 (${searchResults.length})`,
        count: searchResults.length,
        papers: searchResults.map(p => ({ ...p, displayTitle: p.title || p.fileName })),
      }]
    : categoryGroups;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Search Bar */}
      <SearchBar
        onSearchResults={(results) => setSearchResults(results)}
        onClearSearch={() => setSearchResults(null)}
      />

      {/* Category Selector */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-1">
          {categoryButtons.map((btn) => (
            <button
              key={btn.type}
              onClick={() => {
                setActiveCategory(btn.type);
                setSearchResults(null);
              }}
              className={`
                flex flex-col items-center gap-1 p-2 rounded text-xs
                transition-colors
                ${activeCategory === btn.type
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

      {/* Tag Manager Button */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsTagManagerOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          管理标签
        </button>
      </div>

      {/* Category Groups */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : activeCategory === 'folder' && !searchResults ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            <p>切换到分类视图查看</p>
          </div>
        ) : displayGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            <p>暂无分类数据</p>
            <p className="mt-1 text-xs">导入 PDF 后可自动分类</p>
          </div>
        ) : (
          displayGroups.map((group: CategoryGroup) => (
            <CategoryGroupItem
              key={group.id}
              group={group}
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
        onClose={() => setEditingPaper(null)}
      />

      {/* Tag Manager Modal */}
      <TagManager
        isOpen={isTagManagerOpen}
        onClose={() => setIsTagManagerOpen(false)}
      />
    </div>
  );
};

interface CategoryGroupItemProps {
  group: CategoryGroup;
  onPaperClick: (paper: Paper) => void;
  onEditPaper: (paper: Paper) => void;
}

const CategoryGroupItem: React.FC<CategoryGroupItemProps> = ({
  group,
  onPaperClick,
  onEditPaper,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
      >
        <span className="text-gray-500">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
            <div
              key={paper.id}
              className="group flex items-center gap-1 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <button
                onClick={() => onPaperClick(paper)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {paper.displayTitle}
                </span>
                {paper.isFavorite && (
                  <span className="text-yellow-500">★</span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPaper(paper);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-all"
                title="编辑信息"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryView;
