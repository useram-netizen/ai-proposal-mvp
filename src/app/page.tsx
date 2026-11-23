'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AncillaryCoverage, ExtractionResult, MedicalPlan } from '@/lib/types';

interface TemplateInfo {
  name: string;
  sizeBytes: number;
}

interface HealthResponse {
  status: string;
  service: string;
  templatesCount: number;
  templates: TemplateInfo[];
}

type FilterMode = 'all' | 'increased' | 'decreased' | 'missing';
type ActiveTab = 'medical' | 'ancillary' | 'json';

function calcPctChange(current: number | null | undefined, renewal: number | null | undefined): number | null {
  if (current == null || renewal == null || current === 0) return null;
  return ((renewal - current) / current) * 100;
}

function ChangeBadge({ current, renewal }: { current: number | null | undefined; renewal: number | null | undefined }) {
  const pct = calcPctChange(current, renewal);
  if (pct === null) {
    if (renewal != null && current == null) {
      return (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#2D5BFF]">
          New Option
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        No Renewal / NA
      </span>
    );
  }
  if (Math.abs(pct) < 0.05) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        0.0% Flat
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        ▲ +{pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      ▼ {pct.toFixed(1)}%
    </span>
  );
}

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractStage, setExtractStage] = useState(0);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('medical');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [editMode, setEditMode] = useState(false);
  const [approved, setApproved] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!extracting) {
      setExtractStage(0);
      return;
    }
    const t1 = setTimeout(() => setExtractStage(1), 1500);
    const t2 = setTimeout(() => setExtractStage(2), 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [extracting]);

  async function runSampleExtraction(sample: 'both' | 'uhc' | 'principal') {
    setExtracting(true);
    setExtractError(null);
    setApproved(false);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      setExtraction(data);
      if (data.medicalPlans?.length === 0 && data.ancillaryCoverages?.length > 0) {
        setActiveTab('ancillary');
      } else {
        setActiveTab('medical');
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setExtractError(null);
    setApproved(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload extraction failed');
      setExtraction(data);
      setActiveTab(data.medicalPlans?.length ? 'medical' : 'ancillary');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Upload extraction failed');
    } finally {
      setExtracting(false);
      e.target.value = '';
    }
  }

  async function handleDownloadExcel() {
    if (!extraction) return;
    setExportingExcel(true);
    setExtractError(null);
    try {
      const res = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extraction),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Excel export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Harborview_Renewal_Comparison.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Excel export failed');
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleDownloadPptx() {
    if (!extraction) return;
    setExportingPptx(true);
    setExtractError(null);
    try {
      const res = await fetch('/api/export/pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extraction),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'PowerPoint export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Harborview_Renewal_Proposal.pptx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'PowerPoint export failed');
    } finally {
      setExportingPptx(false);
    }
  }

  function updateMedicalField(planIndex: number, field: keyof MedicalPlan, value: string) {
    if (!extraction) return;
    setApproved(false);
    const updated = [...extraction.medicalPlans];
    const target = { ...updated[planIndex] };
    if (field === 'monthlyCostCurrent' || field === 'monthlyCostRenewal') {
      const num = value.trim() === '' ? null : Number(value.replace(/[^0-9.-]/g, ''));
      target[field] = Number.isNaN(num) ? null : num;
    } else {
      (target[field] as string) = value;
    }
    updated[planIndex] = target;
    setExtraction({ ...extraction, medicalPlans: updated });
  }

  function updateAncillaryField(
    idx: number,
    field: keyof AncillaryCoverage,
    value: string
  ) {
    if (!extraction) return;
    setApproved(false);
    const updated = [...extraction.ancillaryCoverages];
    const target = { ...updated[idx] };
    if (field === 'currentMonthlyPremium' || field === 'renewalMonthlyPremium') {
      const num = value.trim() === '' ? null : Number(value.replace(/[^0-9.-]/g, ''));
      target[field] = Number.isNaN(num) ? null : num;
    } else {
      (target[field] as string) = value;
    }
    updated[idx] = target;
    setExtraction({ ...extraction, ancillaryCoverages: updated });
  }

  const ancillaryTotals = useMemo(() => {
    if (!extraction) return { current: 0, renewal: 0 };
    return extraction.ancillaryCoverages.reduce(
      (acc, c) => ({
        current: acc.current + (c.currentMonthlyPremium ?? 0),
        renewal: acc.renewal + (c.renewalMonthlyPremium ?? 0),
      }),
      { current: 0, renewal: 0 }
    );
  }, [extraction]);

  const filteredMedical = useMemo(() => {
    if (!extraction) return [];
    return extraction.medicalPlans
      .map((plan, idx) => ({ plan, idx }))
      .filter(({ plan }) => {
        const pct = calcPctChange(plan.monthlyCostCurrent, plan.monthlyCostRenewal);
        if (filterMode === 'increased') return pct !== null && pct > 0;
        if (filterMode === 'decreased') return pct !== null && pct < 0;
        if (filterMode === 'missing') {
          return (
            plan.monthlyCostRenewal == null ||
            plan.monthlyCostCurrent == null ||
            !plan.deductibleInNetwork
          );
        }
        return true;
      });
  }, [extraction, filterMode]);

  const filteredAncillary = useMemo(() => {
    if (!extraction) return [];
    return extraction.ancillaryCoverages
      .map((cov, idx) => ({ cov, idx }))
      .filter(({ cov }) => {
        const pct = calcPctChange(cov.currentMonthlyPremium, cov.renewalMonthlyPremium);
        if (filterMode === 'increased') return pct !== null && pct > 0;
        if (filterMode === 'decreased') return pct !== null && pct < 0;
        if (filterMode === 'missing') {
          return cov.currentMonthlyPremium == null || cov.renewalMonthlyPremium == null;
        }
        return true;
      });
  }, [extraction, filterMode]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F7FB] text-[#0F172A]">
      {/* Top Banner */}
      <div className="border-b border-slate-800 bg-[#0B1528] px-4 py-2 text-center text-xs text-slate-300">
        Interactive MVP for Employee Benefits Renewal Automation &bull; Synthetic sample data (UHC Medical &amp; Principal Ancillary)
      </div>

      <div className="flex flex-1">
        {/* Midnight Navy Sidebar */}
        <aside className="hidden w-64 flex-col justify-between bg-[#0B1528] p-4 text-slate-300 md:flex">
          <div>
            <div className="mb-8 flex items-center gap-3 px-2 pt-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2D5BFF] text-base font-bold text-white shadow">
                C
              </div>
              <div>
                <div className="text-sm font-bold text-white">Cosmo</div>
                <div className="text-[11px] text-slate-400">Renewal Automation MVP</div>
              </div>
            </div>

            <nav className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-slate-300">
                <span>1. AI Extraction</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Done
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#1A2742] px-3 py-2.5 font-medium text-white">
                <span>2. Plan Comparison</span>
                <span className="rounded-full bg-[#14B8A6]/20 px-2 py-0.5 text-[10px] font-semibold text-[#2DD4BF]">
                  STEP 3
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-slate-400">
                <span>3. Excel &amp; PPTX Export</span>
                <span className="text-[10px] text-slate-500">Steps 4–5</span>
              </div>
            </nav>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#111E36] p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
                JE
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Jordan Ellis</div>
                <div className="text-[11px] text-slate-400">Benefits Advisor</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">
                Renewal Intake, Comparison &amp; Review
              </h1>
              <p className="text-xs text-slate-500">
                Extract UHC &amp; Principal PDFs, review increases/decreases, edit inline, and approve
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium">
              <span className={`h-2 w-2 rounded-full ${health ? 'bg-[#10B981]' : 'bg-amber-400'}`} />
              <span className={health ? 'text-emerald-700' : 'text-slate-600'}>
                {health ? `API Connected (${health.templatesCount} templates)` : 'Connecting...'}
              </span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">
            {/* Action Card */}
            <div className="rounded-2xl bg-[#0F1C36] p-6 text-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-[#2DD4BF] uppercase">
                    Live OpenAI Extraction &bull; Side-by-Side Comparison
                  </span>
                  <h2 className="mt-1 text-xl font-bold">
                    Load Carrier Renewal Quotes
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Run 1-click extraction on both bundled fictional PDFs or upload any carrier PDF.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => runSampleExtraction('both')}
                    disabled={extracting}
                    className="rounded-lg bg-[#2D5BFF] px-4 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-blue-600 disabled:opacity-50"
                  >
                    {extracting ? 'Extracting with AI...' : '1-Click Extract UHC + Principal'}
                  </button>
                  <button
                    onClick={() => runSampleExtraction('uhc')}
                    disabled={extracting}
                    className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    UHC Only
                  </button>
                  <button
                    onClick={() => runSampleExtraction('principal')}
                    disabled={extracting}
                    className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Principal Only
                  </button>
                  <label className="cursor-pointer rounded-lg bg-[#14B8A6] px-3.5 py-2.5 text-xs font-semibold text-white shadow hover:bg-teal-600">
                    Upload PDF
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      disabled={extracting}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {extracting && (
              <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2D5BFF] border-t-transparent" />
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">
                      Processing Carrier Renewal Documents...
                    </div>
                    <div className="text-xs text-slate-500">
                      Usually takes 8–12 seconds with OpenAI gpt-4o Native PDF Vision
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    '1. Reading UHC & Principal PDFs',
                    '2. Extracting plans, rates & benefits',
                    '3. Comparing changes & flagging outliers',
                  ].map((label, i) => {
                    const done = extractStage > i;
                    const active = extractStage === i;
                    return (
                      <div
                        key={label}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          done
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : active
                              ? 'border-blue-200 bg-blue-50 text-[#2D5BFF]'
                              : 'border-slate-100 bg-slate-50 text-slate-400'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            done
                              ? 'bg-emerald-500'
                              : active
                                ? 'animate-pulse bg-[#2D5BFF]'
                                : 'bg-slate-300'
                          }`}
                        />
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {extractError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Extraction Error:</strong> {extractError}
              </div>
            )}

            {extraction && (
              <div className="space-y-5">
                {/* KPI Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Client / Group
                    </span>
                    <div className="mt-1 truncate text-base font-bold text-[#0F172A]">
                      {extraction.groupName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Effective {extraction.effectiveDate}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Medical Plans
                    </span>
                    <div className="mt-1 text-2xl font-bold text-[#2D5BFF]">
                      {extraction.medicalPlans.length}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {extraction.providerUsed}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Ancillary Monthly Total
                    </span>
                    <div className="mt-1 flex items-center gap-2 text-lg font-bold text-[#0F172A]">
                      <span>${ancillaryTotals.renewal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <ChangeBadge current={ancillaryTotals.current} renewal={ancillaryTotals.renewal} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      vs. ${ancillaryTotals.current.toLocaleString(undefined, { maximumFractionDigits: 0 })} current ({extraction.ancillaryCoverages.length} lines)
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Approval &amp; Export
                    </span>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() => setApproved((v) => !v)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${
                          approved
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-[#2D5BFF] hover:bg-blue-600'
                        }`}
                      >
                        {approved ? 'Approved ✓' : 'Approve'}
                      </button>
                      <button
                        onClick={handleDownloadExcel}
                        disabled={exportingExcel}
                        className="rounded-lg bg-[#14B8A6] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:opacity-50"
                      >
                        {exportingExcel ? 'Building...' : 'Excel (.xlsx)'}
                      </button>
                      <button
                        onClick={handleDownloadPptx}
                        disabled={exportingPptx}
                        className="rounded-lg bg-[#0B1528] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        {exportingPptx ? 'Building...' : 'Slides (.pptx)'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Flags */}
                {extraction.flags.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h3 className="text-xs font-semibold tracking-wider text-amber-800 uppercase">
                      AI Review Flags ({extraction.flags.length})
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
                      {extraction.flags.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tabs + Increase/Decrease Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('medical')}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                        activeTab === 'medical'
                          ? 'bg-[#2D5BFF] text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Medical Side-by-Side ({extraction.medicalPlans.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('ancillary')}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                        activeTab === 'ancillary'
                          ? 'bg-[#2D5BFF] text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Ancillary Renewal ({extraction.ancillaryCoverages.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('json')}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                        activeTab === 'json'
                          ? 'bg-[#0B1528] text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Raw JSON
                    </button>
                  </div>

                  {activeTab !== 'json' && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="mr-1 font-medium text-slate-400">Filter:</span>
                      {(
                        [
                          ['all', 'All'],
                          ['increased', '▲ Increased'],
                          ['decreased', '▼ Decreased'],
                          ['missing', 'Missing / NA'],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          onClick={() => setFilterMode(mode)}
                          className={`rounded-full px-3 py-1 font-medium transition ${
                            filterMode === mode
                              ? 'bg-[#0B1528] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Medical Side-by-Side Comparison Matrix */}
                {activeTab === 'medical' && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-[#0F172A]">
                          Medical Plan Side-by-Side Comparison
                        </h3>
                        <p className="text-xs text-slate-500">
                          Extracted from UHC Medical PDF &bull; Ready for Excel &amp; PowerPoint export.
                        </p>
                      </div>
                      <button
                        onClick={() => setEditMode((v) => !v)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          editMode
                            ? 'border-[#2D5BFF] bg-blue-50 text-[#2D5BFF]'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {editMode ? 'Done Editing' : 'Edit Values'}
                      </button>
                    </div>

                    {filteredMedical.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">
                        No medical plans match the selected filter.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full table-fixed border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="w-40 px-3 py-2.5 font-semibold text-slate-600">
                                Plan Attribute
                              </th>
                              {filteredMedical.map(({ plan, idx }) => (
                                <th key={plan.id || idx} className="px-3 py-2.5 align-top">
                                  <div className="font-bold text-[#0F172A]">{plan.planName}</div>
                                  <div className="mt-0.5 font-normal text-slate-500">{plan.planRole}</div>
                                  <div className="mt-1">
                                    <ChangeBadge
                                      current={plan.monthlyCostCurrent}
                                      renewal={plan.monthlyCostRenewal}
                                    />
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(
                              [
                                ['Deductible (In-Net)', 'deductibleInNetwork'],
                                ['OOP Max (In-Net)', 'oopMaxInNetwork'],
                                ['Coinsurance (In-Net)', 'coinsuranceInNetwork'],
                                ['Office Copay', 'officeCopay'],
                                ['Specialist Copay', 'specialistCopay'],
                                ['Urgent Care / ER', 'urgentCareEr'],
                                ['Pharmacy', 'pharmacy'],
                              ] as const
                            ).map(([label, field]) => (
                              <tr key={field} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-medium text-slate-600">{label}</td>
                                {filteredMedical.map(({ plan, idx }) => (
                                  <td key={idx} className="px-3 py-2 text-slate-800 break-words">
                                    {editMode ? (
                                      <input
                                        type="text"
                                        value={plan[field] ?? ''}
                                        onChange={(e) =>
                                          updateMedicalField(idx, field, e.target.value)
                                        }
                                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 focus:border-[#2D5BFF] focus:outline-none"
                                      />
                                    ) : (
                                      <span>{plan[field] || '—'}</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="bg-slate-50/60">
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                Current Monthly Cost
                              </td>
                              {filteredMedical.map(({ plan, idx }) => (
                                <td key={idx} className="px-3 py-2 font-semibold text-slate-800">
                                  {editMode ? (
                                    <input
                                      type="text"
                                      value={plan.monthlyCostCurrent ?? ''}
                                      placeholder="—"
                                      onChange={(e) =>
                                        updateMedicalField(idx, 'monthlyCostCurrent', e.target.value)
                                      }
                                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-800 focus:border-[#2D5BFF] focus:outline-none"
                                    />
                                  ) : plan.monthlyCostCurrent != null ? (
                                    `$${plan.monthlyCostCurrent.toLocaleString()}`
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-blue-50/40">
                              <td className="px-3 py-2 font-semibold text-[#2D5BFF]">
                                Renewal Monthly Cost
                              </td>
                              {filteredMedical.map(({ plan, idx }) => (
                                <td key={idx} className="px-3 py-2 font-semibold text-[#2D5BFF]">
                                  {editMode ? (
                                    <input
                                      type="text"
                                      value={plan.monthlyCostRenewal ?? ''}
                                      placeholder="—"
                                      onChange={(e) =>
                                        updateMedicalField(idx, 'monthlyCostRenewal', e.target.value)
                                      }
                                      className="w-full rounded border border-blue-300 bg-white px-2 py-1 font-semibold text-[#2D5BFF] focus:border-[#2D5BFF] focus:outline-none"
                                    />
                                  ) : plan.monthlyCostRenewal != null ? (
                                    `$${plan.monthlyCostRenewal.toLocaleString()}`
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Ancillary Renewal Table */}
                {activeTab === 'ancillary' && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-[#0F172A]">
                          Principal Ancillary Renewal Comparison
                        </h3>
                        <p className="text-xs text-slate-500">
                          Extracted from Principal Ancillary PDF &bull; % change badges update automatically.
                        </p>
                      </div>
                      <button
                        onClick={() => setEditMode((v) => !v)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          editMode
                            ? 'border-[#2D5BFF] bg-blue-50 text-[#2D5BFF]'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {editMode ? 'Done Editing' : 'Edit Values'}
                      </button>
                    </div>

                    {filteredAncillary.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">
                        No ancillary coverages match the selected filter.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                              <th className="px-3 py-2.5 font-semibold">Coverage Line</th>
                              <th className="px-3 py-2.5 font-semibold">Volume / Lives</th>
                              <th className="px-3 py-2.5 font-semibold">Current Rate</th>
                              <th className="px-3 py-2.5 font-semibold">Renewal Rate</th>
                              <th className="px-3 py-2.5 font-semibold">Current Monthly</th>
                              <th className="px-3 py-2.5 font-semibold">Renewal Monthly</th>
                              <th className="px-3 py-2.5 font-semibold">Change</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredAncillary.map(({ cov, idx }) => (
                              <tr key={cov.id || idx} className="hover:bg-slate-50/60">
                                <td className="px-3 py-2.5 font-semibold text-[#0F172A]">
                                  {cov.lineOfCoverage}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">{cov.volumeOrLives}</td>
                                <td className="px-3 py-2.5 text-slate-700">{cov.currentRate}</td>
                                <td className="px-3 py-2.5 text-slate-700">{cov.renewalRate}</td>
                                <td className="px-3 py-2.5 text-slate-800">
                                  {editMode ? (
                                    <input
                                      type="text"
                                      value={cov.currentMonthlyPremium ?? ''}
                                      placeholder="—"
                                      onChange={(e) =>
                                        updateAncillaryField(idx, 'currentMonthlyPremium', e.target.value)
                                      }
                                      className="w-24 rounded border border-slate-300 px-2 py-1 text-slate-800 focus:border-[#2D5BFF] focus:outline-none"
                                    />
                                  ) : cov.currentMonthlyPremium != null ? (
                                    `$${cov.currentMonthlyPremium.toLocaleString()}`
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="px-3 py-2.5 font-semibold text-[#0F172A]">
                                  {editMode ? (
                                    <input
                                      type="text"
                                      value={cov.renewalMonthlyPremium ?? ''}
                                      placeholder="—"
                                      onChange={(e) =>
                                        updateAncillaryField(idx, 'renewalMonthlyPremium', e.target.value)
                                      }
                                      className="w-24 rounded border border-slate-300 px-2 py-1 font-semibold text-[#0F172A] focus:border-[#2D5BFF] focus:outline-none"
                                    />
                                  ) : cov.renewalMonthlyPremium != null ? (
                                    `$${cov.renewalMonthlyPremium.toLocaleString()}`
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <ChangeBadge
                                    current={cov.currentMonthlyPremium}
                                    renewal={cov.renewalMonthlyPremium}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Raw JSON */}
                {activeTab === 'json' && (
                  <pre className="max-h-96 overflow-auto rounded-xl bg-[#0B1528] p-4 text-xs text-emerald-300">
                    {JSON.stringify(extraction, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
