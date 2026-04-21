import React, { useEffect, useState } from 'react';
import Welcome from './pages/Welcome/Welcome';
import Workspace from './pages/Workspace/Workspace';
import { useWorkspaceStore } from './stores/workspace';

const App: React.FC = () => {
  const { currentWorkspace, loadLastWorkspace } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to load last workspace on startup
    loadLastWorkspace().finally(() => {
      setIsLoading(false);
    });
  }, [loadLastWorkspace]);

  // Global non-passive wheel listener to prevent browser-default zoom/scroll
  // on trackpad pinch gestures (ctrlKey wheel). This lives at the app root so
  // HMR inside PDFViewer cannot accidentally unregister it.
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handler, { passive: false });
    return () => window.removeEventListener('wheel', handler);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading PaperMate...</p>
        </div>
      </div>
    );
  }

  // Show workspace if one is open, otherwise show welcome page
  return currentWorkspace ? <Workspace /> : <Welcome />;
};

export default App;
