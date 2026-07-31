/** Browser-side script text extraction for TXT / MD / Fountain, with a
 *  best-effort raw text pass for PDF and DOCX uploads. */

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

export async function readScriptFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (/\.(txt|md|fountain|fdx|rtf)$/.test(name) || file.type.startsWith("text/")) {
    return (await file.text()).trim();
  }
  if (/\.(pdf|docx|doc)$/.test(name)) {
    const text = await bestEffortBinaryText(file);
    if (text.split(/\s+/).length < 80)
      throw new Error(
        "This PDF/DOCX is compressed and can't be read in the browser — paste the script text instead.",
      );
    return text;
  }
  throw new Error("Unsupported file type. Use TXT, MD, Fountain, PDF or DOCX.");
}
