# Smart CSV Cleaner

**Project status: Complete**

Upload a CSV, review common data-quality issues, select safe fixes, preview the cleaned result, and download a separate cleaned CSV. All file processing takes place in the browser. Files are not uploaded to a server or stored in the cloud.

## Features

- Choose or drag and drop one UTF-8, comma-separated CSV file.
- Preview the original data and issue counts.
- Detect exact duplicate rows, completely empty rows, edge whitespace, missing values, and empty placeholders.
- Choose fixes individually; none are selected or applied automatically.
- Compare before/after row counts and preview the cleaned copy.
- Download all cleaned rows with preserved column order, CSV escaping, and a UTF-8 BOM for [Arabic support in Excel](https://support.microsoft.com/en-us/excel/opening-csv-utf-8-files-correctly-in-excel).
- Start over to clear the current file and options.

## Stack

Next.js App Router, React, TypeScript, CSS, and Papa Parse. Node's test runner and tsx run the fixture tests. No database, login, AI, file-processing API, or cloud storage.

## Run locally

Use Node.js 20.9 or newer and npm:

```bash
git clone https://github.com/H-dev0/smart-csv-cleaner.git
cd smart-csv-cleaner
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables or API keys are required.

`npm run build` produces a static site in `out/`. Production only needs a static file host; no application backend is required.

## What the cleaner changes

- **Exact duplicates:** removes extra occurrences of identical original data rows, keeping the first.
- **Empty rows:** removes original rows whose cells are all blank or whitespace-only.
- **Whitespace:** trims only the leading/trailing whitespace in data cells.
- **Placeholders:** replaces `N/A`, `NA`, `null`, `-`, and `--` with blank cells, matching case-insensitively after ignoring edge whitespace.

Row-removal checks use the original rows. Trimming or normalizing does not cause additional rows to be merged or removed. Counts can overlap (for example, an empty row may also be a duplicate). Missing-value counts include blank and whitespace-only cells; placeholder counts are reported separately. Headers are not changed.

## What it intentionally does not change

Missing values are flagged, never guessed or filled. Unselected fixes do not run. Numbers, dates, leading zeros, letter case, formulas, internal whitespace, headers, and column order remain as text. The original file and original preview are never overwritten. There are no advanced transformations or XLSX/Excel uploads.

## Input and export limits

- One file at a time, up to 10 MB; UTF-8 comma-separated CSV with a non-empty header name for each column.
- Invalid quotes and non-empty records with a different column count are rejected rather than repaired or truncated. Physical blank lines are retained as empty rows until their removal is selected.
- Each preview shows the first 50 rows. Processing and download include all rows.
- Data exists only in browser memory; reloading or closing the page clears it.
- Export quotes/escapes commas, double quotes, and embedded newlines and adds a UTF-8 BOM. Spreadsheet programs can still interpret dates, numbers, and formula-like text themselves; import columns as text if exact textual values matter.

## Verify

```bash
npm test
npm run build
npm run lint
npm run typecheck
```

Fixtures in `tests/fixtures` cover duplicates, physical blank rows, whitespace, missing values, placeholders, quoted commas, escaped quotes, multiline values, and Arabic. Tests verify issue counts, each fix alone, unselected fixes, immutable originals, invalid-input errors, and export/reparse integrity.
