import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND_ORANGE = [240, 140, 10] as [number, number, number];
const DARK        = [26,  31,  46]  as [number, number, number];
const GRAY_LIGHT  = [248, 249, 250] as [number, number, number];

const fmtMAD = (v: any) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
};

const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

const fmtPct = (v: any) => `${parseFloat(v || 0).toFixed(1)} %`;

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

  autoTable(doc, {
    startY:     y,
    head:       [['N°', 'Type', 'Période début', 'Période fin', 'Avancement', 'Montant brut', 'RG', 'Montant net', 'Statut']],
    body:       situations.map((s: any) => [
      `N°${s.numero_situation}`,
      s.type_situation,
      fmtDate(s.periode_debut),
      fmtDate(s.periode_fin),
      fmtPct(s.avancement_physique),
      fmtMAD(s.montant_brut),
      fmtMAD(s.retenue_garantie),
      fmtMAD(s.montant_net),
      s.statut?.toUpperCase(),
    ]),
    foot:       [[
      'TOTAL', '', '', '', fmtPct(r.avancement_physique),
      fmtMAD(r.total_situation), fmtMAD(r.total_rg), fmtMAD(r.total_net), '',
    ]],
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
      head:       [['Code', 'Désignation', 'U.', 'Qté prévue', 'Qté cumulée', 'Montant prévu', 'Montant cumulé', '%']],
      body:       par_article.map((a: any) => [
        a.code_article,
        a.designation,
        a.unite,
        a.quantite_prevue,
        a.quantite_cumulee,
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
