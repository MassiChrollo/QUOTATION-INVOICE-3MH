"use strict";

const DEFAULT_ITEMS = [
  ["Main d’œuvre pour la galerie", "1", "forfait", "5000"],
  ["Bois traité 5/4 x 6 x 16 pi", "66", "unité", "13.99"],
  ["Bois traité 2 x 2 x 8 pi", "167", "unité", "4.69"],
  ["2 x 10 x 8 pi", "2", "unité", "24.59"],
  ["2 x 10 x 16 pi", "58", "unité", "49.19"],
  ["2 x 10 x 12 pi", "10", "unité", "35.99"],
  ["6 x 6 x 12 pi", "32", "unité", "60.99"],
  ["Simpson BC Post Base", "32", "unité", "10.99"],
  ["Simpson BC5 Post Cap", "32", "unité", "24.59"],
  ["Simpson Joist Hanger 2 x 10", "104", "unité", "2.89"],
  ["Simpson Z-Max Joist Hanger", "14", "unité", "11.69"],
  ["Simpson Hurricane Tie", "121", "unité", "1.29"],
  ["Béton Bomix 30 kg", "125", "unité", "5.68"],
  ["Tube à coffrage 12 po x 12 pi", "9", "unité", "37.80"],
  ["Ancrage Titan HD 5/8 x 6 po", "32", "unité", "25.19"],
  ["Vis #10 x 3 1/2 po", "2", "boîte", "31.29"],
  ["Vis #8 x 3 po", "2", "boîte", "5.49"],
  ["Boulons 3/8 x 6 po", "7", "unité", "33.49"],
  ["Écrous galvanisés 3/8 po", "4", "unité", "9.49"],
  ["Rondelles galvanisées 3/8 po", "9", "unité", "10.99"],
  ["Simpson Post Tie", "33", "unité", "7.29"],
  ["Clous Ardox 3 1/2 po", "13", "boîte", "7.29"],
  ["Clous galvanisés 10D", "11", "boîte", "8.28"],
  ["Clous Simpson Strong-Tie", "11", "unité", "14.79"],
  ["Réalisation de la dalle de béton", "1", "forfait", "6000"],
];

const DEFAULT_DESCRIPTION = "Réparation du plancher de la salle de bain autour de la toilette, incluant le retrait du revêtement et du sous-plancher endommagé, l’inspection de la structure, la réparation au besoin et la réinstallation du revêtement et de la toilette";

const DEFAULT_MANDATE = `Retrait temporaire de la toilette.
Retrait du revêtement de sol en vinyle existant.
Enlèvement du sous-plancher endommagé dans toute la toilette.
Inspection de la structure afin de vérifier la présence de dommages causés par l’humidité ou d’une fuite potentielle.
Réparation ou renforcement de la structure, si nécessaire (doublage et ajout de solive).
Installation d’un nouveau sous-plancher. Un contreplaqué structural de 3/4 po sera utilisé. Une différence de niveau d’environ 1/4 po par rapport aux autres pièces de la maison peut en résulter.
Fourniture et installation d’un nouveau revêtement de sol en vinyle adapté à une salle de bain, choisi afin de se rapprocher le plus possible du fini existant, selon la disponibilité.
Installation et étanchéisation d’une nouvelle toilette fournie par le client, incluant le joint d’étanchéité et la vérification des fuites.
Remplacement des moulures si les anciennes ne sont pas récupérables. Les anciennes moulures seront conservées et remises au client.
Application d’un nouveau joint de silicone dans la salle de bain.
La moulure de transition sera choisie et installée après les travaux, avec l’accord du client.`;

const DEFAULT_EXCLUSIONS = `Aucun composé autolissant (auto-nivelant) ne sera appliqué.
Aucune peinture n’est incluse dans le mandat.
Le nouveau revêtement sera sélectionné selon la disponibilité et sa similitude avec le fini existant. Une correspondance exacte de couleur, de motif ou de texture ne peut être garantie. Si le client fournit un revêtement, celui-ci sera utilisé.`;

