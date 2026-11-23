import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const templatesDir = path.join(process.cwd(), 'templates');
  let templates: { name: string; sizeBytes: number }[] = [];

  try {
    if (fs.existsSync(templatesDir)) {
      templates = fs.readdirSync(templatesDir).map((name) => {
        const stats = fs.statSync(path.join(templatesDir, name));
        return { name, sizeBytes: stats.size };
      });
    }
  } catch {
    templates = [];
  }

  return NextResponse.json({
    status: 'ok',
    service: 'AI Renewal & Proposal Automation MVP',
    templatesCount: templates.length,
    templates,
    timestamp: new Date().toISOString(),
  });
}
