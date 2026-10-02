import Papa from "papaparse";

export type CsvData = { columns: string[]; rows: string[][] };
export type CleaningOptions = {
  duplicates: boolean;
  emptyRows: boolean;
  whitespace: boolean;
  placeholders: boolean;
};
export type Issues = {
  duplicates: number;
  emptyRows: number;
  whitespace: number;
  missing: number;
  placeholders: number;
};

export const NO_FIXES: CleaningOptions = {
  duplicates: false, emptyRows: false, whitespace: false, placeholders: false,
};

const EMPTY_PLACEHOLDERS = new Set(["n/a", "na", "null", "-", "--"]);
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PREVIEW_ROWS = 50;

function isEmptyRow(row: string[]) {
  return row.every((value) => value.trim() === "");
}

function isPlaceholder(value: string) {
  return EMPTY_PLACEHOLDERS.has(value.trim().toLowerCase());
}

export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("This file is not UTF-8. Save it as CSV UTF-8 and try again.");
  }
}

export function parseCsv(input: string): CsvData {
  const text = input.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("The CSV file is empty.");
  if (text.includes("\0")) throw new Error("Unsupported file encoding. Use a UTF-8 CSV file.");

  const result = Papa.parse<string[]>(text, {
    delimiter: ",", header: false, dynamicTyping: false, skipEmptyLines: false,
  });
  if (result.errors.length > 0) {
    const issue = result.errors[0];
    throw new Error(`Invalid CSV${issue.row === undefined ? "" : ` at record ${issue.row + 1}`}: ${issue.message}`);
  }

  // Papa Parse emits an extra empty record for a final line terminator.
  // Remove that record only; actual blank rows must remain visible.
  const records = result.data.slice();
  const last = records.at(-1);
  if (/[\r\n]$/.test(text) && last?.length === 1 && last[0] === "") records.pop();

  const columns = records.shift();
  if (!columns || columns.some((value) => value.trim() === "")) {
    throw new Error("The first record must contain a non-empty name for every column.");
  }
  const rows = records.map((record, index) => {
    // A physical blank line represents an empty row across all columns.
    if (record.length === 1 && record[0].trim() === "" && columns.length > 1) {
      return [record[0], ...Array<string>(columns.length - 1).fill("")];
    }
    if (record.length !== columns.length) {
      throw new Error(`Record ${index + 2} has ${record.length} values; expected ${columns.length}. Check its commas and quotes.`);
    }
    return [...record];
  });
  return { columns: [...columns], rows };
}

export function detectIssues(data: CsvData): Issues {
  const issues: Issues = { duplicates: 0, emptyRows: 0, whitespace: 0, missing: 0, placeholders: 0 };
  const seen = new Set<string>();
  for (const row of data.rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) issues.duplicates++;
    seen.add(key);
    if (isEmptyRow(row)) issues.emptyRows++;
    for (const value of row) {
      if (value !== value.trim()) issues.whitespace++;
      if (value.trim() === "") issues.missing++;
      if (isPlaceholder(value)) issues.placeholders++;
    }
  }
  return issues;
}

export function cleanCsv(data: CsvData, options: CleaningOptions): CsvData {
  const seen = new Set<string>();
  const rows: string[][] = [];
  for (const original of data.rows) {
    const key = JSON.stringify(original);
    const duplicate = seen.has(key);
    seen.add(key);
    if (options.duplicates && duplicate) continue;
    if (options.emptyRows && isEmptyRow(original)) continue;
    rows.push(original.map((value) => {
      if (options.placeholders && isPlaceholder(value)) return "";
      return options.whitespace ? value.trim() : value;
    }));
  }
  return { columns: [...data.columns], rows };
}

export function exportCsv(data: CsvData): string {
  const csv = Papa.unparse([data.columns, ...data.rows], {
    delimiter: ",", quotes: true, newline: "\r\n", skipEmptyLines: false,
    escapeFormulae: false,
  });
  return `\uFEFF${csv}\r\n`;
}
