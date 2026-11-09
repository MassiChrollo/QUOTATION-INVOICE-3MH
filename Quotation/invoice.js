"use strict";

const CLIENTS_KEY = "3mh-quotation-clients";
const $ = (selector, root = document) => root.querySelector(selector);
const itemsList = $("#invoice-items-list");
const preview = $("#invoice-preview");
const statusMessage = $("#invoice-status");
let previouslyBilledPercent = "0";
let sourceQuoteNumber = "";
const INITIAL_CLIENTS = [
  { name: "M Francoeur", address: "10334 Rue Paul - Comtois  H4N 3B6", email: "pierrejfrancoeur@gmail.com", phone: "514-334-3019" },
  { name: "M Kercha", address: "746 Rue de Lorraine H1B 3E4", email: "kerchahocine@gmail.com", phone: "4388769840" },
  { name: "Ms Gadzinski & Mr Ivan Dolinsek", address: "5393 Rue Waverly H2T 2X8", email: "sylvia.gadzinski@gmail.com", phone: "4389692984" },
];

function localISODate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function parseDecimal(value, label) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`${label} doit être un nombre positif ou nul.`);
  const [whole, fraction = ""] = normalized.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
}

function roundRatio(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator;
}

function toCents(quantityText, priceText, index) {
  const quantity = parseDecimal(quantityText, `La quantité de la ligne ${index}`);
  const price = parseDecimal(priceText, `Le prix de la ligne ${index}`);
  if (quantity.coefficient <= 0n) throw new Error(`La quantité de la ligne ${index} doit être supérieure à zéro.`);
  const denominator = 10n ** BigInt(quantity.scale + price.scale);
  return roundRatio(quantity.coefficient * price.coefficient * 100n, denominator);
}

function formatMoney(cents) {
  const dollars = cents / 100n;
  const remainder = String(cents % 100n).padStart(2, "0");
  return `${new Intl.NumberFormat("fr-CA").format(dollars)},${remainder}`;
}

function formatQuantity(value) {
  return value.trim().replace(",", ".").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(".", ",") || "0";
}

function centsToDecimal(cents) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function percentageDifference(target, previous) {
  const scale = Math.max(target.scale, previous.scale);
  const factor = 10n ** BigInt(scale);
  const difference = target.coefficient * (factor / (10n ** BigInt(target.scale)))
    - previous.coefficient * (factor / (10n ** BigInt(previous.scale)));
  const whole = difference / factor;
  const fraction = String(difference % factor).padStart(scale, "0");
  return formatQuantity(scale ? `${whole}.${fraction}` : String(whole));
}

function downloadJSON(data, filename) {
  const file = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function invoiceFileData(invoice) {
  return {
    format: "3mh-invoice",
    version: 1,
    exportedAt: new Date().toISOString(),
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      cumulativePercent: invoice.invoicePercent,
      quoteNumber: sourceQuoteNumber,
      reference: invoice.reference,
      seller: {
        name: invoice.sellerName,
        address: invoice.sellerAddress,
        email: invoice.sellerEmail,
        phone: invoice.sellerPhone,
        neq: invoice.sellerNeq,
        gstNumber: invoice.sellerGstNumber,
        qstNumber: invoice.sellerQstNumber,
      },
      buyer: {
        name: invoice.buyerName,
        address: invoice.buyerAddress,
        email: invoice.buyerEmail,
        phone: invoice.buyerPhone,
      },
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: centsToDecimal(item.rateCents),
      })),
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes,
    },
  };
}

