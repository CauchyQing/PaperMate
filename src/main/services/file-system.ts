import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileNode, PDFFile } from '../../shared/types/file';

/**
 * Scan a directory and return its structure
 */
export async function scanDirectory(
  dirPath: string,
  workspaceRoot: string
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Sort: directories first, then files (alphabetically)
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sortedEntries) {
      // Skip hidden files and directories
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(workspaceRoot, fullPath);

      const node: FileNode = {
        id: relativePath,
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        isExpanded: false,
      };

      // For PDF files, we don't need children
      if (!entry.isDirectory()) {
        // Only include PDF files in the tree
        if (!entry.name.toLowerCase().endsWith('.pdf')) {
          continue;
        }
      } else {
        // For directories, we could recursively scan, but we'll do it on demand
        node.children = [];
      }

      nodes.push(node);
    }
  } catch (error) {
    console.error('Error scanning directory:', error);
  }

  return nodes;
}

/**
 * Expand a directory node and load its children
 */
export async function expandDirectory(
  node: FileNode,
  workspaceRoot: string
): Promise<FileNode[]> {
  if (node.type !== 'directory') {
    return [];
  }

  return scanDirectory(node.path, workspaceRoot);
}

/**
 * Get all PDF files in a directory (recursively)
 */
export async function getAllPDFFiles(
  dirPath: string,
  workspaceRoot: string
): Promise<PDFFile[]> {
  const pdfs: PDFFile[] = [];

  async function scan(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories and .papermate
          if (entry.name.startsWith('.') && entry.name !== '.papermate') {
            continue;
          }
          await scan(fullPath);
        } else if (entry.name.toLowerCase().endsWith('.pdf')) {
          const stats = await fs.stat(fullPath);
          pdfs.push({
            id: path.relative(workspaceRoot, fullPath),
            name: entry.name,
            path: fullPath,
            relativePath: path.relative(workspaceRoot, fullPath),
            size: stats.size,
            lastModified: stats.mtimeMs,
          });
        }
      }
    } catch (error) {
      console.error('Error scanning for PDFs:', error);
    }
  }

  await scan(dirPath);
  return pdfs.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Import a PDF file to the workspace
 */
export async function importPDFFile(
  sourcePath: string,
  targetDir: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // Check if source is a PDF
    if (!sourcePath.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: 'Not a PDF file' };
    }

    // Check if source exists
    const exists = await fileExists(sourcePath);
    if (!exists) {
      return { success: false, error: 'Source file does not exist' };
    }

    // Create target directory if it doesn't exist
    await fs.mkdir(targetDir, { recursive: true });

    // Generate target path
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetDir, fileName);

    // Copy file
    await fs.copyFile(sourcePath, targetPath);

    return { success: true, path: targetPath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get file stats
 */
export async function getFileStats(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      lastModified: stats.mtimeMs,
      created: stats.birthtimeMs,
    };
  } catch {
    return null;
  }
}