const DEFAULT_TERMS = `Annulation des travaux et commande de matériaux : Toute annulation après la confirmation ou la commande des matériaux entraînera la facturation des coûts engagés et non récupérables, selon les justificatifs disponibles.
Facturation minimale : Un minimum de quatre (4) heures sera facturé par jour de travail.
Annulation de service : Un préavis minimal de vingt-quatre (24) heures est requis; à défaut, quatre (4) heures seront facturées.
Mobilisation, démobilisation et réunions : Le temps consacré aux déplacements et aux réunions préparatoires ou de chantier sera facturé au taux horaire convenu, sauf indication contraire.
Modalités de paiement : Paiement net 30 jours suivant réception de la facture. Tout retard entraînera des intérêts de 3 % par mois. Paiement accepté par virement Interac ou bancaire.
Règlement des différends : Les parties s’engagent à procéder à une médiation avant d’exercer tout recours légal.
Validité et autres conditions : L’offre est valide pour 30 jours, sauf indication contraire. Un numéro de commande doit être émis avant le début du mandat. Un dépôt de 20 % du montant total sera exigible à la confirmation de la date des travaux. L’échéancier est soumis à confirmation lors de l’octroi.
Pour tout solde impayé 30 jours après la date de la soumission, des frais administratifs mensuels de 3 % seront ajoutés aux sommes dues.`;

const INITIAL_CLIENTS = [
  { name: "M Francoeur", address: "10334 Rue Paul - Comtois  \tH4N 3B6", email: "pierrejfrancoeur@gmail.com", phone: "514-334-3019" },
  { name: "M Kercha", address: "746 Rue de Lorraine H1B 3E4", email: "kerchahocine@gmail.com", phone: "4388769840" },
  { name: "Ms Gadzinski & Mr Ivan Dolinsek", address: "5393 Rue Waverly H2T 2X8", email: "sylvia.gadzinski@gmail.com", phone: "4389692984" },
];

const CLIENTS_KEY = "3mh-quotation-clients";
const $ = (selector, root = document) => root.querySelector(selector);
const itemsList = $("#items-list");
const preview = $("#quotation-preview");
const statusMessage = $("#status-message");
let clientStorageError = false;
let clientStorageWarning = "";

function localISODate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function parseDecimal(value, label) {
  const normalized = value.trim().replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`${label} doit être un nombre positif ou nul.`);
  }
  const unsigned = normalized.replace(/^[+-]/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(whole + fraction) * (normalized.startsWith("-") ? -1n : 1n);
  return { coefficient, scale: fraction.length };
}

function roundRatio(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator;
}

function toCents(quantityText, rateText, index) {
  const quantity = parseDecimal(quantityText, `La quantité de la ligne ${index}`);
  const rate = parseDecimal(rateText, `Le tarif de la ligne ${index}`);
  if (quantity.coefficient <= 0n) throw new Error(`La quantité de la ligne ${index} doit être supérieure à zéro.`);
  if (rate.coefficient < 0n) throw new Error(`Le tarif de la ligne ${index} doit être positif ou nul.`);
  const denominator = 10n ** BigInt(quantity.scale + rate.scale);
  return roundRatio(quantity.coefficient * rate.coefficient * 100n, denominator);
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

function downloadJSON(data, filename) {
  const file = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function quotationFileData(quote) {
  return {
    format: "3mh-quotation",
    version: 1,
    exportedAt: new Date().toISOString(),
    quote: {
      quoteNumber: quote.quoteNumber,
      quoteDate: quote.quoteDate,
      seller: {
        name: quote.companyName,
        address: quote.companyAddress,
        email: quote.companyEmail,
        phone: quote.companyPhone,
        neq: quote.companyNeq,
        gstNumber: quote.companyGstNumber,
        qstNumber: quote.companyQstNumber,
      },
      buyer: {
        name: quote.clientName,
        address: quote.clientAddress,
        email: quote.clientEmail,
        phone: quote.clientPhone,
      },
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: centsToDecimal(item.rateCents),
      })),
      mandate: quote.mandate,
      exclusions: quote.exclusions,
      terms: quote.terms,
    },
  };
}

function exportQuotation() {
  try {
    const quote = readQuotation();
    const fileData = quotationFileData(quote);
    const safeNumber = quote.quoteNumber.replace(/[^a-z0-9_-]+/gi, "-");
    downloadJSON(fileData, `${safeNumber || "soumission"}-3mh.json`);
    statusMessage.textContent = "Les données de la soumission sont prêtes à importer dans le créateur de factures.";
    statusMessage.classList.remove("is-error");
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.classList.add("is-error");
    focusInvalidField();
  }
}