function exportInvoice() {
  try {
    const invoice = readInvoice();
    const fileData = invoiceFileData(invoice);
    const safeNumber = invoice.invoiceNumber.replace(/[^a-z0-9_-]+/gi, "-");
    downloadJSON(fileData, `${safeNumber || "facture"}-3mh.json`);
    statusMessage.textContent = `Les données de la facture ${invoice.invoiceNumber} sont prêtes pour la prochaine facture.`;
    statusMessage.classList.remove("is-error");
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.classList.add("is-error");
    activateTab(/ligne|description|quantité|prix/i.test(error.message) ? "invoice-items" : "invoice-details");
  }
}

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Le fichier importé ne contient pas ${label}.`);
  return value.trim();
}

function optionalText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error("Le fichier importé contient un champ texte invalide.");
  return value;
}

function normalizeImportedItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
    throw new Error("Le fichier importé doit contenir de 1 à 200 lignes.");
  }
  return items.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`La ligne ${index + 1} du fichier importé est invalide.`);
    const description = requiredText(item.description, `la description de la ligne ${index + 1}`);
    const quantity = String(item.quantity ?? "");
    const unitPrice = String(item.unitPrice ?? "");
    const parsedPrice = parseDecimal(unitPrice, `Le prix de la ligne ${index + 1}`);
    if (parsedPrice.coefficient < 0n) throw new Error(`Le prix de la ligne ${index + 1} doit être positif ou nul.`);
    toCents(quantity, unitPrice, index + 1);
    return {
      description,
      quantity: formatQuantity(quantity),
      unit: optionalText(item.unit) || "unité",
      unitPrice: formatQuantity(unitPrice),
    };
  });
}

function setValue(selector, value) {
  $(selector).value = value;
}

function readImportedSeller(seller) {
  if (!seller || typeof seller !== "object") throw new Error("Les coordonnées de l’entreprise sont absentes du fichier.");
  return {
    name: requiredText(seller.name, "le nom de l’entreprise"),
    address: optionalText(seller.address),
    email: optionalText(seller.email),
    phone: optionalText(seller.phone),
    neq: optionalText(seller.neq),
    gstNumber: optionalText(seller.gstNumber),
    qstNumber: optionalText(seller.qstNumber),
  };
}

function applyImportedSeller(seller) {
  setValue("#seller-name", seller.name);
  setValue("#seller-address", seller.address);
  setValue("#seller-email", seller.email);
  setValue("#seller-phone", seller.phone);
  setValue("#seller-neq", seller.neq);
  setValue("#seller-gst-number", seller.gstNumber);
  setValue("#seller-qst-number", seller.qstNumber);
}

function readImportedBuyer(buyer) {
  if (!buyer || typeof buyer !== "object") throw new Error("Les coordonnées du client sont absentes du fichier.");
  return {
    name: requiredText(buyer.name, "le nom du client"),
    address: optionalText(buyer.address),
    email: optionalText(buyer.email),
    phone: optionalText(buyer.phone),
  };
}

function applyImportedBuyer(buyer) {
  setValue("#buyer-name", buyer.name);
  setValue("#buyer-address", buyer.address);
  setValue("#buyer-email", buyer.email);
  setValue("#buyer-phone", buyer.phone);
}

function replaceItems(items) {
  itemsList.replaceChildren();
  items.forEach((item) => addItem([item.description, item.quantity, item.unit, item.unitPrice]));
}

function updateClientSelection(clientName) {
  const select = $("#invoice-saved-clients");
  const savedOption = [...select.options].find((option) => option.value === clientName);
  select.value = savedOption ? clientName : "";
}

function addPercentagePoints(value, points) {
  const parsed = parseDecimal(value, "Le pourcentage déjà facturé");
  const factor = 10n ** BigInt(parsed.scale);
  const total = parsed.coefficient + BigInt(points) * factor;
  const maximum = 100n * factor;
  if (total >= maximum) return "100";
  const fraction = String(total % factor).padStart(parsed.scale, "0");
  return formatQuantity(parsed.scale ? `${total / factor}.${fraction}` : String(total));
}

function nextInvoiceNumber(previousNumber) {
  const match = previousNumber.match(/^(.*-\d{8})-(\d+)$/);
  if (!match) return `${previousNumber}-2`;
  const prefix = match[1];
  const sequence = Number(match[2]) + 1;
  return `${prefix}-${sequence}`;
}

async function importFile(file, expectedFormat) {
  try {
    const data = await window.ThreeMhPdf.readDocumentFile(file, expectedFormat);
    if (!data || typeof data !== "object" || data.version !== 1) {
      throw new Error("La version du fichier est invalide ou non prise en charge.");
    }
    if (data.format !== expectedFormat) {
      const expected = expectedFormat === "3mh-quotation" ? "une soumission" : "une facture précédente";
      throw new Error(`Sélectionnez un fichier JSON exporté depuis ${expected}.`);
    }
    const source = expectedFormat === "3mh-quotation" ? data.quote : data.invoice;
    if (!source || typeof source !== "object") throw new Error("Les données du document sont absentes du fichier.");
    const items = normalizeImportedItems(source.items);
    const seller = readImportedSeller(source.seller);
    const buyer = readImportedBuyer(source.buyer);
    const reference = optionalText(source.reference)
      || (expectedFormat === "3mh-quotation" ? requiredText(source.quoteNumber, "le numéro de soumission") : "");
    let importedInvoiceNumber = "";
    let importedPercent = "";
    let importedQuoteNumber = "";
    let importedPaymentTerms = "";
    let importedNotes = "";
    let importedInvoiceIsComplete = false;
    if (expectedFormat === "3mh-invoice") {
      importedInvoiceNumber = requiredText(source.invoiceNumber, "le numéro de facture");
      importedPercent = requiredText(source.cumulativePercent, "le pourcentage cumulatif déjà facturé");
      importedQuoteNumber = optionalText(source.quoteNumber);
      importedPaymentTerms = optionalText(source.paymentTerms);
      importedNotes = optionalText(source.notes);
      const previousPercent = parseDecimal(importedPercent, "Le pourcentage déjà facturé");
      const factor = 10n ** BigInt(previousPercent.scale);
      if (previousPercent.coefficient <= 0n || previousPercent.coefficient > 100n * factor) {
        throw new Error("Le pourcentage cumulatif de la facture importée doit être entre 0 % et 100 %.");
      }
      importedInvoiceIsComplete = previousPercent.coefficient === 100n * factor;
    } else {
      requiredText(source.quoteNumber, "le numéro de soumission");
    }

    applyImportedSeller(seller);
    applyImportedBuyer(buyer);
    replaceItems(items);
    $("#invoice-reference").value = reference;
    updateClientSelection(buyer.name);

    if (expectedFormat === "3mh-quotation") {
      sourceQuoteNumber = source.quoteNumber;
      previouslyBilledPercent = "0";
      setValue("#invoice-percent", "20");
      $("#invoice-number").value = `FAC-${localISODate().replaceAll("-", "")}`;
      $("#previously-billed-summary").textContent = `Soumission ${sourceQuoteNumber} importée. Aucun montant n’a encore été facturé.`;
      statusMessage.textContent = `Soumission ${sourceQuoteNumber} importée avec les coordonnées du client et les lignes de travaux.`;
    } else {
      previouslyBilledPercent = formatQuantity(importedPercent);
      sourceQuoteNumber = importedQuoteNumber;
      setValue("#invoice-percent", addPercentagePoints(previouslyBilledPercent, 20));
      setValue("#invoice-number", nextInvoiceNumber(importedInvoiceNumber));
      setValue("#payment-terms", importedPaymentTerms);
      setValue("#invoice-notes", importedNotes);
      $("#previously-billed-summary").textContent = importedInvoiceIsComplete
        ? `100 % du contrat déjà facturés (facture ${importedInvoiceNumber}). Le contrat est entièrement facturé.`
        : `${previouslyBilledPercent} % du contrat déjà facturés (facture ${importedInvoiceNumber}). La nouvelle facture est préremplie avec une progression supplémentaire de 20 points, jusqu’à 100 %.`;
      statusMessage.textContent = importedInvoiceIsComplete
        ? `Facture précédente importée. Le contrat est déjà facturé à 100 %; aucun solde ne reste à facturer.`
        : `Facture précédente importée. Les coordonnées du client et les lignes sont reprises; le cumul déjà facturé est de ${previouslyBilledPercent} %.`;
    }
    const importMessage = statusMessage.textContent;
    const previewIsValid = importedInvoiceIsComplete ? false : renderPreview();
    if (importedInvoiceIsComplete) {
      preview.replaceChildren();
      statusMessage.classList.remove("is-error");
    }
    activateTab("invoice-details");
    if (previewIsValid) {
      statusMessage.textContent = importMessage;
      statusMessage.classList.remove("is-error");
    }
  } catch (error) {
    statusMessage.textContent = `Importation impossible : ${error.message}`;
    statusMessage.classList.add("is-error");
  }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return year > 0 && month > 0 && month <= 12 && day > 0 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function readInvoice() {
  const invoiceNumber = $("#invoice-number").value.trim();
  const invoiceDate = $("#invoice-date").value;
  const dueDate = $("#due-date").value;
  const buyerName = $("#buyer-name").value.trim();
  const percentText = $("#invoice-percent").value.trim();
  if (!$("#seller-name").value.trim()) throw new Error("Le nom de l’entreprise est requis.");
  if (!invoiceNumber) throw new Error("Le numéro de facture est requis.");
  if (!buyerName) throw new Error("Le nom du client est requis.");
  if (!validDate(invoiceDate)) throw new Error("La date de facturation est invalide.");
  if (!validDate(dueDate)) throw new Error("La date d’échéance est invalide.");
  const percent = parseDecimal(percentText, "Le pourcentage facturé");
  if (percent.coefficient <= 0n || percent.coefficient > 100n * (10n ** BigInt(percent.scale))) {
    throw new Error("Le pourcentage facturé doit être supérieur à 0 % et ne pas dépasser 100 %.");
  }
  const previousPercent = parseDecimal(previouslyBilledPercent, "Le pourcentage déjà facturé");
  const percentageScale = Math.max(percent.scale, previousPercent.scale);
  const percentageFactor = 10n ** BigInt(percentageScale);
  const targetPercentage = percent.coefficient * (percentageFactor / (10n ** BigInt(percent.scale)));
  const previousPercentage = previousPercent.coefficient * (percentageFactor / (10n ** BigInt(previousPercent.scale)));
  if (targetPercentage <= previousPercentage) {
    throw new Error(`Le pourcentage cible doit être supérieur aux ${previouslyBilledPercent} % déjà facturés.`);
  }

  const rows = [...itemsList.querySelectorAll("tr")];
  if (!rows.length) throw new Error("La facture doit contenir au moins une ligne.");
  const items = rows.map((row, index) => {
    const description = $('[data-field="description"]', row).value.trim();
    const quantity = $('[data-field="quantity"]', row).value.trim();
    const unit = $('[data-field="unit"]', row).value.trim();
    const price = $('[data-field="rate"]', row).value.trim();
    if (!description) throw new Error(`La description de la ligne ${index + 1} est requise.`);
    return {
      description,
      quantity: formatQuantity(quantity),
      unit: unit || "—",
      totalCents: toCents(quantity, price, index + 1),
      rateCents: toCents("1", price, index + 1),
    };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0n);
  const previousBilledSubtotalCents = roundRatio(subtotalCents * previousPercent.coefficient, 100n * (10n ** BigInt(previousPercent.scale)));
  const cumulativeBilledSubtotalCents = roundRatio(subtotalCents * percent.coefficient, 100n * (10n ** BigInt(percent.scale)));
  const billedSubtotalCents = cumulativeBilledSubtotalCents - previousBilledSubtotalCents;
  if (billedSubtotalCents <= 0n) throw new Error("Le montant facturé sur cette facture doit être supérieur à zéro.");
  const tpsCents = roundRatio(billedSubtotalCents * 5n, 100n);
  const tvqCents = roundRatio(billedSubtotalCents * 9975n, 100000n);
  const isPartial = percent.coefficient < 100n * (10n ** BigInt(percent.scale));

  return {
    sellerName: $("#seller-name").value.trim(),
    sellerAddress: $("#seller-address").value.trim(),
    sellerEmail: $("#seller-email").value.trim(),
    sellerPhone: $("#seller-phone").value.trim(),
    sellerNeq: $("#seller-neq").value.trim(),
    sellerGstNumber: $("#seller-gst-number").value.trim(),
    sellerQstNumber: $("#seller-qst-number").value.trim(),
    buyerName,
    buyerAddress: $("#buyer-address").value.trim(),
    buyerEmail: $("#buyer-email").value.trim(),
    buyerPhone: $("#buyer-phone").value.trim(),
    invoiceNumber,
    invoiceDate,
    dueDate,
    invoicePercent: formatQuantity(percentText),
    previouslyBilledPercent,
    currentPercent: percentageDifference(percent, previousPercent),
    isPartial,
    reference: $("#invoice-reference").value.trim(),
    paymentTerms: $("#payment-terms").value.trim(),
    notes: $("#invoice-notes").value.trim(),
    items,
    subtotalCents,
    previousBilledSubtotalCents,
    cumulativeBilledSubtotalCents,
    billedSubtotalCents,
    tpsCents,
    tvqCents,
    totalCents: billedSubtotalCents + tpsCents + tvqCents,
  };
}

function renderPreview() {
  try {
    const invoice = readInvoice();
    const rows = invoice.items.map((item) => `<tr>
      <td>${escapeHTML(item.description)}</td>
      <td class="quote-number">${escapeHTML(item.quantity)} ${escapeHTML(item.unit)}</td>
      <td class="quote-number">${formatMoney(item.rateCents)} $</td>
      <td class="quote-number">${formatMoney(item.totalCents)} $</td>
    </tr>`).join("");
    const block = (value) => escapeHTML(value || "—");
    const taxNumbers = [
      invoice.sellerNeq ? `NEQ : ${escapeHTML(invoice.sellerNeq)}` : "",
      invoice.sellerGstNumber ? `TPS : ${escapeHTML(invoice.sellerGstNumber)}` : "",
      invoice.sellerQstNumber ? `TVQ : ${escapeHTML(invoice.sellerQstNumber)}` : "",
    ].filter(Boolean).join(" &nbsp; • &nbsp; ");
    $("#previously-billed-summary").textContent = invoice.previousBilledSubtotalCents > 0n
      ? `${invoice.previouslyBilledPercent} % déjà facturés (${formatMoney(invoice.previousBilledSubtotalCents)} $ avant taxes). Cette facture ajoute ${invoice.currentPercent} % (${formatMoney(invoice.billedSubtotalCents)} $ avant taxes).`
      : "Aucune facture précédente importée : cette facture commence le cumul.";
    preview.innerHTML = `
      <header class="print-document-header">
        <strong>Créateur de factures - 3MH</strong>
        <time id="invoice-generation-time"></time>
      </header>
      <header class="quote-header">
        <div>
          <div class="quote-brand"><img class="quote-logo" src="3mh_logo.png" alt="">
            <div><h2>${invoice.isPartial ? "FACTURE PARTIELLE" : "FACTURE"}</h2><strong>${escapeHTML(invoice.sellerName)}</strong></div>
          </div>
          <p>${block(invoice.sellerAddress)}</p>
          <p class="muted">${block(invoice.sellerEmail)} &nbsp; • &nbsp; ${block(invoice.sellerPhone)}</p>
          ${taxNumbers ? `<p class="muted">${taxNumbers}</p>` : ""}
        </div>
        <div class="quote-meta">
          <p><strong>Facture #</strong> ${escapeHTML(invoice.invoiceNumber)}</p>
          <p><strong>Date :</strong> ${escapeHTML(invoice.invoiceDate)}</p>
          <p><strong>Échéance :</strong> ${escapeHTML(invoice.dueDate)}</p>
          ${invoice.reference ? `<p><strong>Référence :</strong> ${escapeHTML(invoice.reference)}</p>` : ""}
        </div>
      </header>
      <div class="quote-section-title">FACTURÉ À</div>
      <div class="quote-client">
        <p><strong>${escapeHTML(invoice.buyerName)}</strong></p>
        <p class="quote-block">${block(invoice.buyerAddress)}</p>
        <p class="muted">${block(invoice.buyerEmail)} &nbsp; • &nbsp; ${block(invoice.buyerPhone)}</p>
      </div>
      <h3 class="quote-section-title">Détail des articles et services</h3>
      <p class="hint">Les lignes ci-dessous indiquent les montants totaux du contrat; les totaux de cette facture tiennent compte de la progression cumulative.</p>
      <table class="quote-table"><thead><tr><th>Description</th><th>Qté / unité</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="quote-totals"><tbody>
        <tr><td>Montant total du contrat avant taxes</td><td>${formatMoney(invoice.subtotalCents)} $</td></tr>
        ${invoice.previousBilledSubtotalCents > 0n ? `<tr><td>Déjà facturé auparavant (${escapeHTML(invoice.previouslyBilledPercent)} %)</td><td>${formatMoney(invoice.previousBilledSubtotalCents)} $</td></tr>` : ""}
        <tr><td>Portion facturée sur cette facture (${escapeHTML(invoice.currentPercent)} %; cumul ${escapeHTML(invoice.invoicePercent)} %)</td><td>${formatMoney(invoice.billedSubtotalCents)} $</td></tr>
        <tr><td>TPS (5 %)</td><td>${formatMoney(invoice.tpsCents)} $</td></tr>
        <tr><td>TVQ (9,975 %)</td><td>${formatMoney(invoice.tvqCents)} $</td></tr>
        <tr class="grand-total"><td>Total à payer</td><td>${formatMoney(invoice.totalCents)} $</td></tr>
        ${invoice.isPartial ? `<tr><td>Solde du contrat avant taxes après cette facture</td><td>${formatMoney(invoice.subtotalCents - invoice.cumulativeBilledSubtotalCents)} $</td></tr>` : ""}
      </tbody></table>
      <div class="invoice-payment"><strong>Modalités de paiement</strong><p class="quote-block">${block(invoice.paymentTerms)}</p></div>
      ${invoice.notes ? `<div class="invoice-payment"><strong>Notes</strong><p class="quote-block">${escapeHTML(invoice.notes)}</p></div>` : ""}
      <p class="acceptance-copy">Merci de faire affaire avec ${escapeHTML(invoice.sellerName)}.</p>`;
    return true;
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.classList.add("is-error");
    preview.replaceChildren();
    return false;
  }
}

function addItem(values = ["", "1", "unité", "0"]) {
  const row = document.createElement("tr");
  for (const [name, value, placeholder] of [
    ["description", values[0], "Description"],
    ["quantity", values[1], "Quantité"],
    ["unit", values[2], "Unité"],
    ["rate", values[3], "Prix unitaire"],
  ]) {
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.field = name;
    input.value = value;
    input.placeholder = placeholder;
    input.setAttribute("aria-label", placeholder);
    if (name === "quantity" || name === "rate") input.inputMode = "decimal";
    cell.append(input);
    row.append(cell);
  }
  const actionCell = document.createElement("td");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-item";
  remove.textContent = "Retirer";
  remove.setAttribute("aria-label", "Retirer cette ligne");
  remove.addEventListener("click", () => {
    if (itemsList.rows.length <= 1) {
      statusMessage.textContent = "La facture doit contenir au moins une ligne.";
      statusMessage.classList.add("is-error");
      return;
    }
    row.remove();
    renderPreview();
  });
  actionCell.append(remove);
  row.append(actionCell);
  itemsList.append(row);
}

function loadClients() {
  let clients = INITIAL_CLIENTS;
  try {
    const savedClients = localStorage.getItem(CLIENTS_KEY);
    if (savedClients !== null) {
      const parsed = JSON.parse(savedClients);
      if (!Array.isArray(parsed) || parsed.some((client) => !client || typeof client.name !== "string")) {
        throw new Error("La liste de clients enregistrée n’est pas valide.");
      }
      clients = parsed;
    }
  } catch (error) {
    statusMessage.textContent = `Impossible de lire la liste des clients : ${error.message}`;
    statusMessage.classList.add("is-error");
  }
  const select = $("#invoice-saved-clients");
  clients.sort((a, b) => a.name.localeCompare(b.name, "fr")).forEach((client) => {
    select.add(new Option(client.name, client.name));
  });
  select.addEventListener("change", () => {
    const client = clients.find((entry) => entry.name === select.value);
    if (!client) return;
    $("#buyer-name").value = client.name;
    $("#buyer-address").value = client.address || "";
    $("#buyer-email").value = client.email || "";
    $("#buyer-phone").value = client.phone || "";
    renderPreview();
  });
}

function activateTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.dataset.panel === tabName;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
}

async function downloadInvoicePdf() {
  if (!renderPreview()) {
    statusMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  try {
    const generatedAt = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeStyle: "short" }).format(new Date());
    $("#invoice-generation-time").textContent = `Générée le ${generatedAt}`;
    const invoice = readInvoice();
    const safeNumber = invoice.invoiceNumber.replace(/[^a-z0-9_-]+/gi, "-");
    await window.ThreeMhPdf.downloadDocumentPdf(
      preview,
      invoiceFileData(invoice),
      `${safeNumber || "facture"}-3mh.pdf`,
    );
    statusMessage.textContent = `Le PDF 3MH de la facture ${invoice.invoiceNumber} a été téléchargé. Ses données peuvent être réimportées dans l’application.`;
    statusMessage.classList.remove("is-error");
  } catch (error) {
    statusMessage.textContent = `Impossible de générer le PDF : ${error.message}`;
    statusMessage.classList.add("is-error");
  }
}

function initialize() {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  $("#invoice-number").value = `FAC-${localISODate().replaceAll("-", "")}`;
  $("#invoice-date").value = localISODate(today);
  $("#due-date").value = localISODate(dueDate);
  addItem();
  loadClients();
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));
  $("#add-invoice-item").addEventListener("click", () => {
    addItem();
    renderPreview();
    itemsList.lastElementChild?.querySelector("input")?.focus();
  });
  $("#invoice-form").addEventListener("input", renderPreview);
  $("#invoice-form").addEventListener("change", renderPreview);
  $("#print-invoice").addEventListener("click", downloadInvoicePdf);
  $("#print-invoice-bottom").addEventListener("click", downloadInvoicePdf);
  $("#export-invoice").addEventListener("click", exportInvoice);
  $("#import-quote").addEventListener("click", () => $("#quote-file").click());
  $("#import-invoice").addEventListener("click", () => $("#invoice-file").click());
  $("#quote-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) await importFile(file, "3mh-quotation");
    event.target.value = "";
  });
  $("#invoice-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) await importFile(file, "3mh-invoice");
    event.target.value = "";
  });
  renderPreview();
}

initialize();
