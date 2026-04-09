import React, { useState, useEffect } from 'react';
import { X, Save, Tag as TagIcon, Star, Archive } from 'lucide-react';
import { useCategoryStore } from '../../stores/category';
import { useWorkspaceStore } from '../../stores/workspace';
import type { Paper, Tag } from '../../../shared/types/category';

interface PaperEditorProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
}

const PaperEditor: React.FC<PaperEditorProps> = ({ paper, isOpen, onClose }) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { tags, loadTags, updatePaper, assignTagToPaper, removeTagFromPaper } = useCategoryStore();

  const [formData, setFormData] = useState<Partial<Paper>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (paper) {
      setFormData({
        title: paper.title,
        authors: paper.authors,
        publishYear: paper.publishYear,
        journal: paper.journal,
        doi: paper.doi,
        url: paper.url,
        abstract: paper.abstract,
        isFavorite: paper.isFavorite,
        isArchived: paper.isArchived,
      });
    }
  }, [paper]);

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
      await updatePaper(currentWorkspace.path, paper.id, formData);
      onClose();
    } catch (error) {
      console.error('Failed to save paper:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagToggle = async (tagId: string) => {
    if (!currentWorkspace || !paper) return;

    if (paper.tags.includes(tagId)) {
      await removeTagFromPaper(currentWorkspace.path, paper.id, tagId);
    } else {
      await assignTagToPaper(currentWorkspace.path, paper.id, tagId);
    }
  };

  const handleFavoriteToggle = () => {
    setFormData(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
  };

  const handleArchiveToggle = () => {
    setFormData(prev => ({ ...prev, isArchived: !prev.isArchived }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            编辑论文信息
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              标题
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="输入论文标题"
            />
          </div>

          {/* Authors */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              作者（用逗号分隔）
            </label>
            <input
              type="text"
              value={formData.authors?.join(', ') || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                authors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="作者1, 作者2, 作者3"
            />
          </div>

          {/* Year and Journal */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                发表年份
              </label>
              <input
                type="number"
                value={formData.publishYear || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  publishYear: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="2024"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                期刊/会议
              </label>
              <input
                type="text"
                value={formData.journal || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, journal: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="期刊或会议名称"
              />
            </div>
          </div>

          {/* DOI and URL */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              DOI
            </label>
            <input
              type="text"
              value={formData.doi || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, doi: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="10.xxxx/xxxxx"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL
            </label>
            <input
              type="text"
              value={formData.url || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>

          {/* Abstract */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              摘要
            </label>
            <textarea
              value={formData.abstract || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, abstract: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="论文摘要..."
            />
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <TagIcon className="w-4 h-4" />
              标签
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: Tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    paper.tags.includes(tag.id)
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-gray-400">暂无标签</span>
              )}
            </div>
          </div>

          {/* Status Toggles */}
          <div className="flex gap-4">
            <button
              onClick={handleFavoriteToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                formData.isFavorite
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 text-yellow-700 dark:text-yellow-300'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Star className={`w-4 h-4 ${formData.isFavorite ? 'fill-current' : ''}`} />
              {formData.isFavorite ? '已收藏' : '收藏'}
            </button>
            <button
              onClick={handleArchiveToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                formData.isArchived
                  ? 'bg-gray-200 dark:bg-gray-600 border-gray-400 text-gray-700 dark:text-gray-300'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Archive className="w-4 h-4" />
              {formData.isArchived ? '已归档' : '归档'}
            </button>
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
