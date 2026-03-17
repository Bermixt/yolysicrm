"use client";

import { useConvexAuth, useMutation, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { parseCSV } from "@/lib/csv";
import { detectDomainColumn } from "@/lib/domainColumn";
import Link from "next/link";

type Step = "upload" | "map" | "import" | "verify";

type ImportSummary = { total: number; imported: number; skipped: number };

export default function ImportPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
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
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importedDomains, setImportedDomains] = useState<string[]>([]);

  const importStores = useMutation(api.stores.importStores);
  const verifyStore = useAction(api.actions.verifyStore.verifyStore);
  const updateStoreVerification = useMutation(api.stores.updateStoreVerification);

  // ── Step 1: Upload ────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    const parsed = await parseCSV(file);
    const detected = detectDomainColumn(parsed.headers);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setSelectedColumn(detected ?? parsed.headers[0] ?? "");
    setStep("map");
  }

  // ── Step 2: Map column & preview → Import ─────────────────────────────────
  const MAX_IMPORT = 10;

  async function handleImport() {
    const allDomains = rows
      .map((r) => (r[selectedColumn] ?? "").trim())
      .filter(Boolean);
    const domains = allDomains.slice(0, MAX_IMPORT);
    const result = await importStores({ domains });
    setSummary({ total: allDomains.length, imported: result.imported, skipped: result.skipped });
    setImportedDomains(domains);
    setStep("import");
  }

  // ── Step 3: Batch verify ──────────────────────────────────────────────────
  const [regexInput, setRegexInput] = useState("");
  const [regexError, setRegexError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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
    if (!value) {
      setRegexError(null);
      return;
    }
    try {
      new RegExp(value);
      setRegexError(null);
    } catch (e: unknown) {
      setRegexError(e instanceof Error ? e.message : "Invalid regex");
    }
  }

  async function runBatchVerify(domains: string[]) {
    cancelRef.current = false;
    setProgress({ done: 0, total: domains.length });
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
        // log but continue
        console.error(`Failed to verify ${domain}`);
      }
      done++;
      setProgress({ done, total: domains.length });
    }
  }

  const filteredDomains = getFilteredDomains();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm">
        <h1 className="font-semibold text-slate-800 dark:text-slate-200">Import Stores</h1>
        <Link
          href="/"
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
        >
          Home
        </Link>
      </header>

      <main className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
        <StepIndicator step={step} />

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <UploadStep onFile={handleFile} />
        )}

        {/* ── Step 2: Map + Preview ── */}
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
              <p className="text-xs text-slate-500">{rows.length} total rows</p>
            </section>

            {rows.length > MAX_IMPORT && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                Import is capped at {MAX_IMPORT} domains. Only the first {MAX_IMPORT} rows will be imported.
              </p>
            )}

            <button
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-6 py-3 font-medium transition-all"
              onClick={handleImport}
            >
              Import {Math.min(rows.length, MAX_IMPORT)} domain{Math.min(rows.length, MAX_IMPORT) !== 1 ? "s" : ""}
            </button>
          </div>
        )}

        {/* ── Step 3: Import summary ── */}
        {step === "import" && summary && (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Import complete</h2>
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Total rows" value={summary.total} />
                <StatCard label="Imported" value={summary.imported} />
                <StatCard label="Skipped" value={summary.skipped} />
              </div>
            </section>
            <button
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-6 py-3 font-medium transition-all"
              onClick={() => setStep("verify")}
            >
              Continue to verification
            </button>
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
                    ? `${filteredDomains.length} of ${importedDomains.length} domains match`
                    : `${importedDomains.length} domains total`}
                </p>
              )}
            </section>

            {progress && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Verifying…</span>
                  <span>{progress.done} / {progress.total}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-slate-600 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                {progress.done === progress.total && (
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">All done!</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-6 py-3 font-medium transition-all disabled:opacity-50"
                disabled={!!progress && progress.done < progress.total}
                onClick={() => runBatchVerify(importedDomains)}
              >
                Verify all ({importedDomains.length})
              </button>
              {regexInput && !regexError && filteredDomains.length > 0 && (
                <button
                  className="bg-slate-500 hover:bg-slate-600 text-white rounded-lg px-6 py-3 font-medium transition-all disabled:opacity-50"
                  disabled={!!progress && progress.done < progress.total}
                  onClick={() => runBatchVerify(filteredDomains)}
                >
                  Verify filtered ({filteredDomains.length})
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "map", label: "Map Column" },
    { id: "import", label: "Import" },
    { id: "verify", label: "Verify" },
  ];
  const current = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              i < current
                ? "bg-slate-600 text-white"
                : i === current
                ? "bg-slate-800 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-500"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-sm ${i === current ? "font-semibold text-slate-800 dark:text-slate-200" : "text-slate-500"}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <div className="w-6 h-px bg-slate-300 dark:bg-slate-600" />}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
