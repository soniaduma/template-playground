/**
 * What the Deploy step's action cards do, kept out of the view so each can be
 * tested on its own: the agreement as a PDF or as plain text, and the template
 * as a .cta archive. The share link comes from the app store (generateShareableLink).
 */

/** The editors' content, as the app store holds it. */
export interface TemplateSources {
  /** Template name; becomes the archive's package name and file name. */
  name: string;
  templateMarkdown: string;
  modelCto: string;
  /** data.json text. */
  data: string;
  logicTs?: string;
}

/** "Residential Lease" → "residential-lease" */
const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "template";

export const templateArchiveName = (name: string) => `${slug(name)}.cta`;

/**
 * The template as a .cta archive: the zip layout Accord Project tooling loads
 * (Template.fromArchive, the CLI, an APAP server) — package.json with the
 * accordproject block, text/grammar.tem.md, model/model.cto and, when there is
 * logic, logic/logic.ts. data.json carries the sample data the Playground
 * showed, so the template opens with the same values elsewhere.
 * Same layout the store builds in memory for compilation (buildTemplateFromMemory).
 */
export const buildTemplateArchive = async (sources: TemplateSources): Promise<Uint8Array> => {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const packageJson = {
    name: slug(sources.name),
    version: "1.0.0",
    description: sources.name,
    accordproject: { template: "contract", cicero: "^1.0.0" },
  };
  zip.file("package.json", JSON.stringify(packageJson, null, 2));
  zip.file("text/grammar.tem.md", sources.templateMarkdown);
  zip.file("model/model.cto", sources.modelCto);
  zip.file("data.json", sources.data);
  if (sources.logicTs?.trim()) zip.file("logic/logic.ts", sources.logicTs);
  return zip.generateAsync({ type: "uint8array" });
};

/** Hands the browser a file to save. */
export const saveFile = (bytes: Uint8Array, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** The rendered agreement as plain text: the HTML with its markup stripped, blocks kept on their own lines. */
export const agreementText = (agreementHtml: string): string => {
  const body = new DOMParser().parseFromString(agreementHtml, "text/html").body;
  return (body.textContent ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

/**
 * Saves the rendered agreement as an A4 PDF, with the same html2pdf options
 * as the legacy "Download PDF". The v2 layout has no visible agreement
 * element to print, so the HTML is mounted off-screen for the duration.
 */
export const downloadAgreementPdf = async (agreementHtml: string, filename = "agreement.pdf"): Promise<void> => {
  const html2pdf = (await import("html2pdf.js")).default;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#000;";
  host.innerHTML = agreementHtml;
  document.body.appendChild(host);
  try {
    await html2pdf()
      .set({
        margin: 10,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(host)
      .save();
  } finally {
    host.remove();
  }
};
