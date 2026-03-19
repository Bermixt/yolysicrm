# Specification: CSV Import Enhancements

## 1. Objective

Scale the CSV import flow from a 10-domain hard cap to 300,000 records, add server-safe batching at 7,000 records per Convex mutation, detect duplicates against the `stores` table before committing, and give the user control over how duplicates are handled.

## 2. Context

The original import was a prototype capped at 10 records. Operators now need to import full Store Leads exports (tens of thousands of rows). Convex mutations have a practical limit on argument payload size, requiring client-side batching. Duplicate handling is critical in a CRM to avoid accidental data loss (overwriting verified stores) or data bloat.

## 3. Requirements

### 3.1 File Size Guard
- After CSV parsing, reject files with more than 300,000 rows.
- Show a clear error message with the actual row count and the limit.
- Do not advance to the next step.

### 3.2 Batched Import
- Split the domain list into chunks of 7,000 before calling `importStores`.
- Call batches sequentially (not in parallel) to avoid Convex rate limits.
- Show a progress bar: "Importing… X / Y" updated after each batch completes.
- Aggregate `{ imported, updated, skipped }` totals across all batches.

### 3.3 Duplicate Detection Step
- After column mapping, insert a new "Duplicates" step before import.
- Load all existing domains from Convex via `getAllDomains` query.
- Compute client-side: `newDomains` (not in DB) and `duplicateDomains` (already in DB).
- Display counts in two stat cards: "New domains" and "Already in database".
- If no duplicates, skip the mode selector and proceed directly to import.

### 3.4 Import Modes
Three mutually exclusive modes, selectable via radio buttons:

| Mode | UI Label | Behavior |
|---|---|---|
| `new-only` | Import new records only | Insert domains not in DB; skip existing entirely. *(default)* |
| `upsert` | New + update existing | Insert new domains; update `url` on existing, preserving `status`/`platform`. |
| `overwrite` | Import all as new | Insert new domains; reset existing to `Inactive`/`Unknown`, clearing enrichment. |

- Mode selector is only shown when duplicates exist.
- Button label reflects the mode and count: "Import 42,150 new domains" or "Import 50,040 domains".
- Disable the import button when mode is `new-only` and there are zero new domains.

### 3.5 Import Summary
Four stat cards: Total rows · Imported (green) · Updated (amber) · Skipped.

### 3.6 Backend: `getAllDomains` query
- Auth-gated.
- Returns `string[]` of all `domain` values in the `stores` table.

### 3.7 Backend: `importStores` mutation update
- New arg: `mode: "new-only" | "upsert" | "overwrite"`.
- Returns `{ imported: number, updated: number, skipped: number }`.

## 4. Acceptance Criteria

- [ ] Files with > 300,000 rows are rejected with an error message.
- [ ] Files with ≤ 300,000 rows proceed normally.
- [ ] Duplicate Check step shows correct new / duplicate counts.
- [ ] Mode selector appears only when duplicates exist.
- [ ] `new-only` mode: only new domains are inserted; existing records untouched.
- [ ] `upsert` mode: new domains inserted; existing records have `url` updated, status preserved.
- [ ] `overwrite` mode: new domains inserted; existing records reset to `Inactive`/`Unknown`.
- [ ] Large import (e.g., 15,000 rows) runs in multiple batches with live progress.
- [ ] Import summary shows four counts: total, imported, updated, skipped.
- [ ] All numbers display with locale formatting (commas for thousands).
