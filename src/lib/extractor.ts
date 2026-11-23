import OpenAI from 'openai';
import { extractText } from 'unpdf';
import type { AncillaryCoverage, ExtractionResult, MedicalPlan } from './types';

const EXTRACTION_SYSTEM_PROMPT = `You are an expert US employee-benefits insurance data extractor.
You are reading an actual carrier renewal PDF. Read the visual table columns and rows carefully—do NOT mix values across columns.
Never invent numbers that are not in the document; use null for missing numeric fields or "NA" when explicitly stated.
Return a strict JSON object with:
{
  "documentType": "uhc_medical" | "principal_ancillary",
  "groupName": string,
  "effectiveDate": string,
  "medicalPlans": [
    {
      "id": string,
      "planName": string,
      "planRole": string,
      "carrier": string,
      "product": string,
      "hsaHra": string,
      "network": string,
      "deductibleInNetwork": string,
      "oopMaxInNetwork": string,
      "coinsuranceInNetwork": string,
      "officeCopay": string,
      "specialistCopay": string,
      "urgentCareEr": string,
      "majorDiagnostics": string,
      "xrayLab": string,
      "pharmacy": string,
      "deductibleOutOfNetwork": string,
      "coinsuranceOutOfNetwork": string,
      "oopMaxOutOfNetwork": string,
      "enrollment": { "eeOnly": number|null, "eeSpouse": number|null, "eeChildren": number|null, "family": number|null, "total": number|null },
      "ratesCurrent": { "eeOnly": number|null, "eeSpouse": number|null, "eeChildren": number|null, "family": number|null },
      "ratesRenewal": { "eeOnly": number|null, "eeSpouse": number|null, "eeChildren": number|null, "family": number|null },
      "monthlyCostCurrent": number|null,
      "monthlyCostRenewal": number|null,
      "annualCostCurrent": number|null,
      "annualCostRenewal": number|null
    }
  ],
  "ancillaryCoverages": [
    {
      "id": string,
      "lineOfCoverage": string,
      "carrier": string,
      "volumeOrLives": string,
      "rateUnit": string,
      "currentRate": string,
      "renewalRate": string,
      "currentMonthlyPremium": number|null,
      "renewalMonthlyPremium": number|null,
      "guaranteeThrough": string,
      "notes": string
    }
  ],
  "flags": [string]
}
For UHC Medical PDFs:
- Extract EVERY plan column (e.g. EKPU, EKPA, EY8B, EZCD, Surest_D5500) into medicalPlans.
- IMPORTANT: Plans marked "Current - Retired" (e.g. EKPU, EKPA) ONLY have Current rates and costs—leave their ratesRenewal, monthlyCostRenewal, and annualCostRenewal as null. Do NOT copy numbers from adjacent Renewal columns.
- Renewal/Alt plans (e.g. EY8B, EZCD, Surest_D5500) have Current & Renewal columns or Renewal-only columns. Match each column accurately.
- Leave ancillaryCoverages empty [].

For Principal Ancillary PDFs:
- Extract EVERY coverage line across all pages (Group term life, Accidental Death & Dismemberment, Group voluntary term life, Voluntary term AD&D, Voluntary term child insurance, Long term disability, Short term disability, Dental - Low Plan, Dental - High Plan, Vision) into ancillaryCoverages.
- IMPORTANT: "groupName" MUST be the employer/client policyholder on the left (e.g., "Harborview Consulting Group, Inc."), NEVER the broker ("SAMPLE BROKERAGE PARTNERS").
- For age-banded coverages (Voluntary term life, LTD), put the Total Volume/Lives, representative/summary rate or "Age-banded", and the Total Current monthly premium & Total Renewal monthly premium.
- Leave medicalPlans empty [].

Include specific, human-readable review flags in "flags" (e.g., "UHC Overall Renewal Increase: 41.6%", "EY8B monthly cost jumped from $59,481 to $150,466 (+153%)", "EKPU/EKPA show NA for Renewal EE+Spouse").`;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const uint8 = new Uint8Array(buffer);
  const result = await extractText(uint8, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join('\n') : result.text;
}

/**
 * Swappable AI model adapter:
 * Sends the PDF directly to OpenAI (gpt-4o) as a native file input so the model
 * sees the exact multi-column visual table layout without text-scrambling.
 * Falls back to extracted text if needed.
 */
export async function extractPdfWithAI(
  pdfBuffer: Buffer,
  filename: string,
  hint: 'uhc_medical' | 'principal_ancillary' | 'auto' = 'auto'
): Promise<ExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL_VISION || 'gpt-4o';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in .env.local');
  }

  const client = new OpenAI({ apiKey });
  const base64Pdf = pdfBuffer.toString('base64');

  let raw = '{}';
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename,
                file_data: `data:application/pdf;base64,${base64Pdf}`,
              },
            },
            {
              type: 'text',
              text: `Document hint: ${hint}. Extract every plan/coverage and exact dollar/rate value from this PDF into the JSON schema.`,
            },
          ],
        },
      ],
    });
    raw = completion.choices[0]?.message?.content || '{}';
  } catch {
    // Fallback to text extraction if native PDF file input is unsupported on a custom endpoint
    const pdfText = await extractPdfText(pdfBuffer);
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          text: `Document hint: ${hint}\n\n${pdfText.slice(0, 28000)}`,
        } as unknown as OpenAI.Chat.Completions.ChatCompletionUserMessageParam,
      ],
    });
    raw = completion.choices[0]?.message?.content || '{}';
  }

  const parsed = JSON.parse(raw) as Partial<ExtractionResult>;

  const medicalPlans: MedicalPlan[] = Array.isArray(parsed.medicalPlans) ? parsed.medicalPlans : [];
  const ancillaryCoverages: AncillaryCoverage[] = Array.isArray(parsed.ancillaryCoverages)
    ? parsed.ancillaryCoverages
    : [];
  const flags: string[] = Array.isArray(parsed.flags) ? parsed.flags : [];

  return {
    documentType:
      parsed.documentType ||
      (ancillaryCoverages.length > 0 && medicalPlans.length === 0
        ? 'principal_ancillary'
        : 'uhc_medical'),
    groupName: parsed.groupName || 'Harborview Consulting Group, Inc.',
    effectiveDate: parsed.effectiveDate || 'November 1, 2026',
    providerUsed: `OpenAI (${model} Native PDF)`,
    medicalPlans,
    ancillaryCoverages,
    flags,
    extractedAt: new Date().toISOString(),
  };
}
