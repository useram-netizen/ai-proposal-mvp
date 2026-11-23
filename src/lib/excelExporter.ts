import path from 'path';
import XlsxPopulate from 'xlsx-populate';
import type { ExtractionResult, MedicalPlan } from './types';

const EXCEL_TEMPLATE = 'Sample_Renewal_Comparison_Template-1381a7a6.xlsx';

function setIfPresent(
  sheet: ReturnType<Awaited<ReturnType<typeof XlsxPopulate.fromFileAsync>>['sheet']>,
  cellAddr: string,
  val: string | number | null | undefined
) {
  if (val !== null && val !== undefined && val !== '') {
    sheet.cell(cellAddr).value(val);
  }
}

function writeMedicalColumn(
  sheet: ReturnType<Awaited<ReturnType<typeof XlsxPopulate.fromFileAsync>>['sheet']>,
  col: string,
  totalCol: string,
  plan: MedicalPlan | undefined,
  useRenewalRates: boolean
) {
  if (!plan) return;
  setIfPresent(sheet, `${col}3`, plan.planName);
  setIfPresent(sheet, `${col}4`, plan.network || plan.product);
  setIfPresent(sheet, `${col}7`, plan.deductibleInNetwork);
  setIfPresent(sheet, `${col}8`, plan.oopMaxInNetwork);
  setIfPresent(sheet, `${col}10`, plan.officeCopay);
  setIfPresent(sheet, `${col}11`, plan.specialistCopay);
  setIfPresent(sheet, `${col}12`, plan.urgentCareEr);
  setIfPresent(sheet, `${col}14`, plan.xrayLab);
  setIfPresent(sheet, `${col}15`, plan.majorDiagnostics);
  setIfPresent(sheet, `${col}20`, plan.deductibleOutOfNetwork);
  setIfPresent(sheet, `${col}21`, plan.oopMaxOutOfNetwork);
  setIfPresent(sheet, `${col}22`, plan.coinsuranceOutOfNetwork);
  setIfPresent(sheet, `${col}24`, plan.pharmacy);

  const rates = useRenewalRates ? plan.ratesRenewal : plan.ratesCurrent;
  setIfPresent(sheet, `${col}30`, rates?.eeOnly ?? null);
  setIfPresent(sheet, `${col}31`, rates?.eeSpouse ?? null);
  setIfPresent(sheet, `${col}32`, rates?.eeChildren ?? null);
  setIfPresent(sheet, `${col}33`, rates?.family ?? null);

  const monthly = useRenewalRates ? plan.monthlyCostRenewal : plan.monthlyCostCurrent;
  const annual = useRenewalRates ? plan.annualCostRenewal : plan.annualCostCurrent;
  setIfPresent(sheet, `${totalCol}35`, monthly ?? null);
  setIfPresent(sheet, `${totalCol}36`, annual ?? null);
}

export async function generateFilledExcel(data: ExtractionResult): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'templates', EXCEL_TEMPLATE);
  const workbook = await XlsxPopulate.fromFileAsync(templatePath);

  // 1. Populate Medical Sheet
  const medSheet = workbook.sheet('Medical');
  if (medSheet) {
    setIfPresent(medSheet, 'A1', `${data.groupName}\nRENEWAL PROPOSAL`);
    setIfPresent(medSheet, 'O1', `UHC RENEWAL EFFECTIVE\n${data.effectiveDate}`);

    const plans = data.medicalPlans || [];
    // Columns C (Current Opt 1), G (Current Opt 2), K (Renewal Opt 1), O (Renewal Opt 2)
    writeMedicalColumn(medSheet, 'C', 'E', plans[0], false);
    writeMedicalColumn(medSheet, 'G', 'I', plans[1], false);
    writeMedicalColumn(medSheet, 'K', 'M', plans[2], true);
    writeMedicalColumn(medSheet, 'O', 'Q', plans[3], true);
  }

  // 2. Populate Ancillary Sheet
  const ancSheet = workbook.sheet('Ancillary');
  if (ancSheet) {
    setIfPresent(ancSheet, 'A1', `${data.groupName}\nRENEWAL PROPOSAL`);
    setIfPresent(ancSheet, 'O1', `EFFECTIVE: ${data.effectiveDate}`);

    const findCov = (keyword: string) =>
      data.ancillaryCoverages.find((c) =>
        c.lineOfCoverage.toLowerCase().includes(keyword.toLowerCase())
      );

    const dentalLow = findCov('dental') && data.ancillaryCoverages.find((c) => /dental.*low/i.test(c.lineOfCoverage));
    const dentalHigh = data.ancillaryCoverages.find((c) => /dental.*high/i.test(c.lineOfCoverage));
    const vision = findCov('vision');
    const life = data.ancillaryCoverages.find((c) => /group term life/i.test(c.lineOfCoverage));
    const add = data.ancillaryCoverages.find((c) => /accidental death/i.test(c.lineOfCoverage) && !/voluntary/i.test(c.lineOfCoverage));
    const std = findCov('short term');

    if (dentalLow) {
      setIfPresent(ancSheet, 'E22', dentalLow.currentMonthlyPremium);
      setIfPresent(ancSheet, 'M22', dentalLow.renewalMonthlyPremium);
    }
    if (dentalHigh) {
      setIfPresent(ancSheet, 'I22', dentalHigh.currentMonthlyPremium);
      setIfPresent(ancSheet, 'Q22', dentalHigh.renewalMonthlyPremium);
    }
    if (vision) {
      setIfPresent(ancSheet, 'H40', vision.currentMonthlyPremium);
      setIfPresent(ancSheet, 'P40', vision.renewalMonthlyPremium);
    }
    if (life) {
      setIfPresent(ancSheet, 'C46', life.currentRate);
      setIfPresent(ancSheet, 'K46', life.renewalRate);
    }
    if (add) {
      setIfPresent(ancSheet, 'C47', add.currentRate);
      setIfPresent(ancSheet, 'K47', add.renewalRate);
    }
    if (std) {
      setIfPresent(ancSheet, 'C58', std.currentRate);
      setIfPresent(ancSheet, 'K58', std.renewalRate);
    }
  }

  return await workbook.outputAsync();
}
