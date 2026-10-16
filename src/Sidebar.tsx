import { useState } from "react";
import type { HistoryItem, TableMetadata } from "./types";

type Props = { schema: TableMetadata[]; history: HistoryItem[]; onSelect: (sql: string) => void; onDrop: (name: string) => void };
const snippets = [
  ["Aggregation", "SELECT category, count(*) AS count\nFROM table_name\nGROUP BY category\nORDER BY count DESC;"],
  ["Window function", "SELECT *, row_number() OVER (PARTITION BY category ORDER BY created_at) AS row_num\nFROM table_name;"],
  ["Join", "SELECT a.*, b.*\nFROM first_table a\nJOIN second_table b ON a.id = b.id;"]
];

export default function Sidebar({ schema, history, onSelect, onDrop }: Props) {
  const [tab, setTab] = useState<"tables" | "snippets" | "history">("tables");
  const [search, setSearch] = useState("");
  const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase());
  return <aside className="sidebar">
    <nav className="side-tabs">{(["tables", "snippets", "history"] as const).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {tab === "tables" && <div className="side-content"><input className="schema-search" placeholder="Search schema" value={search} onChange={event => setSearch(event.target.value)} /><p className="tree-root">IN-MEMORY DATABASE</p>{schema.filter(table => matches(table.name) || table.columns.some(column => matches(column.name))).map(table => <details key={table.name} open><summary><span>{table.kind === "VIEW" ? "V" : "T"}</span>{table.name}<em>{table.row_count}</em></summary><div className="table-actions"><button onClick={() => onSelect(`SELECT * FROM "${table.name}" LIMIT 100;`)}>SELECT 100</button><button onClick={() => onSelect(`DESCRIBE "${table.name}";`)}>Inspect</button><button className="danger" onClick={() => onDrop(table.name)}>Drop</button></div>{table.columns.map(column => <div className="column" key={column.name}><span>{column.is_primary_key ? "PK" : "#"}</span>{column.name}<code>{column.data_type}</code></div>)}</details>)}{!schema.length && <div className="empty-side">No tables yet.<br />Import data or create one.</div>}</div>}
    {tab === "snippets" && <div className="side-content snippets">{snippets.map(([name, sql]) => <button key={name} onClick={() => onSelect(sql)}><strong>{name}</strong><code>{sql}</code></button>)}</div>}
    {tab === "history" && <div className="side-content history">{history.length ? history.map(item => <button key={item.id} onClick={() => onSelect(item.sql)}><span className={item.error ? "status error" : "status"}>{item.error ? "Error" : "Success"}</span><code>{item.sql.replace(/\s+/g, " ")}</code><small>{new Date(item.timestamp).toLocaleTimeString()} · {item.duration.toFixed(2)} ms</small></button>) : <div className="empty-side">Executed queries appear here.</div>}</div>}
  </aside>;
}
