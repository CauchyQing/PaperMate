import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Check, Plus, Tag, BookOpen, Hash, Calendar } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace';
import { useCategoryStore } from '../../stores/category';
import type { Paper, Tag as TagType } from '../../../shared/types';
import type { PaperAnalysis } from '../../../shared/types/ai';

interface PaperAnalyzerProps {
  paper: Paper;
  isOpen: boolean;
  onClose: () => void;
  onApplyTags?: (tags: string[], type: 'topic' | 'keyword') => void;
}

const PaperAnalyzer: React.FC<PaperAnalyzerProps> = ({
  paper, isOpen, onClose, onApplyTags,
}) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { tags, loadTags, addTag } = useCategoryStore();
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [appliedTags, setAppliedTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && currentWorkspace) {
      loadTags(currentWorkspace.path);
    }
  }, [isOpen, currentWorkspace, loadTags]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!currentWorkspace) return;
    setIsAnalyzing(true);
    setError('');
    try {
      const result = await window.electronAPI.paperAnalyze(paper, tags);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || '分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddTag = async (tagName: string, type: 'topic' | 'keyword') => {
    if (!currentWorkspace || appliedTags.has(tagName)) return;

    // Check if tag already exists
    const existing = tags.find(t => t.name === tagName && t.type === type);
    if (!existing) {
      await addTag(currentWorkspace.path, { name: tagName, type });
    }

    setAppliedTags(prev => new Set(prev).add(tagName));
    onApplyTags?.([tagName], type);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-500" />
            AI 智能分析
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!analysis && !isAnalyzing && (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                让 AI 分析这篇论文
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                自动提取主题、关键词和核心观点
              </p>
              <button
                onClick={handleAnalyze}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                开始分析
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">正在分析论文内容...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4">
              {error}
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">摘要</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{analysis.summary}</p>
              </div>

              {/* Title suggestion */}
              {analysis.suggestedTitle && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    中文标题
                  </h3>
                  <p className="text-sm text-gray-900 dark:text-white">{analysis.suggestedTitle}</p>
                </div>
              )}

              {/* Journal & Year */}
              {(analysis.suggestedJournal || analysis.suggestedYear) && (
                <div className="flex items-center gap-4 text-sm">
                  {analysis.suggestedJournal && (
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <BookOpen className="w-4 h-4" />
                      {analysis.suggestedJournal}
                    </div>
                  )}
                  {analysis.suggestedYear && (
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      {analysis.suggestedYear}
                    </div>
                  )}
                </div>
              )}

              {/* Topics */}
              {analysis.suggestedTopics.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    建议主题标签
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.suggestedTopics.map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleAddTag(topic, 'topic')}
                        disabled={appliedTags.has(topic)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                          appliedTags.has(topic)
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200'
                        }`}
                      >
                        {appliedTags.has(topic) && <Check className="w-3.5 h-3.5" />}
                        {topic}
                        {!appliedTags.has(topic) && <Plus className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {analysis.suggestedKeywords.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <Hash className="w-4 h-4" />
                    建议关键词
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.suggestedKeywords.map(keyword => (
                      <button
                        key={keyword}
                        onClick={() => handleAddTag(keyword, 'keyword')}
                        disabled={appliedTags.has(keyword)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                          appliedTags.has(keyword)
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {appliedTags.has(keyword) && <Check className="w-3.5 h-3.5" />}
                        {keyword}
                        {!appliedTags.has(keyword) && <Plus className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {analysis && (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="px-4 py-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              重新分析
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaperAnalyzer;
