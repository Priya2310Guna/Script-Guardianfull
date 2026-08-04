import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/** Browser-side script text extraction for TXT / MD / Fountain, with a
 *  best-effort raw text pass for DOCX uploads, and proper PDF parsing. */

async function bestEffortBinaryText(file: File) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let out = "";
  let run = "";
  for (const byte of buf) {
    if (byte === 10 || byte === 13 || (byte >= 32 && byte < 127)) run += String.fromCharCode(byte);
    else {
      if (run.length > 4) out += run + "\n";
      run = "";
    }
  }
  if (run.length > 4) out += run;
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

async function extractPdfText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    text += strings.join(' ') + '\n';
  }
  return text.trim();
}

export async function readScriptFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (/\.(txt|md|fountain|fdx|rtf)$/.test(name) || file.type.startsWith("text/")) {
    return (await file.text()).trim();
  }
  if (/\.(pdf)$/.test(name)) {
    try {
      const text = await extractPdfText(file);
      if (text.split(/\s+/).length < 80) {
        throw new Error("This PDF is too short or doesn't contain text data (it might be an image-only PDF).");
      }
      return text;
    } catch (err: any) {
      throw new Error(`Failed to read PDF: ${err.message || 'Unknown error'}`);
    }
  }
  if (/\.(docx|doc)$/.test(name)) {
    const text = await bestEffortBinaryText(file);
    if (text.split(/\s+/).length < 80)
      throw new Error(
        "This DOCX is compressed and can't be read in the browser — paste the script text instead.",
      );
    return text;
  }
  throw new Error("Unsupported file type. Use TXT, MD, Fountain, PDF or DOCX.");
}
