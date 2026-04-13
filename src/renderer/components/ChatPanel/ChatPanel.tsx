import React, { useState, useEffect, useRef } from 'react';
import { useConversationStore } from '../../stores/conversation';
import { useWorkspaceStore } from '../../stores/workspace';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { MessageSquarePlus, Settings, ArrowLeft, Camera } from 'lucide-react';
import AISettings from '../AISettings/AISettings';
import ScreenshotCapture from '../ScreenshotCapture/ScreenshotCapture';

const ChatPanel: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const {
    conversations, activeConversationId, messages,
    isStreaming, streamingContent, error, prefillText,
    loadConversations, createConversation, setActiveConversation,
    sendMessage, stopStreaming, clearError, setPrefillText,
  } = useConversationStore();

  const [showConvList, setShowConvList] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [screenshotPrompt, setScreenshotPrompt] = useState<string>('');
  const workspacePath = currentWorkspace?.path || '';

  const activeConv = conversations.find(c => c.id === activeConversationId);

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

  const handleSend = async (content: string, imageData?: string) => {
    if (!workspacePath) return;
    // Auto-create conversation if none active
    if (!activeConversationId) {
      await createConversation(workspacePath, {
        topic: content.slice(0, 30) + (content.length > 30 ? '...' : '截图翻译/分析'),
      });
    }
    await sendMessage(workspacePath, content, imageData ? { imageData } : undefined);
    setPendingImage(null);
    setScreenshotPrompt(''); // Clear screenshot prompt after sending
    setPrefillText(null); // Clear prefill text after sending
  };

  const handleScreenshotCapture = (imageData: string, defaultPrompt?: string) => {
    setIsCapturing(false);
    setPendingImage(imageData);
    // If default prompt provided, set it as input text
    if (defaultPrompt) {
      // We'll pass this to ChatInput via a ref or state
      // For now, let's use a different approach - set it in a state that ChatInput can read
      setScreenshotPrompt(defaultPrompt);
    }
  };

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
          <button onClick={() => setIsCapturing(true)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="截图">
            <Camera className="w-4 h-4 text-gray-500" />
          </button>
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
              key={screenshotPrompt + (prefillText || '')} // Force remount when prompt changes
              onSend={handleSend}
              isStreaming={isStreaming}
              onStop={stopStreaming}
              pendingImage={pendingImage}
              onClearImage={() => setPendingImage(null)}
              initialText={screenshotPrompt || prefillText || ''}
            />
          </>
        )}
      </div>

      <AISettings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <ScreenshotCapture
        isActive={isCapturing}
        onCapture={handleScreenshotCapture}
        onCancel={() => setIsCapturing(false)}
      />
    </div>
  );
};

export default ChatPanel;
