import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

function getPythonBaseDir(): string {
  // Store in userData so it's writable and persistent across updates
  return path.join(app.getPath('userData'), 'bundled-python');
}

function getBundledPythonResourceDir(): string {
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    // In packaged app: macOS -> Contents/Resources, Windows -> resources
    if (process.platform === 'win32') {
      return path.join(process.resourcesPath, 'python-win');
    }
    return path.join(process.resourcesPath, 'python-mac');
  }
  // In dev: project-root/resources/
  if (process.platform === 'win32') {
    return path.join(__dirname, '../../../resources/python-win');
  }
  return path.join(__dirname, '../../../resources/python-mac');
}

function getWindowsWheelsResourceDir(): string {
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    return path.join(process.resourcesPath, 'python-win-wheels');
  }
  return path.join(__dirname, '../../../resources/python-win-wheels');
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function installBundledPython(): Promise<void> {
  const baseDir = getPythonBaseDir();
  const pythonPath = getBundledPythonPath();
  if (fs.existsSync(pythonPath)) {
    console.log('[PythonManager] Python already installed at:', pythonPath);
    return;
  }

  const resourceDir = getBundledPythonResourceDir();
  console.log('[PythonManager] Looking for Python resources at:', resourceDir);
  
  if (!fs.existsSync(resourceDir)) {
    throw new Error(`Bundled Python resource directory not found: ${resourceDir}`);
  }

  console.log('[PythonManager] Copying bundled Python from', resourceDir, 'to', baseDir);
  copyDirSync(resourceDir, baseDir);
  console.log('[PythonManager] Python copied successfully');

  // On Windows, install dependencies from offline wheels
  if (process.platform === 'win32') {
    const wheelsDir = getWindowsWheelsResourceDir();
    if (fs.existsSync(wheelsDir)) {
      console.log('[PythonManager] Installing Windows Python dependencies from', wheelsDir);
      try {
        // First, try to install all wheels directly
        const wheelFiles = fs.readdirSync(wheelsDir).filter(f => f.endsWith('.whl'));
        const wheelPaths = wheelFiles.map(f => path.join(wheelsDir, f));
        
        if (wheelPaths.length > 0) {
          console.log('[PythonManager] Installing wheels:', wheelFiles.join(', '));
          await execPromise(
            `"${pythonPath}" -m pip install --no-index ${wheelPaths.map(w => `"${w}"`).join(' ')}`,
            { timeout: 120000 }
          );
        }
        
        console.log('[PythonManager] Windows dependencies installed.');
      } catch (err: any) {
        console.error('[PythonManager] Failed to install Windows dependencies:', err);
        console.error('[PythonManager] Error details:', err.stderr || err.message);
        // Don't throw here; some packages may be optional
      }
    }
  } else {
    // macOS: dependencies were pre-installed before packaging
    console.log('[PythonManager] macOS Python ready (dependencies pre-installed).');
  }
}

export async function ensureBundledPythonPath(): Promise<string> {
  const pythonPath = getBundledPythonPath();
  if (fs.existsSync(pythonPath)) {
    return pythonPath;
  }
  await installBundledPython();
  return pythonPath;
}

/**
 * Returns the path to the bundled Python interpreter.
 * Note: ensureBundledPythonPath() should be called before using it.
 */
export function getBundledPythonPath(): string {
  const baseDir = getPythonBaseDir();
  if (process.platform === 'win32') {
    return path.join(baseDir, 'python.exe');
  }
  return path.join(baseDir, 'bin', 'python3');
}

/**
 * Resolves a command string, replacing 'python3' or 'python' calls with the bundled
 * interpreter when appropriate.
 */
export function resolvePythonCommand(command: string): string {
  const trimmed = command.trim();
  const pythonPath = getBundledPythonPath();

  if (trimmed.startsWith('python3 ')) {
    return trimmed.replace(/^python3\s+/, `"${pythonPath}" `);
  }
  if (trimmed.startsWith('python ')) {
    return trimmed.replace(/^python\s+/, `"${pythonPath}" `);
  }
  if (trimmed.includes('"python3" ') || trimmed.includes("'python3' ")) {
    return trimmed.replace(/(["'])python3(["'])\s+/, `$1${pythonPath}$2 `);
  }

  return command;
}
