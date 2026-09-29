// PDF text extraction in the browser (technical plan §1). pdf.js is loaded only
// when A3a needs it. Only the extracted text is sent to the server; the file is
// never uploaded or stored.
export { MAX_PDF_BYTES } from "../../shared/limits";

export async function extractPdfText(file: File): Promise<string> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        if (item.hasEOL) text += "\n";
      }
      pages.push(text.trim());
    }
  } finally {
    await task.destroy();
  }
  // Blank line between pages so they read as separate paragraphs.
  return pages.filter(Boolean).join("\n\n");
}
