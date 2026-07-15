import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND_ORANGE = [240, 140, 10] as [number, number, number];
const DARK        = [26,  31,  46]  as [number, number, number];
const GRAY_LIGHT  = [248, 249, 250] as [number, number, number];

// Formatage manuel (espace ASCII normale) car toLocaleString(fr-FR) insere
// une espace fine insecable (U+202F) que la police PDF par defaut affiche mal.
const fmtMAD = (v: any) => {
  const n = parseFloat(v) || 0;
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${withSep},${decPart} MAD`;
};

const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

const fmtPct = (v: any) => `${parseFloat(v || 0).toFixed(1)} %`;

// Quantités — même convention que fmt.number() à l'écran (utils.ts) : milliers
// groupés, 0 décimale. Les colonnes Qté du bordereau ne doivent jamais afficher
// les valeurs brutes de la base (ex. "4136.000") qui diffèrent du rendu écran.
const fmtQty = (v: any) => {
  const n = parseFloat(v) || 0;
  const neg = n < 0;
  const grouped = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}`;
};

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Golden Leader SARL', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text('Système de Gestion des Marchés', 14, 19);

  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(W - 80, 0, 80, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, W - 40, 13, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, W - 40, 21, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  return 35;
}

function addFooter(doc: jsPDF) {
  const pages = (doc as any).internal.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.line(14, doc.internal.pageSize.getHeight() - 15, W - 14, doc.internal.pageSize.getHeight() - 15);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Golden Leader SARL — Document généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${i} / ${pages}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }
}

