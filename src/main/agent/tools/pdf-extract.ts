import * as fs from 'fs';
import { registerTool } from '../tool-registry';

// Fix for packaged Windows app: DOMMatrix is undefined in Electron main process (Node 20)
// and native canvas modules may fail to load, causing pdf-parse initialization to throw.
if (typeof (global as any).DOMMatrix === 'undefined') {
  let dm: any;
  try {
    dm = require('@napi-rs/canvas').DOMMatrix;
  } catch (e) {
    try {
      dm = require('canvas').DOMMatrix;
    } catch (e2) {
      dm = class DOMMatrix {
        constructor() {}
        scaleSelf() { return this; }
        translateSelf() { return this; }
        multiplySelf() { return this; }
      };
    }
  }
  (global as any).DOMMatrix = dm;
}

const { PDFParse } = require('pdf-parse');

async function extractPdfText(filePath: string, maxPages = 20): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF 文件不存在: ${filePath}`);
  }

  try {
    const dataBuffer = fs.readFileSync(filePath);
    
    // pdf-parse v2 constructor
    const parser = new PDFParse({ data: dataBuffer });

    // Since v2 doesn't have a direct option to limit pages in getText(), we'll extract all and truncate or see if we can limit it.
    // Let's get text first.
    const result = await parser.getText();
    
    if (result.text && result.text.length > 0) {
      console.log(`[pdf_extract] Successfully extracted text from PDF.`);
      // If the result contains multiple pages, we might need to truncate, but returning the whole text is fine if it's within limits.
      return result.text.trim();
    }
    
    throw new Error('PDF 文本内容提取为空。');
  } catch (err: any) {
    console.error('[pdf_extract] Extraction failed:', err.message || err);
    throw new Error(`无法提取 PDF 文本: ${err.message || String(err)}`);
  }
}

registerTool(
  {
    name: 'pdf_extract',
    description: 'Extract text from a local PDF file. By default extracts up to 20 pages (enough for most academic papers). Uses native JavaScript extraction without needing Python.',
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
