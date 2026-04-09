import React, { useState, useEffect } from 'react';
import { X, Save, Tag as TagIcon, Star, Eye, BookOpen, Hash, Calendar, Plus, Trash2 } from 'lucide-react';
import { useCategoryStore } from '../../stores/category';
import { useWorkspaceStore } from '../../stores/workspace';
import type { Paper, Tag, ReadStatus, Rating } from '../../../shared/types/category';
import { ReadStatusConfig } from '../../../shared/types/category';

const TAG_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

interface PaperEditorProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
}

const PaperEditor: React.FC<PaperEditorProps> = ({ paper, isOpen, onClose }) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { tags, loadTags, updatePaper, addTag, deleteTag } = useCategoryStore();

  // 只保留分类相关字段
  const [publishYear, setPublishYear] = useState<number | undefined>(undefined);
  const [journal, setJournal] = useState('');
  const [readStatus, setReadStatus] = useState<ReadStatus>('unread');
  const [rating, setRating] = useState<Rating | undefined>(undefined);
  const [selectedTopicTags, setSelectedTopicTags] = useState<string[]>([]);
  const [selectedKeywordTags, setSelectedKeywordTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 新建标签状态
  const [newTopicTag, setNewTopicTag] = useState('');
  const [newKeywordTag, setNewKeywordTag] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);

  useEffect(() => {
    if (paper) {
      setPublishYear(paper.publishYear);
      setJournal(paper.journal || '');
      setReadStatus(paper.readStatus || 'unread');
      setRating(paper.rating);
      // 安全检查：确保 tags 是数组
      const safeTags = Array.isArray(tags) ? tags : [];
      setSelectedTopicTags((paper.tags || []).filter((tagId) =>
        safeTags.find((t) => t?.id === tagId)?.type === 'topic'
      ));
      setSelectedKeywordTags((paper.tags || []).filter((tagId) =>
        safeTags.find((t) => t?.id === tagId)?.type === 'keyword'
      ));
    }
  }, [paper, tags]);

  useEffect(() => {
    if (currentWorkspace && isOpen) {
      loadTags(currentWorkspace.path);
    }
  }, [currentWorkspace, isOpen, loadTags]);

  if (!isOpen || !paper) return null;

  const handleSave = async () => {
    if (!currentWorkspace || !paper) return;

    setIsSaving(true);
    try {
      // 合并所有标签
      const allTags = [...selectedTopicTags, ...selectedKeywordTags];

      await updatePaper(currentWorkspace.path, paper.id, {
        publishYear,
        journal: journal || undefined,
        readStatus,
        rating,
        tags: allTags,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save paper:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTopicTag = (tagId: string) => {
    setSelectedTopicTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleKeywordTag = (tagId: string) => {
    setSelectedKeywordTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const topicTags = tags.filter((t: Tag) => t.type === 'topic');
  const keywordTags = tags.filter((t: Tag) => t.type === 'keyword');

  // 创建新主题标签
  const handleAddTopicTag = async () => {
    if (!currentWorkspace || !newTopicTag.trim()) return;
    setIsAddingTopic(true);
    try {
      await addTag(currentWorkspace.path, {
        name: newTopicTag.trim(),
        type: 'topic',
        color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
      });
      // 添加后重新加载标签，useEffect 会自动更新选中状态
      await loadTags(currentWorkspace.path);
      setNewTopicTag('');
    } catch (error) {
      console.error('Failed to add topic tag:', error);
    } finally {
      setIsAddingTopic(false);
    }
  };

  // 创建新关键词标签
  const handleAddKeywordTag = async () => {
    if (!currentWorkspace || !newKeywordTag.trim()) return;
    setIsAddingKeyword(true);
    try {
      await addTag(currentWorkspace.path, {
        name: newKeywordTag.trim(),
        type: 'keyword',
        color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
      });
      // 添加后重新加载标签，useEffect 会自动更新选中状态
      await loadTags(currentWorkspace.path);
      setNewKeywordTag('');
    } catch (error) {
      console.error('Failed to add keyword tag:', error);
    } finally {
      setIsAddingKeyword(false);
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!currentWorkspace) return;
    if (confirm(`确定要删除标签 "${tagName}" 吗？\n\n注意：这将会从所有论文中移除该标签。`)) {
      try {
        await deleteTag(currentWorkspace.path, tagId);
        // 从当前选中列表中移除
        setSelectedTopicTags((prev) => prev.filter((id) => id !== tagId));
        setSelectedKeywordTags((prev) => prev.filter((id) => id !== tagId));
        await loadTags(currentWorkspace.path);
      } catch (error) {
        console.error('Failed to delete tag:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              编辑分类
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[300px]">
              {paper.fileName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-5">
          {/* 年份和期刊 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                发表年份
              </label>
              <input
                type="number"
                value={publishYear || ''}
                onChange={(e) => setPublishYear(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="2024"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                期刊/会议
              </label>
              <input
                type="text"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="例如: CVPR, ICML"
              />
            </div>
          </div>

          {/* 阅读状态 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Eye className="w-4 h-4" />
              阅读状态
            </label>
            <div className="flex flex-wrap gap-2">
              {(['unread', 'reading', 'read', 'deep_read'] as ReadStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setReadStatus(status)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    readStatus === status
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: ReadStatusConfig[status].color }}
                    />
                    {ReadStatusConfig[status].label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 重要性评分 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Star className="w-4 h-4" />
              重要性
            </label>
            <div className="flex gap-1 items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star as Rating)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      (rating || 0) >= star
                        ? 'text-yellow-500 fill-current'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                </button>
              ))}
              {rating && rating > 0 && (
                <button
                  onClick={() => setRating(undefined)}
                  className="ml-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* 主题标签 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <TagIcon className="w-4 h-4" />
              主题
            </label>
            {/* 现有主题标签 */}
            {topicTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {topicTags.map((tag: Tag) => (
                  <div
                    key={tag.id}
                    className={`group flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTopicTags.includes(tag.id)
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <button
                      onClick={() => toggleTopicTag(tag.id)}
                      className="flex-1"
                    >
                      {tag.name}
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id, tag.name)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-all"
                      title="删除标签"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* 添加新主题标签 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopicTag}
                onChange={(e) => setNewTopicTag(e.target.value)}
                placeholder="输入新主题"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTopicTag()}
              />
              <button
                onClick={handleAddTopicTag}
                disabled={!newTopicTag.trim() || isAddingTopic}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
          </div>

          {/* 关键词标签 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Hash className="w-4 h-4" />
              关键词
            </label>
            {/* 现有关键词标签 */}
            {keywordTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {keywordTags.map((tag: Tag) => (
                  <div
                    key={tag.id}
                    className={`group flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedKeywordTags.includes(tag.id)
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <button
                      onClick={() => toggleKeywordTag(tag.id)}
                      className="flex-1"
                    >
                      {tag.name}
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id, tag.name)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-all"
                      title="删除标签"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* 添加新关键词标签 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeywordTag}
                onChange={(e) => setNewKeywordTag(e.target.value)}
                placeholder="输入新关键词"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeywordTag()}
              />
              <button
                onClick={handleAddKeywordTag}
                disabled={!newKeywordTag.trim() || isAddingKeyword}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaperEditor;
