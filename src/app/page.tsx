"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import {
  cleanCsv, decodeCsv, detectIssues, exportCsv, MAX_FILE_BYTES, NO_FIXES,
  parseCsv, PREVIEW_ROWS, type CleaningOptions, type CsvData, type Issues,
} from "@/lib/csv";

const ISSUE_LABELS: { key: keyof Issues; label: string; unit: string }[] = [
  { key: "duplicates", label: "Exact duplicates", unit: "extra rows" },
  { key: "emptyRows", label: "Empty rows", unit: "rows" },
  { key: "whitespace", label: "Edge whitespace", unit: "cells" },
  { key: "missing", label: "Missing values", unit: "cells · flagged only" },
  { key: "placeholders", label: "Empty placeholders", unit: "cells" },
];
const FIXES: { key: keyof CleaningOptions; label: string; description: string }[] = [
  { key: "duplicates", label: "Remove exact duplicate rows", description: "Keep the first occurrence. Compare original values." },
  { key: "emptyRows", label: "Remove completely empty rows", description: "Remove original rows containing only blanks or whitespace." },
  { key: "whitespace", label: "Trim leading and trailing whitespace", description: "Keep spaces and line breaks inside a value." },
  { key: "placeholders", label: "Normalize empty placeholders", description: "Convert N/A, NA, null, - and -- to blank (case-insensitive)." },
];

function Preview({ data, title, id }: { data: CsvData; title: string; id: string }) {
  return (
    <section className="preview panel" aria-labelledby={`${id}-title`}>
      <div className="section-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <span>{data.rows.length.toLocaleString()} rows · {data.columns.length} columns</span>
      </div>
      <div className="table-scroll" tabIndex={0} aria-label={`${title} scrollable table`}>
        <table>
          <thead><tr><th scope="col" className="row-number">#</th>{data.columns.map((column, index) => <th scope="col" key={index} dir="auto">{column}</th>)}</tr></thead>
          <tbody>
            {data.rows.slice(0, PREVIEW_ROWS).map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="row-number">{rowIndex + 1}</td>
                {row.map((value, index) => <td key={index} dir="auto" className={value.trim() === "" ? "missing-cell" : ""}>{value === "" ? <span aria-label="Blank value">—</span> : value}</td>)}
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan={data.columns.length + 1} className="no-rows">No data rows.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="preview-note">Showing {Math.min(data.rows.length, PREVIEW_ROWS)} of {data.rows.length} rows. Downloads include every row.</p>
    </section>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<CsvData | null>(null);
  const [cleaned, setCleaned] = useState<CsvData | null>(null);
  const [fileName, setFileName] = useState("");
  const [options, setOptions] = useState<CleaningOptions>({ ...NO_FIXES });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const issues = useMemo(() => source ? detectIssues(source) : null, [source]);

  async function readFiles(files: File[]) {
    if (loading) return;
    setError(null);
    if (files.length !== 1) { setError("Choose one CSV file at a time."); return; }
    const file = files[0];
    if (!/\.csv$/i.test(file.name)) { setError("Choose a .csv file. Excel/XLSX files are not supported."); return; }
    if (file.size > MAX_FILE_BYTES) { setError("This file is larger than 10 MB. Choose a smaller CSV."); return; }
    setLoading(true);
    try {
      const data = parseCsv(decodeCsv(await file.arrayBuffer()));
      setSource(data);
      setFileName(file.name);
      setCleaned(null);
      setOptions({ ...NO_FIXES });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this CSV file.");
    } finally { setLoading(false); }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) void readFiles(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void readFiles(Array.from(event.dataTransfer.files));
  }

  function startOver() {
    setSource(null); setCleaned(null); setFileName(""); setError(null);
    setOptions({ ...NO_FIXES }); setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function download() {
    if (!cleaned) return;
    const url = URL.createObjectURL(new Blob([exportCsv(cleaned)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.csv$/i, "")}-cleaned.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Smart CSV Cleaner home"><span className="brand-mark" aria-hidden="true">CSV</span><span>Smart CSV Cleaner</span></Link>
        <span className="local-label"><span aria-hidden="true">●</span> Processed in your browser</span>
      </header>

      <section className="hero">
        <p className="eyebrow">A little cleanup. A clearer file.</p>
        <h1>Make your CSV ready<br className="desktop-break" /> for the next step.</h1>
        <p className="intro">Spot common issues, choose the fixes you want, and download a clean copy.</p>
        <p className="arabic-intro" lang="ar" dir="rtl">راجع بياناتك واختر التنظيف المناسب. ملفك يبقى على جهازك.</p>
      </section>

      <div className={`dropzone${dragging ? " dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <svg className="upload-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M10 4H21L27 10V27H5V4H10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M20 4V11H27M11 19L16 14L21 19M16 14V25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <div><h2>Drop your CSV here</h2><p>One .csv file · UTF-8 · Up to 10 MB</p></div>
        <button className="button primary" type="button" onClick={() => inputRef.current?.click()} disabled={loading}>{loading ? "Reading file…" : "Choose CSV"}</button>
        <input ref={inputRef} id="csv-upload" type="file" accept=".csv,text/csv" hidden onChange={onFileChange} disabled={loading} />
      </div>
      {loading && <p className="feedback" role="status">Reading and checking your file…</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}

      {source && issues && (
        <div className="workspace">
          <div className="file-bar"><div><span className="eyebrow">Current file</span><strong>{fileName}</strong></div><button type="button" className="button secondary" onClick={startOver} disabled={loading}>Start over</button></div>

          <section aria-labelledby="issues-title">
            <div className="section-heading"><h2 id="issues-title">What we found</h2><span>In the original data · counts may overlap</span></div>
            <div className="issue-grid">{ISSUE_LABELS.map((issue) => <div className="issue" key={issue.key} data-issue={issue.key}><span>{issue.label}</span><strong>{issues[issue.key].toLocaleString()}</strong><small>{issue.unit}</small></div>)}</div>
          </section>

          <section className="cleaning panel" aria-labelledby="fixes-title">
            <div className="cleaning-heading"><p className="eyebrow">You choose what changes</p><h2 id="fixes-title">Safe cleaning options</h2><p>Missing values are flagged only. No values are guessed or filled.</p></div>
            <div className="options">{FIXES.map((fix) => <label className="option" key={fix.key}><input type="checkbox" checked={options[fix.key]} onChange={(event) => { setOptions((current) => ({ ...current, [fix.key]: event.target.checked })); setCleaned(null); }} /><span><strong>{fix.label}</strong><small>{fix.description}</small></span></label>)}</div>
            <div className="apply-bar"><span>Headers, column order, and original file stay intact.</span><button type="button" className="button primary" onClick={() => setCleaned(cleanCsv(source, options))} disabled={loading}>Apply selected fixes</button></div>
          </section>

          <Preview data={source} title="Original data" id="original" />

          {cleaned && (
            <div className="cleaned-result">
              <div className="result-bar"><div role="status"><strong>Cleaned copy ready</strong><p>Before: <b data-count="before">{source.rows.length}</b> rows <span aria-hidden="true">→</span> After: <b data-count="after">{cleaned.rows.length}</b> rows · {source.rows.length - cleaned.rows.length} removed</p></div><button type="button" className="button primary" onClick={download}>Download cleaned CSV <span aria-hidden="true">↓</span></button></div>
              <Preview data={cleaned} title="Cleaned data" id="cleaned" />
            </div>
          )}
        </div>
      )}
      <footer>Files stay in this tab. Reloading clears the data. Your original file is never overwritten.</footer>
    </main>
  );
}