function readItems() {
  const rows = [...itemsList.querySelectorAll("tr")];
  if (rows.length === 0) throw new Error("La soumission doit contenir au moins une ligne.");
  return rows.map((row, index) => {
    const description = $('[data-field="description"]', row).value.trim();
    const quantityText = $('[data-field="quantity"]', row).value.trim();
    const unit = $('[data-field="unit"]', row).value.trim();
    const rateText = $('[data-field="rate"]', row).value.trim();
    if (!description) throw new Error(`La description de la ligne ${index + 1} est requise.`);
    const totalCents = toCents(quantityText, rateText, index + 1);
    return { description, quantity: formatQuantity(quantityText), unit: unit || "-", rateCents: toCents("1", rateText, index + 1), totalCents };
  });
}

function readQuotation() {
  const clientName = $("#client-name").value.trim();
  const quoteNumber = $("#quote-number").value.trim();
  const quoteDate = $("#quote-date").value.trim();
  const expiryDate = $("#expiry-date").value.trim();
  if (!clientName) throw new Error("Le nom du client est requis.");
  if (!quoteNumber) throw new Error("Le numéro de soumission est requis.");
  for (const [label, value] of [["Date", quoteDate], ["Date limite", expiryDate]]) {
    if (value && !isValidISODate(value)) {
      throw new Error(`${label} doit respecter le format AAAA-MM-JJ.`);
    }
  }
  const items = readItems();
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0n);
  const tpsCents = roundRatio(subtotalCents * 5n, 100n);
  const tvqCents = roundRatio(subtotalCents * 9975n, 100000n);
  return {
    companyName: $("#company-name").value.trim(),
    companyAddress: $("#company-address").value.trim(),
    companyEmail: $("#company-email").value.trim(),
    companyPhone: $("#company-phone").value.trim(),
    companyNeq: $("#company-neq").value.trim(),
    companyGstNumber: $("#company-gst-number").value.trim(),
    companyQstNumber: $("#company-qst-number").value.trim(),
    clientName,
    clientAddress: $("#client-address").value.trim(),
    clientEmail: $("#client-email").value.trim(),
    clientPhone: $("#client-phone").value.trim(),
    quoteNumber,
    quoteDate,
    expiryDate: expiryDate || "Non précisée",
    quoteType: $('input[name="quote-type"]:checked').value,
    items,
    subtotalCents,
    tpsCents,
    tvqCents,
    totalCents: subtotalCents + tpsCents + tvqCents,
    mandate: $("#mandate").value.trim(),
    exclusions: $("#exclusions").value.trim(),
    terms: $("#terms").value.trim(),
  };
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function renderPreview() {
  try {
    const quote = readQuotation();
    const rows = quote.items.map((item) => `<tr>
      <td>${escapeHTML(item.description)}</td>
      <td class="quote-number">${escapeHTML(item.quantity)}</td>
      <td>${escapeHTML(item.unit)}</td>
      <td class="quote-number">${formatMoney(item.rateCents)} $</td>
      <td class="quote-number">${formatMoney(item.totalCents)} $</td>
    </tr>`).join("");
    const block = (value) => escapeHTML(value || "—");
    const companyIdentifiers = [
      quote.companyNeq ? `NEQ : ${escapeHTML(quote.companyNeq)}` : "",
      quote.companyGstNumber ? `TPS : ${escapeHTML(quote.companyGstNumber)}` : "",
      quote.companyQstNumber ? `TVQ : ${escapeHTML(quote.companyQstNumber)}` : "",
    ].filter(Boolean).join(" &nbsp; • &nbsp; ");
    const generationHeader = `
      <header class="print-document-header">
        <strong>Créateur de soumissions - 3MH</strong>
        <time id="generation-time"></time>
      </header>`;
    preview.innerHTML = `${generationHeader}
      <header class="quote-header">
        <div>
          <div class="quote-brand"><img class="quote-logo" src="3mh_logo.png" alt="">
            <div><h2>SOUMISSION</h2><strong>${escapeHTML(quote.companyName)}</strong></div>
          </div>
          <p>${block(quote.companyAddress)}</p>
          <p class="muted">${block(quote.companyEmail)} &nbsp; • &nbsp; ${block(quote.companyPhone)}</p>
          ${companyIdentifiers ? `<p class="muted">${companyIdentifiers}</p>` : ""}
        </div>
        <div class="quote-meta">
          <p><strong>Soumission #</strong> ${escapeHTML(quote.quoteNumber)}</p>
          <p><strong>Date :</strong> ${escapeHTML(quote.quoteDate)}</p>
          <p><strong>Valide jusqu’au :</strong> ${escapeHTML(quote.expiryDate)}</p>
          <p><strong>Type :</strong> Soumission ${escapeHTML(quote.quoteType)}</p>
        </div>
      </header>
      <div class="quote-section-title">CLIENT</div>
      <div class="quote-client"><p><strong>${escapeHTML(quote.clientName)}</strong></p>
        <p class="quote-block">${block(quote.clientAddress)}</p>
        <p class="muted">${block(quote.clientEmail)} &nbsp; • &nbsp; ${block(quote.clientPhone)}</p>
      </div>
      <h3 class="quote-section-title">Proposition de travaux</h3>
      <table class="quote-table"><thead><tr><th>Description</th><th>Qté</th><th>Unité</th><th>Tarif/unité</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="quote-totals"><tbody>
        <tr><td>Sous-total taxable</td><td>${formatMoney(quote.subtotalCents)} $</td></tr>
        <tr><td>TPS (5 %)</td><td>${formatMoney(quote.tpsCents)} $</td></tr>
        <tr><td>TVQ (9,975 %)</td><td>${formatMoney(quote.tvqCents)} $</td></tr>
        <tr class="grand-total"><td>Total</td><td>${formatMoney(quote.totalCents)} $</td></tr>
      </tbody></table>
      <h3 class="quote-section-title">Définition du mandat</h3><div class="quote-block">${block(quote.mandate)}</div>
      <h3 class="quote-section-title">Exclusions et précisions</h3><div class="quote-block">${block(quote.exclusions)}</div>
      <h3 class="quote-section-title">Conditions</h3><div class="quote-block">${block(quote.terms)}</div>
      <h3 class="quote-section-title">ACCEPTATION DU CLIENT</h3>
      <p class="acceptance-copy">En signant ci-dessous, le client confirme l’acceptation de la présente soumission et des conditions qui y sont énoncées.</p>
      <div class="signature-row"><span>Nom du client</span><span>Signature</span></div>
      <div class="signature-row"><span>Date</span><span>Numéro de commande (si applicable)</span></div>`;
    statusMessage.textContent = clientStorageWarning;
    statusMessage.classList.toggle("is-error", Boolean(clientStorageWarning));
    return true;
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.classList.add("is-error");
    return false;
  }
}

