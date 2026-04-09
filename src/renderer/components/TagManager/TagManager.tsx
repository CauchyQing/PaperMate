import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag as TagIcon, Hash, BookOpen } from 'lucide-react';
import { useCategoryStore } from '../../stores/category';
import { useWorkspaceStore } from '../../stores/workspace';
import type { Tag } from '../../../shared/types/category';

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

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

const TagManager: React.FC<TagManagerProps> = ({ isOpen, onClose }) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { tags, loadTags, addTag, deleteTag } = useCategoryStore();

  const [newTagName, setNewTagName] = useState('');
  const [newTagType, setNewTagType] = useState<'topic' | 'keyword'>('topic');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (currentWorkspace && isOpen) {
      loadTags(currentWorkspace.path);
    }
  }, [currentWorkspace, isOpen, loadTags]);

  if (!isOpen) return null;

  const handleAddTag = async () => {
    if (!currentWorkspace || !newTagName.trim()) return;

    setIsAdding(true);
    try {
      await addTag(currentWorkspace.path, {
        name: newTagName.trim(),
        type: newTagType,
        color: selectedColor,
      });
      setNewTagName('');
    } catch (error) {
      console.error('Failed to add tag:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!currentWorkspace) return;

    if (confirm('确定要删除这个标签吗？相关的论文将不再拥有此标签。')) {
      try {
        await deleteTag(currentWorkspace.path, tagId);
      } catch (error) {
        console.error('Failed to delete tag:', error);
      }
    }
  };

  const topicTags = tags.filter((t: Tag) => t.type === 'topic');
  const keywordTags = tags.filter((t: Tag) => t.type === 'keyword');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TagIcon className="w-5 h-5" />
            标签管理
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Add New Tag */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              添加新标签
            </h3>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setNewTagType('topic')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                  newTagType === 'topic'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                主题
              </button>
              <button
                onClick={() => setNewTagType('keyword')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                  newTagType === 'keyword'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                关键词
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="输入标签名称"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <button
                onClick={handleAddTag}
                disabled={!newTagName.trim() || isAdding}
                className="flex items-center gap-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>

            {/* Color Picker */}
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Existing Tags */}
          <div className="space-y-4">
            {/* Topic Tags */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                主题标签 ({topicTags.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {topicTags.map((tag: Tag) => (
                  <TagItem key={tag.id} tag={tag} onDelete={handleDeleteTag} />
                ))}
                {topicTags.length === 0 && (
                  <span className="text-sm text-gray-400">暂无主题标签</span>
                )}
              </div>
            </div>

            {/* Keyword Tags */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Hash className="w-4 h-4" />
                关键词标签 ({keywordTags.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {keywordTags.map((tag: Tag) => (
                  <TagItem key={tag.id} tag={tag} onDelete={handleDeleteTag} />
                ))}
                {keywordTags.length === 0 && (
                  <span className="text-sm text-gray-400">暂无关键词标签</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

interface TagItemProps {
  tag: Tag;
  onDelete: (tagId: string) => void;
}

const TagItem: React.FC<TagItemProps> = ({ tag, onDelete }) => (
  <div
    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm group"
    style={{
      backgroundColor: `${tag.color}20`,
      color: tag.color,
      border: `1px solid ${tag.color}40`,
    }}
  >
    <span>{tag.name}</span>
    <button
      onClick={() => onDelete(tag.id)}
      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded transition-all"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

export default TagManager;
