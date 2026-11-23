import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import type { AncillaryCoverage, ExtractionResult, MedicalPlan } from './types';

const PPTX_TEMPLATE = 'Sample_Renewal_Proposal_Presentation_FICTIONAL-881fc5b4.pptx';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtPct(curr: number | null | undefined, ren: number | null | undefined): string {
  if (curr == null || ren == null || curr === 0) return '—';
  const pct = ((ren - curr) / curr) * 100;
  if (Math.abs(pct) < 0.05) return 'No change';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * Replaces the text inside a specific table cell (rowIndex, colIndex) of a slide XML
 * while preserving the first run's styling (<a:rPr>).
 */
function updateTableCell(
  slideXml: string,
  rowIndex: number,
  colIndex: number,
  newText: string
): string {
  const trRegex = /<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g;
  const rows = slideXml.match(trRegex);
  if (!rows || rowIndex >= rows.length) return slideXml;

  const targetRow = rows[rowIndex];
  const tcRegex = /<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g;
  const cells = targetRow.match(tcRegex);
  if (!cells || colIndex >= cells.length) return slideXml;

  const targetCell = cells[colIndex];
  const firstT = /<a:t(?:\s[^>]*)?>[\s\S]*?<\/a:t>/;
  let updatedCell = targetCell;

  if (firstT.test(targetCell)) {
    let replacedFirst = false;
    updatedCell = targetCell.replace(/<a:t(?:\s[^>]*)?>[\s\S]*?<\/a:t>/g, () => {
      if (!replacedFirst) {
        replacedFirst = true;
        return `<a:t>${escapeXml(newText)}</a:t>`;
      }
      return '<a:t></a:t>';
    });
  } else {
    updatedCell = targetCell.replace(
      /<a:p\b[^>]*>/,
      `$&<a:r><a:t>${escapeXml(newText)}</a:t></a:r>`
    );
  }

  let cellIdx = 0;
  const updatedRow = targetRow.replace(tcRegex, (m) =>
    cellIdx++ === colIndex ? updatedCell : m
  );

  let rIdx = 0;
  return slideXml.replace(trRegex, (m) => (rIdx++ === rowIndex ? updatedRow : m));
}

export async function generateFilledPptx(data: ExtractionResult): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'templates', PPTX_TEMPLATE);
  const templateBuf = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuf);

  const groupName = data.groupName || 'Harborview Consulting Group, Inc.';
  const medPlans: MedicalPlan[] = data.medicalPlans || [];
  const ancList: AncillaryCoverage[] = data.ancillaryCoverages || [];

  // Slide 1: Replace group name if changed
  const s1Path = 'ppt/slides/slide1.xml';
  if (zip.file(s1Path)) {
    let s1 = await zip.file(s1Path)!.async('string');
    s1 = s1.replace(/Harborview Consulting Group, Inc\./g, escapeXml(groupName));
    zip.file(s1Path, s1);
  }

  // Slide 7: Marketing Results (UHC Renewal & Surest)
  const s7Path = 'ppt/slides/slide7.xml';
  if (zip.file(s7Path) && medPlans.length > 0) {
    let s7 = await zip.file(s7Path)!.async('string');
    const renPpo = medPlans[2];
    const surest = medPlans[4];
    if (renPpo?.monthlyCostRenewal != null) {
      s7 = updateTableCell(s7, 1, 4, fmtCurrency(renPpo.monthlyCostRenewal));
      const pct = fmtPct(renPpo.monthlyCostCurrent, renPpo.monthlyCostRenewal);
      if (pct !== '—') s7 = updateTableCell(s7, 1, 5, `Baseline – ${pct}`);
    }
    if (surest?.monthlyCostRenewal != null) {
      s7 = updateTableCell(s7, 2, 4, fmtCurrency(surest.monthlyCostRenewal));
    }
    zip.file(s7Path, s7);
  }

  // Slide 8: Medical Plan Comparison (Current PPO, Renewal PPO, Current HSA, Renewal HSA, Surest)
  const s8Path = 'ppt/slides/slide8.xml';
  if (zip.file(s8Path) && medPlans.length > 0) {
    let s8 = await zip.file(s8Path)!.async('string');
    // Map Slide 8 columns (1..5): [EKPU(0), EY8B(2), EKPA(1), EZCD(3), Surest(4)]
    const colPlans: (MedicalPlan | undefined)[] = [
      medPlans[0],
      medPlans[2],
      medPlans[1],
      medPlans[3],
      medPlans[4],
    ];
    colPlans.forEach((plan, i) => {
      if (!plan) return;
      const col = i + 1;
      if (plan.deductibleInNetwork) s8 = updateTableCell(s8, 2, col, plan.deductibleInNetwork);
      if (plan.oopMaxInNetwork) s8 = updateTableCell(s8, 3, col, plan.oopMaxInNetwork);
      if (plan.officeCopay) s8 = updateTableCell(s8, 4, col, plan.officeCopay);
      if (plan.urgentCareEr) s8 = updateTableCell(s8, 5, col, plan.urgentCareEr);
    });
    zip.file(s8Path, s8);
  }

  // Slide 14: Ancillary Renewal Table
  const s14Path = 'ppt/slides/slide14.xml';
  if (zip.file(s14Path) && ancList.length > 0) {
    let s14 = await zip.file(s14Path)!.async('string');
    const rowMatchers: [number, RegExp][] = [
      [1, /dental.*low/i],
      [2, /dental.*high/i],
      [3, /vision/i],
      [4, /group term life/i],
      [5, /short term/i],
    ];
    for (const [rowIdx, regex] of rowMatchers) {
      const cov = ancList.find((c) => regex.test(c.lineOfCoverage));
      if (!cov) continue;
      if (cov.volumeOrLives) s14 = updateTableCell(s14, rowIdx, 1, cov.volumeOrLives);
      s14 = updateTableCell(s14, rowIdx, 2, fmtCurrency(cov.currentMonthlyPremium));
      s14 = updateTableCell(s14, rowIdx, 3, fmtCurrency(cov.renewalMonthlyPremium));
      if (cov.renewalMonthlyPremium != null) {
        s14 = updateTableCell(s14, rowIdx, 4, fmtCurrency(cov.renewalMonthlyPremium * 12));
      }
      s14 = updateTableCell(
        s14,
        rowIdx,
        5,
        fmtPct(cov.currentMonthlyPremium, cov.renewalMonthlyPremium)
      );
    }
    zip.file(s14Path, s14);
  }

  // Slide 19: Master Cost Summary
  const s19Path = 'ppt/slides/slide19.xml';
  if (zip.file(s19Path) && medPlans.length > 0) {
    let s19 = await zip.file(s19Path)!.async('string');
    const currPlan = medPlans[0];
    const renPlan = medPlans[2];
    const surest = medPlans[4];
    if (currPlan) {
      s19 = updateTableCell(s19, 1, 2, currPlan.deductibleInNetwork || '—');
      s19 = updateTableCell(s19, 1, 3, currPlan.oopMaxInNetwork || '—');
      s19 = updateTableCell(s19, 1, 6, fmtCurrency(currPlan.monthlyCostCurrent));
      s19 = updateTableCell(s19, 1, 7, fmtCurrency(currPlan.annualCostCurrent));
    }
    if (renPlan) {
      s19 = updateTableCell(s19, 2, 2, renPlan.deductibleInNetwork || '—');
      s19 = updateTableCell(s19, 2, 3, renPlan.oopMaxInNetwork || '—');
      s19 = updateTableCell(s19, 2, 6, fmtCurrency(renPlan.monthlyCostRenewal));
      s19 = updateTableCell(s19, 2, 7, fmtCurrency(renPlan.annualCostRenewal));
    }
    if (surest) {
      s19 = updateTableCell(s19, 3, 2, surest.deductibleInNetwork || '—');
      s19 = updateTableCell(s19, 3, 3, surest.oopMaxInNetwork || '—');
      s19 = updateTableCell(s19, 3, 6, fmtCurrency(surest.monthlyCostRenewal));
      s19 = updateTableCell(s19, 3, 7, fmtCurrency(surest.annualCostRenewal));
    }
    zip.file(s19Path, s19);
  }

  const out = await zip.generateAsync({ type: 'nodebuffer' });
  return out;
}
