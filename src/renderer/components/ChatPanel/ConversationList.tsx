import React, { useState } from 'react';
import { Trash2, MessageSquare, Edit2, Check, X } from 'lucide-react';
import { useConversationStore } from '../../stores/conversation';
import type { Conversation } from '../../../shared/types';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  workspacePath: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations, activeId, workspacePath, onSelect, onNew,
}) => {
  const { deleteConversation, updateConversationTitle } = useConversationStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartEdit = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.topic);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId && editTitle.trim()) {
      await updateConversationTitle(workspacePath, editingId, editTitle.trim());
      setEditingId(null);
      setEditTitle('');
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };


  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定删除这个对话？')) {
      await deleteConversation(workspacePath, id);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">还没有对话</p>
        <button onClick={onNew}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors">
          开始新对话
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map(conv => (
        <div key={conv.id} onClick={() => onSelect(conv.id)}
          className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-colors ${
            activeId === conv.id
              ? 'bg-primary-50 dark:bg-primary-900/20'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}>
          <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {editingId === conv.id ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(e as unknown as React.MouseEvent);
                    if (e.key === 'Escape') handleCancelEdit(e as unknown as React.MouseEvent);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-sm px-2 py-1 border border-primary-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600"
                  title="保存"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-900 dark:text-white truncate">{conv.topic}</div>
            )}
            {editingId !== conv.id && (
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span>{formatTime(conv.updatedAt)}</span>
                <span>{conv.messageCount} 条消息</span>
              </div>
            )}
          </div>
          {editingId !== conv.id && (
            <>
              <button onClick={(e) => handleStartEdit(e, conv)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                title="修改标题"
              >
                <Edit2 className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button onClick={(e) => handleDelete(e, conv.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default ConversationList;
