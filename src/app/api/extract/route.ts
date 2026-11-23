import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { extractPdfWithAI } from '@/lib/extractor';
import type { ExtractionResult } from '@/lib/types';

export const maxDuration = 60;

const SAMPLE_UHC = 'Sample_UHC_Medical_Renewal_FICTIONAL-a83e1611.pdf';
const SAMPLE_PRINCIPAL = 'Sample_Principal_Renewal_Letter_FICTIONAL-f875fbc6 (1).pdf';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'No PDF file provided.' }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await extractPdfWithAI(buffer, file.name, 'auto');
      return NextResponse.json(result);
    }

    const body = (await req.json().catch(() => ({}))) as {
      sample?: 'uhc' | 'principal' | 'both';
    };
    const sample = body.sample || 'both';
    const templatesDir = path.join(process.cwd(), 'templates');

    if (sample === 'uhc') {
      const buf = fs.readFileSync(path.join(templatesDir, SAMPLE_UHC));
      const result = await extractPdfWithAI(buf, SAMPLE_UHC, 'uhc_medical');
      return NextResponse.json(result);
    }

    if (sample === 'principal') {
      const buf = fs.readFileSync(path.join(templatesDir, SAMPLE_PRINCIPAL));
      const result = await extractPdfWithAI(buf, SAMPLE_PRINCIPAL, 'principal_ancillary');
      return NextResponse.json(result);
    }

    const uhcBuf = fs.readFileSync(path.join(templatesDir, SAMPLE_UHC));
    const prinBuf = fs.readFileSync(path.join(templatesDir, SAMPLE_PRINCIPAL));

    const [uhcRes, prinRes] = await Promise.all([
      extractPdfWithAI(uhcBuf, SAMPLE_UHC, 'uhc_medical'),
      extractPdfWithAI(prinBuf, SAMPLE_PRINCIPAL, 'principal_ancillary'),
    ]);

    const combined: ExtractionResult = {
      documentType: 'combined',
      groupName: prinRes.groupName || uhcRes.groupName,
      effectiveDate: uhcRes.effectiveDate || prinRes.effectiveDate,
      providerUsed: uhcRes.providerUsed,
      medicalPlans: uhcRes.medicalPlans,
      ancillaryCoverages: prinRes.ancillaryCoverages,
      flags: [...uhcRes.flags, ...prinRes.flags],
      extractedAt: new Date().toISOString(),
    };

    return NextResponse.json(combined);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
