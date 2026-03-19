"use client";

import { useConvexAuth, useQuery, useAction, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// ── Column definitions ─────────────────────────────────────────────────────

const ALL_COLUMNS = [
  { key: "domain", label: "Domain" },
  { key: "status", label: "Status" },
  { key: "platform", label: "Platform" },
  { key: "lastVerifiedAt", label: "Last Verified" },
  { key: "url", label: "URL" },
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "robotsTxt", label: "robots.txt" },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

const DEFAULT_COLUMNS: ColumnKey[] = ["domain", "status", "platform", "lastVerifiedAt"];
const PAGE_SIZES = [10, 20, 50, 100];

type SavedView = { name: string; columns: ColumnKey[] };
type RobotsResult = { domain: string; content: string | null; error?: string };

// ── Store type (from Convex) ───────────────────────────────────────────────

type Store = {
  _id: Id<"stores">;
  domain: string;
  url: string;
  status: "Active" | "Inactive" | "Unreachable";
  platform: "Shopify" | "Other" | "Unknown";
  lastVerifiedAt?: number;
  enrichmentData?: Record<string, unknown>;
};

// ── Page entry point ──────────────────────────────────────────────────────

export default function StoresPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/signin");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <StoresExplorer />;
}

// ── Main explorer component ───────────────────────────────────────────────

