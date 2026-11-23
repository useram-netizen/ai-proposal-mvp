import { NextRequest, NextResponse } from 'next/server';
import { generateFilledExcel } from '@/lib/excelExporter';
import type { ExtractionResult } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as ExtractionResult;
    if (!data || (!data.medicalPlans?.length && !data.ancillaryCoverages?.length)) {
      return NextResponse.json(
        { error: 'No extracted plan data provided for Excel export.' },
        { status: 400 }
      );
    }

    const buffer = await generateFilledExcel(data);
    const safeName = (data.groupName || 'Renewal_Comparison')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}_Comparison.xlsx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Excel export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
