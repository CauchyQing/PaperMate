import React, { useState, useEffect, useRef } from 'react';
import { useConversationStore } from '../../stores/conversation';
import { useWorkspaceStore } from '../../stores/workspace';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { MessageSquarePlus, Settings, ArrowLeft } from 'lucide-react';
import AISettings from '../AISettings/AISettings';

const ChatPanel: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const {
    conversations, activeConversationId, messages,
    isStreaming, streamingContent, error,
    loadConversations, createConversation, setActiveConversation,
    sendMessage, stopStreaming, clearError,
  } = useConversationStore();

  const [showConvList, setShowConvList] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const workspacePath = currentWorkspace?.path || '';

  useEffect(() => {
    if (workspacePath) {
      loadConversations(workspacePath);
    }
  }, [workspacePath, loadConversations]);

  const handleNewConversation = async () => {
    if (!workspacePath) return;
    await createConversation(workspacePath, { topic: '新对话' });
    setShowConvList(false);
  };

  const handleSelectConversation = async (id: string) => {
    await setActiveConversation(workspacePath, id);
    setShowConvList(false);
  };

  const handleSend = async (content: string) => {
    if (!workspacePath) return;
    // Auto-create conversation if none active
    if (!activeConversationId) {
      await createConversation(workspacePath, {
        topic: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
      });
    }
    await sendMessage(workspacePath, content);
  };

  const activeConv = conversations.find(c => c.id === activeConversationId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {!showConvList && activeConversationId && (
            <button onClick={() => setShowConvList(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {showConvList ? 'AI 助手' : (activeConv?.topic || 'AI 助手')}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleNewConversation}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="新对话">
            <MessageSquarePlus className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="AI 设置">
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {showConvList ? (
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            workspacePath={workspacePath}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
          />
        ) : (
          <>
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
            />
            {error && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
                <span className="truncate">{error}</span>
                <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0">✕</button>
              </div>
            )}
            <ChatInput
              onSend={handleSend}
              isStreaming={isStreaming}
              onStop={stopStreaming}
            />
          </>
        )}
      </div>

      <AISettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default ChatPanel;
