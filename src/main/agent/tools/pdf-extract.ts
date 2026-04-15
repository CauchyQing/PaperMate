import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerTool } from '../tool-registry';
import { ensureBundledPythonPath } from '../../utils/python';

const execPromise = promisify(exec);

const PYTHON_SCRIPT = `import sys

def extract_with_pymupdf(path, max_pages):
    import fitz
    doc = fitz.open(path)
    out = []
    for i in range(min(max_pages, len(doc))):
        out.append(f"--- Page {i+1} ---\\n{doc[i].get_text()}")
    return "\\n\\n".join(out)

def extract_with_pypdf(path, max_pages):
    from pypdf import PdfReader
    reader = PdfReader(path)
    out = []
    for i in range(min(max_pages, len(reader.pages))):
        out.append(f"--- Page {i+1} ---\\n{reader.pages[i].extract_text() or ''}")
    return "\\n\\n".join(out)

def extract_with_pdfplumber(path, max_pages):
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        out = []
        for i in range(min(max_pages, len(pdf.pages))):
            out.append(f"--- Page {i+1} ---\\n{pdf.pages[i].extract_text() or ''}")
        return "\\n\\n".join(out)

def extract(path, max_pages):
    try:
        return extract_with_pymupdf(path, max_pages)
    except Exception:
        pass
    try:
        return extract_with_pypdf(path, max_pages)
    except Exception:
        pass
    try:
        return extract_with_pdfplumber(path, max_pages)
    except Exception:
        pass
    raise RuntimeError("No suitable PDF library found.")

if __name__ == "__main__":
    print(extract(sys.argv[1], int(sys.argv[2])))
`;

async function extractWithBundledPython(filePath: string, maxPages: number): Promise<string | null> {
  const pythonPath = await ensureBundledPythonPath();
  console.log('[pdf_extract] Using Python at:', pythonPath);
  console.log('[pdf_extract] Extracting PDF:', filePath);
  
  const tmpFile = path.join(os.tmpdir(), `papermate_pdf_extract_${Date.now()}.py`);
  try {
    fs.writeFileSync(tmpFile, PYTHON_SCRIPT);
    const { stdout, stderr } = await execPromise(`"${pythonPath}" "${tmpFile}" "${filePath}" ${maxPages}`, { timeout: 15000 });
    if (stderr) {
      console.error('[pdf_extract] Python stderr:', stderr);
    }
    console.log('[pdf_extract] Extraction successful, output length:', stdout?.length || 0);
    return stdout.trim() || null;
  } catch (err: any) {
    console.error('[pdf_extract] Bundled Python extraction failed:', err.message || err);
    if (err.stderr) {
      console.error('[pdf_extract] stderr:', err.stderr);
    }
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

async function extractPdfText(filePath: string, maxPages = 20): Promise<string> {
  // 1. Primary: bundled Python with PyMuPDF (auto-downloaded on first use)
  const pythonResult = await extractWithBundledPython(filePath, maxPages);
  if (pythonResult && pythonResult.length > 200) {
    return pythonResult;
  }

  // 2. Fallback: external pdftotext
  try {
    const { stdout } = await execPromise(`pdftotext -f 1 -l ${maxPages} -layout "${filePath}" -`, { timeout: 8000 });
    const pdftotextResult = stdout.trim();
    if (pdftotextResult && pdftotextResult.length > 200) {
      return pdftotextResult;
    }
  } catch {
    // ignore
  }

  // 3. Return whichever non-empty result we have
  if (pythonResult) return pythonResult;

  throw new Error(
    '无法提取 PDF 文本。内置 Python 解析失败，且系统未安装 pdftotext。'
  );
}

registerTool(
  {
    name: 'pdf_extract',
    description: 'Extract text from a local PDF file. By default extracts up to 20 pages (enough for most academic papers). Uses the bundled Python runtime with PyMuPDF internally.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute path to the PDF' },
        maxPages: { type: 'number', description: 'Max pages to extract (default 20, usually sufficient for full academic papers)' },
      },
      required: ['filePath'],
    },
  },
  async (args) => {
    const text = await extractPdfText(String(args.filePath), Number(args.maxPages || 20));
    return text.slice(0, 20000);
  }
);
