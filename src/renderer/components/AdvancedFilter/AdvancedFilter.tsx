import React, { useState, useMemo } from 'react';
import { Filter, X, Search, FileText } from 'lucide-react';
import { useCategoryStore } from '../../stores/category';
import { useWorkspaceStore } from '../../stores/workspace';
import { useFileStore } from '../../stores/file';
import type { Paper, Tag } from '../../../shared/types/category';

interface FilterCondition {
  type: 'year' | 'journal' | 'topic' | 'keyword' | 'readStatus' | 'rating';
  value: string | number;
  label: string;
}

const AdvancedFilter: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const { papers, tags, loadPapers } = useCategoryStore();
  const { openFile } = useFileStore();

  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [showSelector, setShowSelector] = useState(false);

  // 获取所有可用的筛选值
  const availableFilters = useMemo(() => {
    const filters = {
      year: new Set<number>(),
      journal: new Set<string>(),
      topic: new Set<Tag>(),
      keyword: new Set<Tag>(),
      readStatus: new Set<string>(),
      rating: new Set<number>(),
    };

    papers.forEach((paper) => {
      if (paper.publishYear) filters.year.add(paper.publishYear);
      if (paper.journal) filters.journal.add(paper.journal);
      if (paper.rating) filters.rating.add(paper.rating);
      if (paper.readStatus) filters.readStatus.add(paper.readStatus);

      paper.tags.forEach((tagId) => {
        const tag = tags.find((t) => t.id === tagId);
        if (tag) {
          if (tag.type === 'topic') filters.topic.add(tag);
          if (tag.type === 'keyword') filters.keyword.add(tag);
        }
      });
    });

    return {
      year: Array.from(filters.year).sort((a, b) => b - a),
      journal: Array.from(filters.journal).sort(),
      topic: Array.from(filters.topic),
      keyword: Array.from(filters.keyword),
      readStatus: [
        { value: 'unread', label: '未读' },
        { value: 'reading', label: '阅读中' },
        { value: 'read', label: '已读' },
        { value: 'deep_read', label: '精读' },
      ],
      rating: [5, 4, 3, 2, 1],
    };
  }, [papers, tags]);

  // 根据条件筛选论文
  const filteredPapers = useMemo(() => {
    if (conditions.length === 0) return [];

    return papers.filter((paper) => {
      return conditions.every((condition) => {
        switch (condition.type) {
          case 'year':
            return paper.publishYear === condition.value;
          case 'journal':
            return paper.journal === condition.value;
          case 'topic':
          case 'keyword':
            return paper.tags.includes(condition.value as string);
          case 'readStatus':
            return paper.readStatus === condition.value;
          case 'rating':
            return paper.rating === condition.value;
          default:
            return true;
        }
      });
    });
  }, [papers, conditions]);

  const addCondition = (type: FilterCondition['type'], value: string | number, label: string) => {
    // 检查是否已存在相同条件
    const exists = conditions.some((c) => c.type === type && c.value === value);
    if (exists) return;

    setConditions([...conditions, { type, value, label }]);
    setShowSelector(false);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const clearAllConditions = () => {
    setConditions([]);
  };

  const handlePaperClick = (paper: Paper) => {
    const pdfFile = {
      id: paper.filePath,
      name: paper.fileName,
      path: paper.filePath,
      relativePath: paper.filePath,
      size: 0,
      lastModified: paper.importedAt,
    };
    openFile(pdfFile);
  };

  const getConditionLabel = (condition: FilterCondition) => {
    const typeLabels: Record<string, string> = {
      year: '年份',
      journal: '期刊',
      topic: '主题',
      keyword: '关键词',
      readStatus: '阅读状态',
      rating: '重要性',
    };
    return `${typeLabels[condition.type]}: ${condition.label}`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            高级筛选
          </h2>
        </div>

        {/* 已选条件 */}
        <div className="space-y-2">
          {conditions.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              点击下方按钮添加筛选条件
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {conditions.map((condition, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full"
                >
                  {getConditionLabel(condition)}
                  <button
                    onClick={() => removeCondition(index)}
                    className="hover:text-primary-900 dark:hover:text-primary-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {conditions.length > 0 && (
                <button
                  onClick={clearAllConditions}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 underline"
                >
                  清除全部
                </button>
              )}
            </div>
          )}

          {/* 添加条件按钮 */}
          <button
            onClick={() => setShowSelector(!showSelector)}
            className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            添加筛选条件
          </button>
        </div>
      </div>

      {/* 条件选择器 */}
      {showSelector && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700/50 max-h-60 overflow-y-auto">
          <div className="space-y-3">
            {/* 年份 */}
            {availableFilters.year.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">年份</h3>
                <div className="flex flex-wrap gap-1">
                  {availableFilters.year.map((year) => (
                    <button
                      key={year}
                      onClick={() => addCondition('year', year, String(year))}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 期刊 */}
            {availableFilters.journal.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">期刊/会议</h3>
                <div className="flex flex-wrap gap-1">
                  {availableFilters.journal.map((journal) => (
                    <button
                      key={journal}
                      onClick={() => addCondition('journal', journal, journal)}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {journal}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 主题 */}
            {availableFilters.topic.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">主题</h3>
                <div className="flex flex-wrap gap-1">
                  {availableFilters.topic.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => addCondition('topic', tag.id, tag.name)}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 关键词 */}
            {availableFilters.keyword.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">关键词</h3>
                <div className="flex flex-wrap gap-1">
                  {availableFilters.keyword.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => addCondition('keyword', tag.id, tag.name)}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 阅读状态 */}
            <div>
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">阅读状态</h3>
              <div className="flex flex-wrap gap-1">
                {availableFilters.readStatus.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => addCondition('readStatus', status.value, status.label)}
                    className="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 重要性 */}
            {availableFilters.rating.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">重要性</h3>
                <div className="flex flex-wrap gap-1">
                  {availableFilters.rating.map((rating) => (
                    <button
                      key={rating}
                      onClick={() => addCondition('rating', rating, '⭐'.repeat(rating))}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {'⭐'.repeat(rating)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 结果列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {conditions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>添加筛选条件查看结果</p>
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            <p>没有找到符合条件的论文</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                找到 {filteredPapers.length} 篇论文
              </span>
            </div>
            <div className="space-y-1">
              {filteredPapers.map((paper) => (
                <button
                  key={paper.id}
                  onClick={() => handlePaperClick(paper)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {paper.title || paper.fileName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {paper.journal && `${paper.journal} · `}
                      {paper.publishYear && `${paper.publishYear} · `}
                      {paper.rating && '⭐'.repeat(paper.rating)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedFilter;
