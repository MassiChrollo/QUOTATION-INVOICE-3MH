"use strict";

(function () {
  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const PAGE_MARGIN = 36;
  const PREVIEW_WIDTH = 816;
  const PAGE_CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
  const MAX_PDF_SIZE = 25 * 1024 * 1024;
  const MAX_DATA_SIZE = 2 * 1024 * 1024;
  const PDFLib = window.PDFLib;

  function getPDFName(value) {
    return PDFLib.PDFName.of(value);
  }

  function readAttachments(pdfDocument) {
    const catalogNames = pdfDocument.catalog.lookupMaybe(getPDFName("Names"), PDFLib.PDFDict);
    const embeddedFiles = catalogNames?.lookupMaybe(getPDFName("EmbeddedFiles"), PDFLib.PDFDict);
    if (!embeddedFiles) return [];

    const attachments = [];
    const visit = (tree, depth) => {
      if (depth > 8 || attachments.length >= 20) return;
      const entries = tree.lookupMaybe(getPDFName("Names"), PDFLib.PDFArray);
      if (entries) {
        for (let index = 1; index < entries.size() && attachments.length < 20; index += 2) {
          const fileSpec = pdfDocument.context.lookup(entries.get(index));
          if (!(fileSpec instanceof PDFLib.PDFDict)) continue;
          const fileStreams = fileSpec.lookupMaybe(getPDFName("EF"), PDFLib.PDFDict);
          if (!fileStreams) continue;
          const streamReference = fileStreams.get(getPDFName("UF")) || fileStreams.get(getPDFName("F"));
          if (!streamReference) continue;
          const stream = pdfDocument.context.lookup(streamReference);
          if (typeof stream.getContents !== "function") continue;
          const contents = PDFLib.decodePDFRawStream(stream).decode();
          if (contents.length > MAX_DATA_SIZE) {
            throw new Error("Les données intégrées dépassent la taille maximale permise.");
          }
          attachments.push(contents);
        }
      }

      const children = tree.lookupMaybe(getPDFName("Kids"), PDFLib.PDFArray);
      if (children) {
        for (let index = 0; index < children.size() && attachments.length < 20; index += 1) {
          const child = pdfDocument.context.lookup(children.get(index));
          if (child instanceof PDFLib.PDFDict) visit(child, depth + 1);
        }
      }
    };

    visit(embeddedFiles, 0);
    return attachments;
  }

  function pageBreaks(preview, canvas, scale) {
    const maxCSSHeight = (PAGE_HEIGHT - PAGE_MARGIN * 2) / (PAGE_CONTENT_WIDTH / PREVIEW_WIDTH);
    const maxPixelHeight = Math.floor(maxCSSHeight * scale);
    const previewTop = preview.getBoundingClientRect().top;
    const rowEnds = [...preview.querySelectorAll(".quote-table tbody tr, .quote-totals tr")]
      .map((row) => Math.round((row.getBoundingClientRect().bottom - previewTop) * scale))
      .sort((left, right) => left - right);
    const breaks = [];
    let start = 0;

    while (start < canvas.height) {
      const target = Math.min(start + maxPixelHeight, canvas.height);
      if (target === canvas.height) {
        breaks.push(target);
        break;
      }
      const safeBreak = rowEnds.filter((end) => end > start + scale * 120 && end <= target).at(-1);
      const end = safeBreak || target;
      breaks.push(end);
      start = end;
    }

    return breaks;
  }

  async function downloadDocumentPdf(preview, data, filename) {
    if (!window.PDFLib || !window.html2canvas) {
      throw new Error("Les outils PDF locaux ne sont pas chargés. Rechargez la page et réessayez.");
    }

    const serializedData = JSON.stringify(data);
    if (new TextEncoder().encode(serializedData).length > MAX_DATA_SIZE) {
      throw new Error("Les données du document dépassent la taille maximale permise pour le PDF.");
    }

    const printable = preview.cloneNode(true);
    printable.removeAttribute("id");
    printable.style.position = "absolute";
    printable.style.left = "-10000px";
    printable.style.top = "0";
    printable.style.width = `${PREVIEW_WIDTH}px`;
    printable.style.maxWidth = "none";
    printable.style.maxHeight = "none";
    printable.style.height = "auto";
    printable.style.overflow = "visible";
    printable.style.boxSizing = "border-box";
    printable.style.backgroundColor = "#fff";
    printable.querySelector(".print-document-header").style.display = "flex";
    document.body.append(printable);

    try {
      await document.fonts.ready;
      const canvas = await window.html2canvas(printable, {
        backgroundColor: "#fff",
        logging: false,
        scale: 2,
        useCORS: true,
        windowWidth: PREVIEW_WIDTH,
      });
      if (canvas.height > 30000) {
        throw new Error("Le document est trop long pour être converti en PDF.");
      }

      const pdfDocument = await PDFLib.PDFDocument.create();
      const title = data.invoice?.invoiceNumber || data.quote?.quoteNumber || "Document 3MH";
      pdfDocument.setTitle(title);
      pdfDocument.setAuthor("3MH solutions");
      pdfDocument.setSubject("Document 3MH avec données de réimportation intégrées");
      pdfDocument.setCreator("Créateur de documents 3MH");
      await pdfDocument.attach(
        new TextEncoder().encode(serializedData),
        "3mh-document.json",
        { mimeType: "application/json", description: "Données structurées du document 3MH" },
      );

      let start = 0;
      const scale = canvas.width / PREVIEW_WIDTH;
      for (const end of pageBreaks(printable, canvas, scale)) {
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = end - start;
        const context = pageCanvas.getContext("2d");
        if (!context) throw new Error("Impossible de préparer une page du PDF.");
        context.drawImage(canvas, 0, start, canvas.width, end - start, 0, 0, canvas.width, end - start);
        const imageData = pageCanvas.toDataURL("image/jpeg", 0.92).split(",")[1];
        const image = await pdfDocument.embedJpg(PDFLib.decodeFromBase64(imageData));
        const imageHeight = ((end - start) / canvas.width) * PAGE_CONTENT_WIDTH;
        const page = pdfDocument.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        page.drawImage(image, {
          x: PAGE_MARGIN,
          y: PAGE_HEIGHT - PAGE_MARGIN - imageHeight,
          width: PAGE_CONTENT_WIDTH,
          height: imageHeight,
        });
        start = end;
      }

      const bytes = await pdfDocument.save({ useObjectStreams: false });
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } finally {
      printable.remove();
    }
  }

  async function readDocumentFile(file, expectedFormat) {
    if (!PDFLib) {
      throw new Error("Les outils PDF locaux ne sont pas chargés. Rechargez la page et réessayez.");
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (extension === "json" || file.type === "application/json") {
      if (file.size > MAX_DATA_SIZE) throw new Error("Le fichier JSON dépasse la taille maximale permise.");
      try {
        return JSON.parse(await file.text());
      } catch {
        throw new Error("Le fichier JSON est invalide ou endommagé.");
      }
    }

    if (extension !== "pdf" && file.type !== "application/pdf") {
      throw new Error("Sélectionnez un PDF 3MH ou un fichier JSON exporté depuis l’application.");
    }
    if (file.size > MAX_PDF_SIZE) throw new Error("Le PDF dépasse la taille maximale permise de 25 Mo.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
      throw new Error("Le fichier sélectionné n’est pas un PDF valide.");
    }

    let pdfDocument;
    try {
      pdfDocument = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (error) {
      if (/encrypt|password/i.test(error.message)) {
        throw new Error("Ce PDF est protégé par mot de passe; déverrouillez-le avant de l’importer.");
      }
      throw new Error("Le PDF est invalide, endommagé ou utilise un format non pris en charge.");
    }

    let hasUnreadableAttachment = false;
    const documents = [];
    try {
      for (const contents of readAttachments(pdfDocument)) {
        try {
          documents.push(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(contents)));
        } catch {
          hasUnreadableAttachment = true;
        }
      }
    } catch (error) {
      if (error.message.includes("taille maximale")) throw error;
      hasUnreadableAttachment = true;
    }

    const matchingDocument = documents.find((entry) => entry?.format === expectedFormat);
    if (matchingDocument) return matchingDocument;
    const otherFormat = expectedFormat === "3mh-quotation" ? "3mh-invoice" : "3mh-quotation";
    if (documents.some((entry) => entry?.format === otherFormat)) {
      const expectedName = expectedFormat === "3mh-quotation" ? "Importer une soumission" : "Importer une facture précédente";
      const actualName = expectedFormat === "3mh-quotation" ? "une facture" : "une soumission";
      throw new Error(`Ce PDF contient ${actualName}; utilisez le bouton « ${expectedName} ».`);
    }
    if (hasUnreadableAttachment) {
      throw new Error("Ce PDF contient une pièce jointe illisible, plutôt que des données 3MH valides.");
    }
    throw new Error("Ce PDF ne contient pas les données 3MH intégrées. Utilisez un PDF téléchargé depuis cette application; les PDF imprimés auparavant ou créés dans un autre logiciel ne conviennent pas.");
  }

  window.ThreeMhPdf = { downloadDocumentPdf, readDocumentFile };
})();
