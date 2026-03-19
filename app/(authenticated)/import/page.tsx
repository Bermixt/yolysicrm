"use client";

import { useConvexAuth, useMutation, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { parseCSV } from "@/lib/csv";
import { detectDomainColumn } from "@/lib/domainColumn";

type Step = "upload" | "map" | "import" | "verify";
type ImportMode = "new-only" | "upsert" | "overwrite";
type ImportSummary = { total: number; imported: number; updated: number; skipped: number };

const MAX_ROWS = 300_000;
const BATCH_SIZE = 2_000; // Convex read limit is 4096/execution; 1 indexed read per domain

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function ImportPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/signin");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <ImportFlow />;
}

function ImportFlow() {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [importMode, setImportMode] = useState<ImportMode>("new-only");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importedDomains, setImportedDomains] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  const importStores = useMutation(api.stores.importStores);
  const verifyStore = useAction(api.actions.verifyStore.verifyStore);
  const updateStoreVerification = useMutation(api.stores.updateStoreVerification);

  // ── Step 1: Upload ────────────────────────────────────────────────────────
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileSizeError(null);
    const parsed = await parseCSV(file);
    if (parsed.rows.length > MAX_ROWS) {
      setFileSizeError(
        `CSV has ${parsed.rows.length.toLocaleString()} rows. Maximum allowed is ${MAX_ROWS.toLocaleString()}.`
      );
      return;
    }
    const detected = detectDomainColumn(parsed.headers);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setSelectedColumn(detected ?? parsed.headers[0] ?? "");
    setStep("map");
  }

  // ── Step 2: Map column + pick mode → kick off import ─────────────────────
  async function handleStartImport() {
    const domains = rows
      .map((r) => (r[selectedColumn] ?? "").trim())
      .filter(Boolean);

    setImportedDomains(domains);
    setImportProgress({ done: 0, total: domains.length });
    setSummary(null);
    setStep("import");

    const batches = chunk(domains, BATCH_SIZE);
    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let processed = 0;

    for (const batch of batches) {
      const result = await importStores({ domains: batch, mode: importMode });
      totalImported += result.imported;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      processed += batch.length;
      setImportProgress({ done: processed, total: domains.length });
    }

    setSummary({
      total: domains.length,
      imported: totalImported,
      updated: totalUpdated,
      skipped: totalSkipped,
    });
  }

  // ── Step 4: Batch verify ──────────────────────────────────────────────────
  const [regexInput, setRegexInput] = useState("");
  const [regexError, setRegexError] = useState<string | null>(null);
  const [verifyProgress, setVerifyProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelRef = useRef(false);

  function getFilteredDomains() {
    if (!regexInput) return importedDomains;
    try {
      const re = new RegExp(regexInput);
      return importedDomains.filter((d) => re.test(d));
    } catch {
      return [];
    }
  }

  function handleRegexChange(value: string) {
    setRegexInput(value);
    if (!value) { setRegexError(null); return; }
    try {
      new RegExp(value);
      setRegexError(null);
    } catch (e: unknown) {
      setRegexError(e instanceof Error ? e.message : "Invalid regex");
    }
  }

  async function runBatchVerify(domains: string[]) {
    cancelRef.current = false;
    setVerifyProgress({ done: 0, total: domains.length });
    let done = 0;
    for (const domain of domains) {
      if (cancelRef.current) break;
      try {
        const url = domain.startsWith("http") ? domain : `https://${domain}`;
        const result = await verifyStore({ url });
        await updateStoreVerification({
          domain,
          url,
          status: result.status,
          platform: result.platform,
          enrichmentData: result.metadata,
        });
      } catch {
        console.error(`Failed to verify ${domain}`);
      }
      done++;
      setVerifyProgress({ done, total: domains.length });
    }
  }

  const filteredDomains = getFilteredDomains();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Import Stores</h1>

      <StepIndicator step={step} />

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <UploadStep onFile={handleFile} />
          {fileSizeError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
              {fileSizeError}
            </p>
          )}
          <p className="text-xs text-slate-400 text-center">
            Maximum {MAX_ROWS.toLocaleString()} rows per file
          </p>
        </div>
      )}

      {/* ── Step 2: Map column + import mode ── */}
      {step === "map" && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Select domain column</h2>
            <select
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-slate-800 dark:text-slate-200"
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
            >
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Preview (first 5 rows)</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400">{selectedColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-mono text-xs">
                        {row[selectedColumn] ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">{rows.length.toLocaleString()} total rows</p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Handle existing records</h2>
            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    value: "new-only" as ImportMode,
                    label: "Import new records only",
                    description: "Skip domains already in the database. Existing records are untouched.",
                  },
                  {
                    value: "upsert" as ImportMode,
                    label: "New + update existing",
                    description: "Insert new domains and refresh the URL of existing ones. Verification status is preserved.",
                  },
                  {
                    value: "overwrite" as ImportMode,
                    label: "Import all as new",
                    description: "Insert new domains and reset existing ones to Inactive / Unknown, clearing all verification data.",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    importMode === opt.value
                      ? "border-slate-700 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-500"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value={opt.value}
                    checked={importMode === opt.value}
                    onChange={() => setImportMode(opt.value)}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{opt.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <button
            className="bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-6 py-3 font-medium transition-all"
            onClick={() => void handleStartImport()}
          >
            Import {rows.length.toLocaleString()} rows →
          </button>
        </div>
      )}

      {/* ── Step 3: Import progress + summary ── */}
      {step === "import" && (
        <div className="flex flex-col gap-6">
          {importProgress && importProgress.done < importProgress.total && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Importing…</span>
                <span>{importProgress.done.toLocaleString()} / {importProgress.total.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-slate-600 h-2 rounded-full transition-all"
                  style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {summary && (
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Import complete</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total rows" value={summary.total} />
                <StatCard label="Imported" value={summary.imported} color="green" />
                <StatCard label="Updated" value={summary.updated} color="amber" />
                <StatCard label="Skipped" value={summary.skipped} />
              </div>
            </section>
          )}

          {summary && (
            <button
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-6 py-3 font-medium transition-all"
              onClick={() => setStep("verify")}
            >
              Continue to verification
            </button>
          )}
        </div>
      )}

      {/* ── Step 4: Batch verify ── */}
      {step === "verify" && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Regex filter (optional)</h2>
            <input
              type="text"
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-slate-800 dark:text-slate-200 font-mono text-sm"
              placeholder="e.g. \.com$"
              value={regexInput}
              onChange={(e) => handleRegexChange(e.target.value)}
            />
            {regexError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{regexError}</p>
            )}
            {!regexError && (
              <p className="text-xs text-slate-500">
                {regexInput
                  ? `${filteredDomains.length.toLocaleString()} of ${importedDomains.length.toLocaleString()} domains match`
                  : `${importedDomains.length.toLocaleString()} domains total`}
              </p>
            )}
          </section>

          {verifyProgress && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Verifying…</span>
                <span>{verifyProgress.done.toLocaleString()} / {verifyProgress.total.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-slate-600 h-2 rounded-full transition-all"
                  style={{ width: `${(verifyProgress.done / verifyProgress.total) * 100}%` }}
                />
              </div>
              {verifyProgress.done === verifyProgress.total && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">All done!</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-6 py-3 font-medium transition-all disabled:opacity-50"
              disabled={!!verifyProgress && verifyProgress.done < verifyProgress.total}
              onClick={() => void runBatchVerify(importedDomains)}
            >
              Verify all ({importedDomains.length.toLocaleString()})
            </button>
            {regexInput && !regexError && filteredDomains.length > 0 && (
              <button
                className="bg-slate-500 hover:bg-slate-600 text-white rounded-lg px-6 py-3 font-medium transition-all disabled:opacity-50"
                disabled={!!verifyProgress && verifyProgress.done < verifyProgress.total}
                onClick={() => void runBatchVerify(filteredDomains)}
              >
                Verify filtered ({filteredDomains.length.toLocaleString()})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "map", label: "Map Column" },
    { id: "import", label: "Import" },
    { id: "verify", label: "Verify" },
  ];
  const current = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1.5">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
              i < current
                ? "bg-slate-600 text-white"
                : i === current
                ? "bg-slate-800 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-500"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-xs ${i === current ? "font-semibold text-slate-800 dark:text-slate-200" : "text-slate-500"}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <div className="w-4 h-px bg-slate-300 dark:bg-slate-600" />}
        </div>
      ))}
    </div>
  );
}

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
        dragging
          ? "border-slate-500 bg-slate-100 dark:bg-slate-800"
          : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <p className="text-slate-600 dark:text-slate-400 text-sm">
        Drag & drop a CSV file here, or click to browse
      </p>
      <p className="text-xs text-slate-400">Supports comma, semicolon, and tab delimiters</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: number;
  color?: "slate" | "green" | "amber";
}) {
  const valueColor = {
    slate: "text-slate-800 dark:text-slate-200",
    green: "text-green-700 dark:text-green-400",
    amber: "text-amber-700 dark:text-amber-400",
  }[color];

  return (
    <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-1">
      <p className={`text-2xl font-bold ${valueColor}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