function StoresExplorer() {
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Column views
  const [activeColumns, setActiveColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [activeViewName, setActiveViewName] = useState("Default");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showSaveViewInput, setShowSaveViewInput] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Actions dropdown
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  // robots.txt state
  const [robotsProgress, setRobotsProgress] = useState<{ done: number; total: number } | null>(null);
  const [robotsResults, setRobotsResults] = useState<RobotsResult[] | null>(null);
  const [showRobotsModal, setShowRobotsModal] = useState(false);

  const fetchRobotsTxt = useAction(api.actions.fetchRobotsTxt.fetchRobotsTxt);
  const savedViews = useQuery(api.userPreferences.getStoreViews) ?? [];
  const saveStoreView = useMutation(api.userPreferences.saveStoreView);
  const deleteStoreViewMutation = useMutation(api.userPreferences.deleteStoreView);

  // Fetch stores
  const result = useQuery(api.stores.listStores, { page, pageSize });
  const stores = (result?.items ?? []) as Store[];
  const totalCount = result?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Reset selection on page/size change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize]);

  // ── Column view helpers ──────────────────────────────────────────────────

  function toggleColumn(key: ColumnKey) {
    setActiveColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
    setActiveViewName("Custom");
  }

  function switchToView(name: string) {
    if (name === "Default") {
      setActiveColumns(DEFAULT_COLUMNS);
      setActiveViewName("Default");
    } else {
      const view = savedViews.find((v) => v.name === name);
      if (view) {
        setActiveColumns(view.columns as ColumnKey[]);
        setActiveViewName(name);
      }
    }
  }

  function saveCurrentView() {
    const name = newViewName.trim();
    if (!name) return;
    void saveStoreView({ view: { name, columns: activeColumns } });
    setActiveViewName(name);
    setNewViewName("");
    setShowSaveViewInput(false);
  }

  function deleteView(name: string) {
    void deleteStoreViewMutation({ name });
    if (activeViewName === name) {
      setActiveColumns(DEFAULT_COLUMNS);
      setActiveViewName("Default");
    }
  }

  // ── Multi-select helpers ─────────────────────────────────────────────────

  const allOnPageSelected =
    stores.length > 0 && stores.every((s) => selectedIds.has(s._id));

  function toggleAll() {
    setSelectedIds(
      allOnPageSelected ? new Set() : new Set(stores.map((s) => s._id))
    );
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── robots.txt action ────────────────────────────────────────────────────

  const eligibleStores = stores.filter(
    (s) => selectedIds.has(s._id) && s.status === "Active" && s.platform === "Shopify"
  );

  async function runRobotsTxt() {
    setShowActionsDropdown(false);
    if (!eligibleStores.length) return;

    setRobotsProgress({ done: 0, total: eligibleStores.length });
    setRobotsResults(null);
    const results: RobotsResult[] = [];

    for (let i = 0; i < eligibleStores.length; i++) {
      const store = eligibleStores[i];
      try {
        const res = await fetchRobotsTxt({ storeId: store._id });
        results.push({ domain: res.domain, content: res.content, error: res.error });
      } catch (e) {
        results.push({
          domain: store.domain,
          content: null,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
      setRobotsProgress({ done: i + 1, total: eligibleStores.length });
    }

    setRobotsResults(results);
    setShowRobotsModal(true);
  }

  // ── Cell renderer ────────────────────────────────────────────────────────

  function renderCell(store: Store, colKey: ColumnKey) {
    switch (colKey) {
      case "domain":
        return <span className="font-mono text-xs">{store.domain}</span>;
      case "url":
        return (
          <span className="font-mono text-xs text-slate-500 truncate block max-w-[180px]">
            {store.url}
          </span>
        );
      case "status":
        return <StatusBadge status={store.status} />;
      case "platform":
        return <span className="text-xs">{store.platform}</span>;
      case "lastVerifiedAt":
        return (
          <span className="text-xs text-slate-500">
            {store.lastVerifiedAt
              ? new Date(store.lastVerifiedAt).toLocaleDateString()
              : "—"}
          </span>
        );
      case "title":
        return (
          <span className="text-xs truncate block max-w-[160px]">
            {(store.enrichmentData?.title as string) ?? "—"}
          </span>
        );
      case "description":
        return (
          <span className="text-xs truncate block max-w-[180px] text-slate-500">
            {(store.enrichmentData?.description as string) ?? "—"}
          </span>
        );
      case "robotsTxt":
        return (
          <span className={`text-xs font-medium ${store.enrichmentData?.robotsTxt ? "text-green-600" : "text-slate-400"}`}>
            {store.enrichmentData?.robotsTxt ? "✓" : "—"}
          </span>
        );
    }
  }

  const visibleColumns = ALL_COLUMNS.filter((c) => activeColumns.includes(c.key));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 flex flex-col gap-4 min-h-full">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Stores</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <select
            value={activeViewName}
            onChange={(e) => switchToView(e.target.value)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="Default">Default</option>
            {savedViews.map((v) => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>

          {/* Column picker button */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker((p) => !p)}
              className="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Columns
            </button>

            {/* Column picker popover */}
            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 flex flex-col gap-3 w-64 z-20">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Visible columns
                </p>
                <div className="flex flex-col gap-2">
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={activeColumns.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  {showSaveViewInput ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveCurrentView()}
                        placeholder="View name"
                        className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      />
                      <button
                        onClick={saveCurrentView}
                        className="text-sm text-white bg-slate-700 hover:bg-slate-800 rounded-lg px-3 py-1"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveViewInput(true)}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Save as view…
                    </button>
                  )}
                </div>

                {savedViews.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saved views</p>
                    {savedViews.map((v) => (
                      <div key={v.name} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{v.name}</span>
                        <button
                          onClick={() => deleteView(v.name)}
                          className="text-xs text-rose-500 hover:text-rose-700"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Page size */}
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        </div>
      </div>

      {/* Action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} store{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          {eligibleStores.length > 0 && (
            <span className="text-xs text-slate-400">
              ({eligibleStores.length} eligible for robots.txt)
            </span>
          )}

          <div className="relative ml-auto">
            <button
              onClick={() => setShowActionsDropdown((p) => !p)}
              className="text-sm bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Actions ▾
            </button>
            {showActionsDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-60 overflow-hidden z-20">
                <button
                  className="w-full text-left text-sm px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={eligibleStores.length === 0}
                  onClick={() => void runRobotsTxt()}
                >
                  Read robots.txt
                  {eligibleStores.length === 0 && (
                    <span className="block text-xs text-slate-400 mt-0.5">
                      No Active Shopify stores selected
                    </span>
                  )}
                  {eligibleStores.length > 0 && (
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {eligibleStores.length} of {selectedIds.size} selected stores eligible
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* robots.txt progress */}
      {robotsProgress && robotsProgress.done < robotsProgress.total && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Fetching robots.txt…</span>
            <span>{robotsProgress.done} / {robotsProgress.total}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-slate-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(robotsProgress.done / robotsProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result === undefined && (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-10 text-center text-slate-400 text-sm">
                  Loading…
                </td>
              </tr>
            )}
            {result !== undefined && stores.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-10 text-center text-slate-400 text-sm">
                  No stores found. Import a CSV to get started.
                </td>
              </tr>
            )}
            {stores.map((store) => (
              <tr
                key={store._id}
                className={`border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                  selectedIds.has(store._id) ? "bg-slate-50 dark:bg-slate-800/30" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(store._id)}
                    onChange={() => toggleRow(store._id)}
                    className="rounded"
                  />
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                    {renderCell(store, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
        <span>{totalCount} total store{totalCount !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-2">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* robots.txt results modal */}
      {showRobotsModal && robotsResults && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRobotsModal(false);
              setRobotsProgress(null);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                robots.txt Results
              </h2>
              <button
                onClick={() => { setShowRobotsModal(false); setRobotsProgress(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-6">
              {robotsResults.map((r) => (
                <div key={r.domain}>
                  <h3 className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-sm mb-2">
                    {r.domain}
                  </h3>
                  {r.error ? (
                    <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
                      {r.error}
                    </p>
                  ) : (
                    <pre className="text-xs bg-slate-100 dark:bg-slate-800 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto leading-relaxed">
                      {r.content}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "Active" | "Inactive" | "Unreachable" }) {
  const styles = {
    Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Unreachable: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}