function infoGrid(doc: jsPDF, items: [string, string][], startY: number, cols = 2): number {
  const W = doc.internal.pageSize.getWidth();
  const colW = (W - 28) / cols;
  let y = startY;

  doc.setFontSize(8.5);
  for (let i = 0; i < items.length; i += cols) {
    const row = items.slice(i, i + cols);
    row.forEach(([label, value], ci) => {
      const x = 14 + ci * colW;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text(label, x, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(value || '—', x, y + 5);
    });
    y += 13;
  }
  return y;
}

// ─── Export générique de liste/tableau ─────────────────────────────────────────
export function exportListPDF(opts: {
  title: string;
  subtitle: string;
  filename: string;
  head: string[];
  body: (string | number)[][];
  rightAlignCols?: number[];
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const y   = addHeader(doc, opts.title, opts.subtitle);

  const columnStyles: Record<number, any> = {};
  (opts.rightAlignCols || []).forEach(i => { columnStyles[i] = { halign: 'right' }; });

  autoTable(doc, {
    startY:     y + 4,
    head:       [opts.head],
    body:       opts.body,
    headStyles: { fillColor: DARK, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: GRAY_LIGHT },
    columnStyles,
    margin:     { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(opts.filename);
}

// ─── Fiche Marché PDF ───────────────────────────────────────────────────────
export function exportMarchePDF(marche: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = addHeader(doc, 'FICHE MARCHÉ', marche.numero_marche);

  doc.setFillColor(...GRAY_LIGHT);
  doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 60, 'F');
  y = infoGrid(doc, [
    ['Objet',                    marche.objet],
    ['Maître d\'ouvrage',        marche.maitre_ouvrage],
    ['Entreprise attributaire',  marche.entreprise_attributaire],
    ['Chef de marché',           marche.chef_marche_nom || '—'],
    ['Statut',                   marche.statut?.toUpperCase()],
    ['Date commencement',        fmtDate(marche.date_commencement)],
    ['Délai contractuel',        `${marche.delai_contractuel} jours`],
    ['Date fin prévue',          fmtDate(marche.date_fin_prevue)],
    ['Taux TVA',                 `${marche.taux_tva} %`],
    ['Retenue de garantie',      `${marche.taux_retenue_garantie} %`],
  ], y + 4, 2);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_ORANGE);
  doc.text('Indicateurs financiers', 14, y);
  y += 6;

  autoTable(doc, {
    startY:     y,
    head:       [['Indicateur', 'Valeur']],
    body:       [
      ['Montant initial',    fmtMAD(marche.montant_initial)],
      ['Montant actualisé',  fmtMAD(marche.montant_actualise || marche.montant_initial)],
      ['Total commandé',     fmtMAD(marche.total_commandes || 0)],
      ['Total facturé',      fmtMAD(marche.total_facture || 0)],
      ['Total payé',         fmtMAD(marche.total_paye || 0)],
      ['Avancement physique',  fmtPct(marche.avancement_physique)],
      ['Avancement financier', fmtPct(marche.avancement_financier)],
    ],
    headStyles: { fillColor: DARK, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: GRAY_LIGHT },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`Marche_${marche.numero_marche}.pdf`);
}

// ─── Fiche Commande PDF ─────────────────────────────────────────────────────
export function exportCommandePDF(commande: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = addHeader(doc, 'BON DE COMMANDE', commande.numero_commande);

  doc.setFillColor(...GRAY_LIGHT);
  doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 36, 'F');
  y = infoGrid(doc, [
    ['Marché',            commande.numero_marche || '—'],
    ['Fournisseur',       commande.fournisseur_nom || '—'],
    ['Statut',            commande.statut?.toUpperCase()],
    ['Date commande',     fmtDate(commande.date_commande)],
    ['Livraison prévue',  fmtDate(commande.date_livraison_prevue)],
    ['Livraison réelle',  fmtDate(commande.date_livraison_reelle)],
  ], y + 4, 2);
  y += 8;

  if (commande.lignes?.length) {
    autoTable(doc, {
      startY:     y,
      head:       [['Désignation', 'Unité', 'Quantité', 'P.U.', 'Montant']],
      body:       commande.lignes.map((l: any) => [
        l.designation, l.unite || '—', l.quantite, fmtMAD(l.prix_unitaire), fmtMAD(l.montant),
      ]),
      headStyles: { fillColor: DARK, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: GRAY_LIGHT },
      columnStyles: { 0: { cellWidth: 80 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      foot:       [['', '', '', 'TOTAL TTC', fmtMAD(commande.total_ttc)]],
      footStyles: { fillColor: BRAND_ORANGE, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
      margin:     { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`Commande_${commande.numero_commande}.pdf`);
}

// ─── Facture PDF ──────────────────────────────────────────────────────────────
export function exportFacturePDF(facture: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = addHeader(doc, 'FACTURE', `N° ${facture.numero_facture}`);

  // Info bloc
  doc.setFillColor(...GRAY_LIGHT);
  doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 48, 'F');
  y = infoGrid(doc, [
    ['Numéro de facture', facture.numero_facture],
    ['Statut',           facture.statut?.toUpperCase()],
    ['Date de facture',  fmtDate(facture.date_facture)],
    ['Date d\'échéance', fmtDate(facture.date_echeance)],
    ['Marché associé',   facture.marche_numero || '—'],
    ['Commande liée',    facture.commande_numero || '—'],
  ], y + 4, 2);
  y += 6;

  // Lignes
  if (facture.lignes?.length) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_ORANGE);
    doc.text('Détail des prestations', 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY:       y,
      head:         [['Désignation', 'Unité', 'Qté exec.', 'P.U. HT', 'Montant HT']],
      body:         facture.lignes.map((l: any) => [
        l.designation,
        l.unite || '—',
        l.quantite_executee,
        fmtMAD(l.prix_unitaire),
        fmtMAD(l.montant),
      ]),
      headStyles:   { fillColor: DARK, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 8 },
      alternateRowStyles: { fillColor: GRAY_LIGHT },
      columnStyles: { 0: { cellWidth: 80 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin:       { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Totaux
  const W = doc.internal.pageSize.getWidth();
  const totauxData = [
    ['Montant HT',   fmtMAD(facture.montant_ht)],
    [`TVA (${facture.taux_tva || 20} %)`, fmtMAD(facture.montant_tva)],
    ['Montant TTC',  fmtMAD(facture.montant_ttc)],
    ['Montant payé', fmtMAD(facture.montant_paye)],
    ['Solde',        fmtMAD((parseFloat(facture.montant_ttc)||0) - (parseFloat(facture.montant_paye)||0))],
  ];
  const boxW = 90;
  let ty = y;
  doc.setFontSize(8);
  totauxData.forEach(([label, val], idx) => {
    const isLast = idx === totauxData.length - 1;
    if (isLast) {
      doc.setFillColor(...BRAND_ORANGE);
      doc.rect(W - 14 - boxW, ty - 4, boxW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255);
      doc.rect(W - 14 - boxW, ty - 4, boxW, 8, 'F');
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(label, W - 14 - boxW + 4, ty + (isLast ? 2 : 0));
    doc.text(val, W - 18, ty + (isLast ? 2 : 0), { align: 'right' });
    ty += isLast ? 12 : 8;
  });

  // Paiement info
  if (facture.statut === 'payee' && facture.date_paiement) {
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`PAYÉE le ${fmtDate(facture.date_paiement)}`, 14, ty);
    if (facture.reference_paiement) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Référence: ${facture.reference_paiement}`, 14, ty + 5);
    }
  }

  addFooter(doc);
  doc.save(`Facture_${facture.numero_facture}.pdf`);
}

// ─── Situation Recap PDF ──────────────────────────────────────────────────────
export function exportSituationRecapPDF(data: any) {
  const { marche, situations, par_article, recapitulatif: r } = data;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, 'RÉCAPITULATIF', `Marché ${marche.numero_marche}`);

  // Infos marché
  doc.setFillColor(...GRAY_LIGHT);
  doc.rect(14, y, W - 28, 28, 'F');
  y = infoGrid(doc, [
    ['Marché',          marche.numero_marche],
    ['Maître d\'ouvrage', marche.maitre_ouvrage],
    ['Objet',           marche.objet],
    ['Statut',          marche.statut?.toUpperCase()],
    ['Début',           fmtDate(marche.date_commencement)],
    ['Délai',           `${marche.delai_contractuel} jours`],
  ], y + 4, 3);
  y += 4;

  // Synthèse
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_ORANGE);
  doc.text('Synthèse Financière', 14, y + 4);
  y += 8;

  autoTable(doc, {
    startY:     y,
    head:       [['Indicateur', 'Valeur']],
    body:       [
      ['Montant du marché',    fmtMAD(r.montant_marche)],
      ['Total situations',     fmtMAD(r.total_situation)],
      ['Total RG retenue',     fmtMAD(r.total_rg)],
      ['Total net à payer',    fmtMAD(r.total_net)],
      ['Total payé',           fmtMAD(r.total_paye)],
      ['Solde restant',        fmtMAD(r.solde_restant)],
      ['Avancement physique',  fmtPct(r.avancement_physique)],
      ['Avancement financier', fmtPct(r.avancement_financier)],
    ],
    headStyles:  { fillColor: DARK, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 8 },
    alternateRowStyles: { fillColor: GRAY_LIGHT },
    columnStyles:{ 1: { halign: 'right', fontStyle: 'bold' } },
    margin:      { left: 14, right: W / 2 + 7 },
  });

  // Décomptes
  doc.addPage();
  y = addHeader(doc, 'DÉCOMPTES', `Marché ${marche.numero_marche}`);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_ORANGE);
  doc.text('Historique des Décomptes', 14, y + 4);
  y += 8;

  // Sommes des valeurs réelles figées par décompte (Chantier Decompte-RG)
  const montantTvaRecap = parseFloat(r.total_tva ?? 0);
  const montantTtcRecap = parseFloat(r.total_ttc ?? 0);
  const tauxTvaRecap    = parseFloat(marche.taux_tva ?? 20);

  autoTable(doc, {
    startY:     y,
    head:       [['N°', 'Type', 'Période début', 'Période fin', 'Av. financier', 'Montant brut', 'RG', 'Montant net', 'Statut']],
    body:       situations.map((s: any) => [
      `N°${s.numero_situation}`,
      s.type_situation,
      fmtDate(s.periode_debut),
      fmtDate(s.periode_fin),
      fmtPct(s.avancement_financier),
      fmtMAD(s.montant_brut),
      fmtMAD(s.retenue_garantie),
      fmtMAD(s.montant_net),
      s.statut?.toUpperCase(),
    ]),
    foot:       [
      [{ content: 'TOTAL (HT)', colSpan: 5, styles: { halign: 'right' } },
       { content: fmtMAD(r.total_situation) }, { content: '', colSpan: 3 }],
      [{ content: `TVA (${tauxTvaRecap.toFixed(0)} %)`, colSpan: 5, styles: { halign: 'right', fillColor: GRAY_LIGHT, textColor: [80,80,80], fontStyle: 'normal' } },
       { content: fmtMAD(montantTvaRecap), styles: { fillColor: GRAY_LIGHT, textColor: [80,80,80], fontStyle: 'normal' } },
       { content: '', colSpan: 3, styles: { fillColor: GRAY_LIGHT } }],
      [{ content: 'TOTAL TTC', colSpan: 5, styles: { halign: 'right', fillColor: [230,230,230], textColor: DARK } },
       { content: fmtMAD(montantTtcRecap), styles: { fillColor: [230,230,230], textColor: DARK } },
       { content: '', colSpan: 3, styles: { fillColor: [230,230,230] } }],
      [{ content: 'RETENUE DE GARANTIE' + (r.plafond_rg != null ? ` (plafond ${fmtMAD(r.plafond_rg)})` : ''),
         colSpan: 6, styles: { halign: 'right', fontSize: 6.5 } },
       { content: fmtMAD(r.total_rg), styles: { textColor: [200, 40, 40] } },
       { content: '', colSpan: 2 }],
      [{ content: 'TOTAL NET À PAYER', colSpan: 7, styles: { halign: 'right' } },
       { content: fmtMAD(r.total_net), styles: { textColor: [22, 163, 74] } },
       { content: '' }],
    ],
    headStyles:  { fillColor: DARK, textColor: [255,255,255], fontSize: 7, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 7 },
    footStyles:  { fillColor: BRAND_ORANGE, textColor: [255,255,255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: GRAY_LIGHT },
    columnStyles: {
      4: { halign: 'right' }, 5: { halign: 'right' },
      6: { halign: 'right', textColor: [200, 40, 40] },
      7: { halign: 'right', textColor: [22, 163, 74] },
    },
    margin: { left: 14, right: 14 },
  });

  // Par article
  if (par_article?.length) {
    doc.addPage();
    y = addHeader(doc, 'PAR ARTICLE', `Marché ${marche.numero_marche}`);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_ORANGE);
    doc.text('Avancement par Article du BQ', 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY:     y,
      head:       [['N° prix', 'Désignation', 'U.', 'Qté prévue', 'Qté cumulée', 'Montant prévu', 'Montant cumulé', '%']],
      body:       par_article.map((a: any) => [
        a.code_article,
        a.designation,
        a.unite,
        fmtQty(a.quantite_prevue),
        fmtQty(a.quantite_cumulee),
        fmtMAD(a.montant),
        fmtMAD(a.montant_cumule),
        fmtPct(a.pourcentage),
      ]),
      headStyles:  { fillColor: DARK, textColor: [255,255,255], fontSize: 7, fontStyle: 'bold' },
      bodyStyles:  { fontSize: 7 },
      alternateRowStyles: { fillColor: GRAY_LIGHT },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 70 },
        3: { halign: 'right' }, 4: { halign: 'right' },
        5: { halign: 'right' }, 6: { halign: 'right' },
        7: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`Recap_Situations_${marche.numero_marche}.pdf`);
}

const TYPE_SITUATION_LABEL_PDF: Record<string, string> = {
  provisoire: 'DÉCOMPTE PROVISOIRE',
  mensuel:    'SITUATION MENSUELLE',
  definitif:  'DÉCOMPTE DÉFINITIF',
};

// Bloc récapitulatif financier encadré (Brut HT → TVA → TTC → RG → NET),
// aligné à droite comme le total d'une facture — remplace l'ancien foot du
// tableau des lignes pour un rendu "document officiel" plus lisible.
function financialRecapBox(doc: jsPDF, x: number, startY: number, w: number, rows: Array<{
  label: string; value: string; bold?: boolean; big?: boolean; sep?: boolean;
  color?: [number, number, number]; sub?: string; highlight?: boolean;
}>): number {
  let y = startY;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_ORANGE);
  doc.text('Récapitulatif financier', x, y);
  y += 7;

  rows.forEach(r => {
    const rowH = r.big ? 9 : 7;
    if (r.highlight) {
      doc.setFillColor(...BRAND_ORANGE);
      doc.rect(x, y - 5, w, rowH + 2, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      const c = r.color || [40, 40, 40];
      doc.setTextColor(...c);
    }
    doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
    doc.setFontSize(r.big ? 10 : 8.5);
    doc.text(r.label, x + 3, y);
    doc.text(r.value, x + w - 3, y, { align: 'right' });
    y += rowH;
    // La ligne "sub" (cumul/plafond) doit faire avancer y pour de bon —
    // sinon la ligne suivante (ex. le bandeau orange NET) la recouvre.
    if (r.sub) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(r.highlight ? 255 : 140, r.highlight ? 255 : 140, r.highlight ? 255 : 140);
      doc.text(r.sub, x + 3, y);
      // Marge généreuse : le bandeau surligné de la ligne suivante remonte de
      // 5mm au-dessus de sa propre base (voir `y - 5` plus haut) — il faut
      // donc au moins ce même écart ici pour ne jamais empiéter sur ce sub.
      y += 6;
    }
    if (r.sep) {
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.2);
      doc.line(x, y - 2, x + w, y - 2);
      y += 2;
    }
  });
  doc.setTextColor(0, 0, 0);
  return y;
}

// Blocs de signature (document contractuel destiné à être imprimé et signé
// à la main — l'application ne préremplit jamais de nom de signataire).
function signatureBlock(doc: jsPDF, startY: number, entrepreneur: string, maitreOuvrage: string): void {
  const W = doc.internal.pageSize.getWidth();
  const cols = [
    { label: 'L\'Entrepreneur', sub: entrepreneur || '—' },
    { label: 'Visé par l\'Ingénieur', sub: '' },
    { label: 'Le Maître d\'Ouvrage', sub: maitreOuvrage || '—' },
  ];
  const gap = 12;
  const colW = (W - 28 - gap * (cols.length - 1)) / cols.length;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(14, startY - 6, W - 14, startY - 6);

  cols.forEach((c, i) => {
    const x = 14 + i * (colW + gap);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(c.label, x, startY);
    if (c.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(c.sub, x, startY + 4.5);
    }
    doc.setDrawColor(180, 180, 180);
    doc.line(x, startY + 24, x + colW, startY + 24);
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Nom, date et signature', x, startY + 28);
  });
  doc.setTextColor(0, 0, 0);
}

// ─── Export d'un décompte / situation unique — document officiel ──────────
// Reproduit exactement le tableau de l'écran de détail (situations/[id]) :
// mêmes colonnes, mêmes totaux HT/TVA/TTC/RG/NET. Les montants proviennent
// uniquement des lignes du décompte (lignes_situation_marche) — jamais de
// l'avancement physique, qui est un suivi terrain distinct (Chantier
// Bordereau-Decompte-UI). Mise en page "document officiel" (Chantier
// Decompte-RG) : récapitulatif financier encadré + zone de signatures,
// avec gestion de saut de page si l'espace restant est insuffisant.
export function exportSituationDetailPDF(situation: any) {
  const s = situation;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const docTitle = `${TYPE_SITUATION_LABEL_PDF[s.type_situation] || 'DÉCOMPTE'} N°${s.numero_situation}`;

  let y = addHeader(doc, docTitle, `Marché ${s.numero_marche}`);

  // "Objet" isolé sur sa propre ligne pleine largeur avec retour à la ligne —
  // un objet de marché réel peut être une phrase longue qui, dans la grille
  // 3 colonnes générique (infoGrid, sans wrap), débordait sur la colonne
  // voisine et se superposait au texte de "Maître d'ouvrage".
  const objetLines = doc.splitTextToSize(s.marche_objet || '—', W - 28 - 30);
  const objetBlockH = 6 + objetLines.length * 4.5;
  const gridH = 22;
  doc.setFillColor(...GRAY_LIGHT);
  doc.rect(14, y, W - 28, objetBlockH + gridH, 'F');
  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(14, y, 1.2, objetBlockH + gridH, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 120, 120);
  doc.text('Objet', 14 + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(objetLines, 14 + 34, y + 6);

  y = infoGrid(doc, [
    ['Marché',            s.numero_marche],
    ['Maître d\'ouvrage', s.maitre_ouvrage],
    ['Type',              s.type_situation],
    ['Période',           `du ${fmtDate(s.periode_debut)} au ${fmtDate(s.periode_fin)}`],
    ['Statut',            s.statut?.toUpperCase()],
  ], y + objetBlockH + 2, 3);
  y += 6;

  // Valeurs figées à la création du décompte (Chantier Decompte-RG) — jamais
  // recalculées depuis le taux actuel du marché.
  const tauxTva     = parseFloat(s.taux_tva ?? 20);
  const montantBrut = parseFloat(s.montant_brut);
  const montantTva  = parseFloat(s.montant_tva ?? 0);
  const montantTtc  = parseFloat(s.montant_ttc ?? 0);

  autoTable(doc, {
    startY: y,
    head: [['N° prix', 'Désignation', 'U.', 'Qté prévue', 'Qté cumulée avant', 'Qté période', 'Qté cumulée', 'P.U.', 'Prix HT', '%']],
    body: (s.lignes || []).map((l: any) => [
      l.code_article || '—',
      l.designation,
      l.unite,
      fmtQty(l.quantite_prevue),
      fmtQty(l.quantite_cumulee_avant),
      fmtQty(l.quantite_periode),
      fmtQty(l.quantite_cumulee),
      fmtMAD(l.prix_unitaire),
      fmtMAD(l.montant_periode),
      fmtPct(l.pourcentage),
    ]),
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: GRAY_LIGHT },
    columnStyles: {
      0: { cellWidth: 16 },
      2: { cellWidth: 12 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      9: { cellWidth: 30, halign: 'right' },
    },
    // Marge basse : aucune ligne ne doit se dessiner dans la bande du pied de
    // page (tracée après coup par addFooter). Marge haute sur les pages de
    // continuation : laisse la place au bandeau d'en-tête redessiné ci-dessous
    // (un bordereau de plusieurs centaines de lignes tient sur plusieurs pages).
    margin: { top: 35, left: 14, right: 14, bottom: 22 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        addHeader(doc, docTitle, `Marché ${s.numero_marche}`);
      }
    },
  });

  let afterTableY = (doc as any).lastAutoTable.finalY + 10;

  // Le récapitulatif + les signatures ont besoin d'environ 120mm — saut de
  // page si l'espace restant est insuffisant, plutôt que de les caser dans
  // une fin de page trop courte (bordereau long sur plusieurs pages).
  if (H - afterTableY < 120) {
    doc.addPage();
    afterTableY = addHeader(doc, docTitle, `Marché ${s.numero_marche}`) + 6;
  }

  const recapW = 95;
  const recapX = W - 14 - recapW;
  const recapEndY = financialRecapBox(doc, recapX, afterTableY, recapW, [
    { label: 'Montant brut HT', value: fmtMAD(montantBrut) },
    { label: `TVA (${tauxTva.toFixed(0)} %)`, value: fmtMAD(montantTva) },
    { label: 'MONTANT TTC', value: fmtMAD(montantTtc), bold: true, sep: true },
    {
      label: 'Retenue de garantie', value: '- ' + fmtMAD(s.retenue_garantie), color: [180, 40, 40],
      sub: s.plafond_rg != null ? `cumul ${fmtMAD(s.rg_cumulee)} / plafond ${fmtMAD(s.plafond_rg)}` : undefined,
    },
    { label: 'MONTANT NET À PAYER', value: fmtMAD(s.montant_net), bold: true, big: true, highlight: true },
  ]);

  // Signatures toujours ancrées près du bas de la DERNIÈRE page — jamais
  // flottantes juste sous un récapitulatif court avec beaucoup d'espace libre
  // en dessous. Ne remonte jamais au-dessus du contenu qui précède.
  const sigAnchorY = H - 45;
  const sigY = Math.max(recapEndY + 15, sigAnchorY);
  signatureBlock(doc, sigY, s.entreprise_attributaire, s.maitre_ouvrage);

  addFooter(doc);
  doc.save(`Decompte_N${s.numero_situation}_${s.numero_marche}.pdf`);
}
