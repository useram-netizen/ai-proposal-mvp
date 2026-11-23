export interface MedicalPlan {
  id: string;
  planName: string;
  planRole: string; // e.g. "Current - Retired", "Renewal - Replace EKPU", "Alt 1 - Replace All"
  carrier: string;
  product: string;
  hsaHra: string;
  network: string;
  deductibleInNetwork: string;
  oopMaxInNetwork: string;
  coinsuranceInNetwork: string;
  officeCopay: string;
  specialistCopay: string;
  urgentCareEr: string;
  majorDiagnostics: string;
  xrayLab: string;
  pharmacy: string;
  deductibleOutOfNetwork: string;
  coinsuranceOutOfNetwork: string;
  oopMaxOutOfNetwork: string;
  enrollment: {
    eeOnly: number | null;
    eeSpouse: number | null;
    eeChildren: number | null;
    family: number | null;
    total: number | null;
  };
  ratesCurrent: {
    eeOnly: number | null;
    eeSpouse: number | null;
    eeChildren: number | null;
    family: number | null;
  };
  ratesRenewal: {
    eeOnly: number | null;
    eeSpouse: number | null;
    eeChildren: number | null;
    family: number | null;
  };
  monthlyCostCurrent: number | null;
  monthlyCostRenewal: number | null;
  annualCostCurrent: number | null;
  annualCostRenewal: number | null;
}

export interface AncillaryCoverage {
  id: string;
  lineOfCoverage: string; // e.g. "Dental – PPO Low", "Dental – PPO High", "Vision", "Group Term Life", "AD&D", "STD", "LTD"
  carrier: string;
  volumeOrLives: string;
  rateUnit: string;
  currentRate: string;
  renewalRate: string;
  currentMonthlyPremium: number | null;
  renewalMonthlyPremium: number | null;
  guaranteeThrough: string;
  notes: string;
}

export interface ExtractionResult {
  documentType: 'uhc_medical' | 'principal_ancillary' | 'combined';
  groupName: string;
  effectiveDate: string;
  providerUsed: string;
  medicalPlans: MedicalPlan[];
  ancillaryCoverages: AncillaryCoverage[];
  flags: string[];
  extractedAt: string;
}
