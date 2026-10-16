import { useState } from "react";
import type { QueryResult } from "./types";

type Props = { result: QueryResult | null; onExport: (format: string) => void };

const stringify = (value: unknown, space?: number) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, space);
const display = (value: unknown) => value === null ? "NULL" : typeof value === "object" ? stringify(value) : String(value);

export default function DataGrid({ result, onExport }: Props) {
  const [filter, setFilter] = useState("");
  const [mode, setMode] = useState<"grid" | "chart" | "json">("grid");
  const [cell, setCell] = useState<unknown>(null);
  if (!result) return <section className="results empty-results"><span>Run a query to explore its results.</span></section>;
  if (result.is_error) return <section className="results error-results"><strong>Query failed</strong><pre>{result.error_message}</pre></section>;
  const rows = result.rows.filter(row => row.some(value => display(value).toLowerCase().includes(filter.toLowerCase())));
  const numeric = result.columns.findIndex((_, index) => rows.some(row => typeof row[index] === "number"));

  return <section className="results">
    <div className="panel-bar results-bar">
      <div className="view-tabs">
        {(["grid", "chart", "json"] as const).map(view => <button key={view} className={mode === view ? "active" : ""} onClick={() => setMode(view)}>{view === "json" ? "Raw JSON" : view[0].toUpperCase() + view.slice(1)}</button>)}
      </div>
      <input className="filter" placeholder="Filter results" value={filter} onChange={event => setFilter(event.target.value)} />
      <div className="export"><span>Export</span>{["CSV", "JSON", "PARQUET"].map(format => <button key={format} onClick={() => onExport(format)}>{format}</button>)}</div>
    </div>
    {mode === "grid" && <div className="table-wrap"><table><thead><tr>{result.columns.map((column, index) => <th key={column}>{column}<small>{result.column_types[index]}</small></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, index) => <td key={index} title="Inspect cell" onClick={() => setCell(value)} className={value === null ? "null" : ""}>{display(value)}</td>)}</tr>)}</tbody></table>{!rows.length && <div className="no-rows">No matching rows</div>}</div>}
    {mode === "json" && <pre className="json">{stringify(rows.map(row => Object.fromEntries(result.columns.map((column, index) => [column, row[index]]))), 2)}</pre>}
    {mode === "chart" && <div className="chart">{numeric < 0 ? <span>A numeric column is needed for a chart.</span> : rows.slice(0, 12).map((row, index) => { const value = Number(row[numeric]) || 0; const max = Math.max(...rows.map(item => Number(item[numeric]) || 0), 1); return <div className="bar-row" key={index}><label>{display(row[0])}</label><i style={{ width: `${Math.max(3, value / max * 100)}%` }} /><b>{value}</b></div>; })}</div>}
    <footer className="result-footer"><span>{result.row_count.toLocaleString()} rows</span><span>{result.duration_ms.toFixed(2)} ms</span>{result.affected_rows !== null && <span>{result.affected_rows} affected</span>}</footer>
    {cell !== null && <div className="overlay" onMouseDown={() => setCell(null)}><div className="inspector" onMouseDown={event => event.stopPropagation()}><div className="modal-title"><strong>Cell inspector</strong><button onClick={() => setCell(null)}>Close</button></div><pre>{display(cell)}</pre><button className="run" onClick={() => navigator.clipboard.writeText(display(cell))}>Copy value</button></div></div>}
  </section>;
}
