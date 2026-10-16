import { useState } from "react";
import type { TableMetadata } from "./types";

type CreateProps = { onClose: () => void; onCreate: (sql: string) => void };
export function CreateTableModal({ onClose, onCreate }: CreateProps) {
  const [name, setName] = useState("new_table");
  const [columns, setColumns] = useState([{ name: "id", type: "INTEGER", pk: true, required: true }, { name: "name", type: "VARCHAR", pk: false, required: false }]);
  const ddl = `CREATE TABLE ${name} (\n  ${columns.map(column => `${column.name} ${column.type}${column.pk ? " PRIMARY KEY" : ""}${column.required ? " NOT NULL" : ""}`).join(",\n  ")}\n);`;
  return <Modal title="Create table" onClose={onClose}><label>Table name<input value={name} onChange={event => setName(event.target.value)} /></label><div className="builder">{columns.map((column, index) => <div key={index}><input value={column.name} onChange={event => setColumns(columns.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /><select value={column.type} onChange={event => setColumns(columns.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}>{["INTEGER", "VARCHAR", "DOUBLE", "BOOLEAN", "TIMESTAMP"].map(type => <option key={type}>{type}</option>)}</select><label><input type="checkbox" checked={column.pk} onChange={event => setColumns(columns.map((item, i) => i === index ? { ...item, pk: event.target.checked } : item))} />PK</label><label><input type="checkbox" checked={column.required} onChange={event => setColumns(columns.map((item, i) => i === index ? { ...item, required: event.target.checked } : item))} />Required</label></div>)}<button onClick={() => setColumns([...columns, { name: "column", type: "VARCHAR", pk: false, required: false }])}>+ Column</button></div><pre className="ddl">{ddl}</pre><button className="run" onClick={() => onCreate(ddl)}>Create table</button></Modal>;
}

export function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (file: File, name: string, type: string) => void }) {
  const [file, setFile] = useState<File | null>(null); const [name, setName] = useState("");
  const type = file?.name.split(".").pop()?.toLowerCase() || "csv";
  const choose = (selected: File | null) => { setFile(selected); if (selected) setName(selected.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_") || "imported_data"); };
  return <Modal title="Import data" onClose={onClose}><p className="muted">DuckDB reads CSV, JSON, and Parquet directly into the in-memory database.</p><label>Source file<div className="file-row"><input type="file" accept=".csv,.json,.parquet" onChange={event => choose(event.target.files?.[0] || null)} /></div></label><label>Table name<input value={name} onChange={event => setName(event.target.value)} placeholder="imported_data" /></label><button className="run" disabled={!file || !name} onClick={() => file && onImport(file, name, type)}>Import {type.toUpperCase()}</button></Modal>;
}

export function ImportValuesModal({ schema, onClose, onImport }: { schema: TableMetadata[]; onClose: () => void; onImport: (file: File, table: string, type: string) => void }) {
  const [file, setFile] = useState<File | null>(null); const tables = schema.filter(table => table.kind === "BASE TABLE"); const [table, setTable] = useState(tables[0]?.name || "");
  const type = file?.name.split(".").pop()?.toLowerCase() || "csv";
  return <Modal title="Import values" onClose={onClose}><p className="muted">Append matching fields from a CSV, JSON, or Parquet file. Unknown fields are ignored.</p><label>Target table<select value={table} onChange={event => setTable(event.target.value)}>{tables.map(item => <option key={item.name}>{item.name}</option>)}</select></label><label>Source file<div className="file-row"><input type="file" accept=".csv,.json,.parquet" onChange={event => setFile(event.target.files?.[0] || null)} /></div></label><button className="run" disabled={!file || !table} onClick={() => file && onImport(file, table, type)}>Import {type.toUpperCase()}</button></Modal>;
}

export function ErdModal({ schema, onClose }: { schema: TableMetadata[]; onClose: () => void }) {
  return <Modal title="Schema diagram" onClose={onClose}><div className="erd">{schema.length ? schema.map(table => <article key={table.name}><strong>{table.name}</strong><small>{table.kind} · {table.row_count} rows</small>{table.columns.map(column => <div key={column.name}><b>{column.is_primary_key ? "PK" : "#"}</b><span>{column.name}</span><code>{column.data_type}</code></div>)}</article>) : <p className="muted">Create or import a table to see its schema.</p>}</div></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="overlay" onMouseDown={onClose}><div className="modal" onMouseDown={event => event.stopPropagation()}><div className="modal-title"><strong>{title}</strong><button onClick={onClose}>Close</button></div>{children}</div></div>; }