function addItem(values = ["", "1", "", "0"]) {
  const row = document.createElement("tr");
  const fields = [
    ["description", values[0], "Description"],
    ["quantity", values[1], "Quantité"],
    ["unit", values[2], "Unité"],
    ["rate", values[3], "Tarif / unité"],
  ];
  for (const [name, value, placeholder] of fields) {
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
      statusMessage.textContent = "La soumission doit contenir au moins une ligne.";
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
  try {
    const stored = localStorage.getItem(CLIENTS_KEY);
    if (stored === null) return [...INITIAL_CLIENTS];
    const clients = JSON.parse(stored);
    if (!Array.isArray(clients) || clients.some((client) => !client || typeof client.name !== "string" || !client.name.trim())) {
      throw new Error("Le contenu enregistré n’est pas une liste de clients valide.");
    }
    return clients;
  } catch (error) {
    clientStorageError = true;
    clientStorageWarning = `Impossible de lire la liste des clients : ${error.message} L’enregistrement est désactivé pour protéger les données.`;
    return [...INITIAL_CLIENTS];
  }
}

let clients = loadClients();

function refreshClients(selectedName = "") {
  const select = $("#saved-clients");
  select.replaceChildren(new Option("Choisir un client…", ""));
  [...clients].sort((a, b) => a.name.localeCompare(b.name, "fr")).forEach((client) => {
    select.add(new Option(client.name, client.name));
  });
  select.value = selectedName;
}

function saveClient() {
  if (clientStorageError) {
    statusMessage.textContent = clientStorageWarning;
    statusMessage.classList.add("is-error");
    return;
  }
  const name = $("#client-name").value.trim();
  if (!name) {
    statusMessage.textContent = "Entrez le nom du client avant de l’enregistrer.";
    statusMessage.classList.add("is-error");
    return;
  }
  const client = {
    name,
    address: $("#client-address").value.trim(),
    email: $("#client-email").value.trim(),
    phone: $("#client-phone").value.trim(),
  };
  const previous = clients;
  clients = [...clients.filter((entry) => entry.name.toLocaleLowerCase() !== name.toLocaleLowerCase()), client];
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
    refreshClients(name);
    statusMessage.textContent = `${name} est maintenant dans votre liste de clients.`;
    statusMessage.classList.remove("is-error");
  } catch (error) {
    clients = previous;
    statusMessage.textContent = `Impossible d’enregistrer le client : ${error.message}`;
    statusMessage.classList.add("is-error");
  }
}

