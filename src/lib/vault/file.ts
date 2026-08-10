import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Browser-side script text extraction for TXT / MD / Fountain, with a
 *  best-effort raw text pass for DOCX uploads, and proper PDF parsing. */

async function extractDocxText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

async function extractPdfText(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const pdf = await pdfjsLib.getDocument({ url: url }).promise;
    let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    text += strings.join(' ') + '\n';
  }

  // If very little text is extracted, it might be an image-based PDF. Fallback to OCR.
  if (text.trim().split(/\s+/).length < 20) {
    text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const { data: { text: pageText } } = await Tesseract.recognize(canvas, 'eng');
        text += pageText + '\n';
      }
    }
  }

  return text.trim();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readScriptFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (/\.(txt|md|fountain|fdx|rtf)$/.test(name) || file.type.startsWith("text/")) {
    return (await file.text()).trim();
  }
  if (/\.(pdf)$/.test(name)) {
    try {
      const text = await extractPdfText(file);
      if (text.split(/\s+/).length < 20) {
        throw new Error("This PDF is too short or doesn't contain text data.");
      }
      return text;
    } catch (err: any) {
      return `[DEBUG ERROR PDF]: ${err.message}\n${err.stack}`;
    }
  }
  if (/\.(docx|doc)$/.test(name)) {
    try {
      const text = await extractDocxText(file);
      if (text.split(/\s+/).length < 20) {
        throw new Error("This DOCX is too short or empty.");
      }
      return text;
    } catch (err: any) {
      throw new Error(`Failed to read DOCX: ${err.message || 'Unknown error'}`);
    }
  }
  
  // Image handling via Tesseract OCR
  if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|bmp|webp)$/.test(name)) {
    try {
      const url = URL.createObjectURL(file);
      const { data: { text } } = await Tesseract.recognize(url, 'eng');
      URL.revokeObjectURL(url);
      if (text.trim().split(/\s+/).length < 5) {
        throw new Error("Could not extract enough text from the image.");
      }
      return text.trim();
    } catch (err: any) {
      throw new Error(`Failed to OCR image: ${err.message || 'Unknown error'}`);
    }
  }

  // Fallback for any other file type (attempting to read as plain text)
  try {
    const text = await file.text();
    if (text.trim().length === 0) {
      throw new Error("File is empty.");
    }
    return text.trim();
  } catch (err: any) {
    throw new Error("Could not extract text from this file format.");
  }
}
