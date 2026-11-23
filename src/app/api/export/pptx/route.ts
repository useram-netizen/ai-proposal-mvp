import { NextRequest, NextResponse } from 'next/server';
import { generateFilledPptx } from '@/lib/pptxExporter';
import type { ExtractionResult } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as ExtractionResult;
    if (!data || (!data.medicalPlans?.length && !data.ancillaryCoverages?.length)) {
      return NextResponse.json(
        { error: 'No extracted plan data provided for PowerPoint export.' },
        { status: 400 }
      );
    }

    const buffer = await generateFilledPptx(data);
    const safeName = (data.groupName || 'Renewal_Proposal')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${safeName}_Proposal.pptx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PowerPoint export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