function initialize() {
  $("#quote-number").value = `SO-${localISODate().replaceAll("-", "")}`;
  $("#quote-date").value = localISODate();
  $("#mandate").value = DEFAULT_MANDATE;
  $("#exclusions").value = DEFAULT_EXCLUSIONS;
  $("#terms").value = DEFAULT_TERMS;
  addItem([DEFAULT_DESCRIPTION, "1", "forfait", "2500"]);
  DEFAULT_ITEMS.forEach((item) => addItem(item));
  refreshClients();

  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
    activateTab(tab.dataset.tab);
  }));
  $("#add-item").addEventListener("click", () => {
    addItem();
    renderPreview();
    itemsList.lastElementChild?.querySelector("input")?.focus();
  });
  $("#save-client").addEventListener("click", saveClient);
  $("#export-quote").addEventListener("click", exportQuotation);
  $("#saved-clients").addEventListener("change", (event) => {
    const client = clients.find((entry) => entry.name === event.target.value);
    if (!client) return;
    $("#client-name").value = client.name;
    $("#client-address").value = client.address || "";
    $("#client-email").value = client.email || "";
    $("#client-phone").value = client.phone || "";
    renderPreview();
  });
  $("#quotation-form").addEventListener("input", renderPreview);
  $("#quotation-form").addEventListener("change", renderPreview);
  const downloadQuotePdf = async () => {
    if (!renderPreview()) {
      focusInvalidField();
      return;
    }
    try {
      const generatedAt = new Intl.DateTimeFormat("fr-CA", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date());
      $("#generation-time").textContent = `Généré le ${generatedAt}`;
      const quote = readQuotation();
      const safeNumber = quote.quoteNumber.replace(/[^a-z0-9_-]+/gi, "-");
      await window.ThreeMhPdf.downloadDocumentPdf(
        preview,
        quotationFileData(quote),
        `${safeNumber || "soumission"}-3mh.pdf`,
      );
      statusMessage.textContent = `Le PDF 3MH de la soumission ${quote.quoteNumber} a été téléchargé. Ses données peuvent être importées dans le créateur de factures.`;
      statusMessage.classList.remove("is-error");
    } catch (error) {
      statusMessage.textContent = `Impossible de générer le PDF : ${error.message}`;
      statusMessage.classList.add("is-error");
    }
  };
  $("#print-quote").addEventListener("click", downloadQuotePdf);
  $("#print-quote-bottom").addEventListener("click", downloadQuotePdf);
  renderPreview();
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

function focusInvalidField() {
  const message = statusMessage.textContent;
  let tabName = "details";
  let field = null;
  if (/nom du client/i.test(message)) {
    field = $("#client-name");
  } else if (/numéro de soumission/i.test(message)) {
    field = $("#quote-number");
  } else if (/date/i.test(message)) {
    field = /date limite/i.test(message) ? $("#expiry-date") : $("#quote-date");
  } else if (/ligne (\d+)/i.test(message)) {
    tabName = "work";
    const rowIndex = Number(message.match(/ligne (\d+)/i)[1]) - 1;
    const row = itemsList.rows[rowIndex];
    if (row) {
      const fieldName = /description/i.test(message) ? "description" : /quantité/i.test(message) ? "quantity" : "rate";
      field = $(`[data-field="${fieldName}"]`, row);
    }
  }
  if (field) {
    activateTab(tabName);
    field.focus();
    field.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    statusMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

initialize();
