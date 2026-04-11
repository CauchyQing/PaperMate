import React from 'react';
import { Trash2, MessageSquare } from 'lucide-react';
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
  const { deleteConversation } = useConversationStore();

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
            <div className="text-sm text-gray-900 dark:text-white truncate">{conv.topic}</div>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <span>{formatTime(conv.updatedAt)}</span>
              <span>{conv.messageCount} 条消息</span>
            </div>
          </div>
          <button onClick={(e) => handleDelete(e, conv.id)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ConversationList;
