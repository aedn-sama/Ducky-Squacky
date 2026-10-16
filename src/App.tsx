import { useEffect, useRef, useState } from "react";
import { executeQuery, exportData, importFile, importValues, schemaMetadata } from "./lib";
import type { HistoryItem, QueryResult, QueryTab, TableMetadata } from "./types";
import Sidebar from "./Sidebar";
import SqlEditor from "./SqlEditor";
import DataGrid from "./DataGrid";
import { CreateTableModal, ErdModal, ImportModal, ImportValuesModal } from "./Modals";

const starter = "-- DuckDB is ready\nSELECT 'Hello from Ducky Squacky' AS message, 42 AS answer;";
const freshTab = (): QueryTab => ({ id: crypto.randomUUID(), title: "Query", sql: starter });
type SavedState = { tabs?: QueryTab[]; active?: number; history?: HistoryItem[] };
const savedState = (): SavedState => { try { return JSON.parse(localStorage.getItem("ducky-state") || "{}"); } catch { return {}; } };

export default function App() {
  const saved = savedState();
  const [tabs, setTabs] = useState<QueryTab[]>(saved.tabs?.length ? saved.tabs : [freshTab()]);
  const [active, setActive] = useState(saved.active && saved.active < (saved.tabs?.length || 0) ? saved.active : 0);
  const [schema, setSchema] = useState<TableMetadata[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(saved.history || JSON.parse(localStorage.getItem("ducky-history") || "[]"));
  const [modal, setModal] = useState<"create" | "import" | "values" | "erd" | null>(null);
  const sqlFile = useRef<HTMLInputElement>(null);
  const current = tabs[active];
  const refreshSchema = () => schemaMetadata().then(setSchema).catch(() => undefined);
  const showError = (error: unknown) => setResult({ columns: [], column_types: [], rows: [], row_count: 0, affected_rows: null, duration_ms: 0, is_error: true, error_message: String(error) });

  useEffect(() => { refreshSchema(); }, []);
  useEffect(() => { localStorage.setItem("ducky-state", JSON.stringify({ tabs, active, history: history.slice(0, 100) })); }, [tabs, active, history]);
  const updateSql = (sql: string) => setTabs(items => items.map((tab, index) => index === active ? { ...tab, sql } : tab));
  const run = async (sql = current.sql) => {
    setRunning(true);
    try {
      const queryResult = await executeQuery(sql);
      setResult(queryResult);
      setHistory(items => [{ id: crypto.randomUUID(), sql, timestamp: new Date().toISOString(), duration: queryResult.duration_ms, error: queryResult.is_error }, ...items].slice(0, 100));
      refreshSchema();
    } catch (error) { showError(error); } finally { setRunning(false); }
  };
  const openSql = (sql: string) => { setTabs(items => [...items, { id: crypto.randomUUID(), title: "Query", sql }]); setActive(tabs.length); };
  const openQueryFile = async (file: File) => { try { openSql(await file.text()); } catch (error) { showError(error); } };
  const saveQuery = () => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([current.sql], { type: "text/sql" })); link.download = "query.sql"; link.click(); URL.revokeObjectURL(link.href); };
  const format = () => updateSql(current.sql.replace(/\s+/g, " ").replace(/\s*(SELECT|FROM|WHERE|GROUP BY|ORDER BY|JOIN|LEFT JOIN)\s+/gi, "\n$1 ").trim());
  const importNewTable = async (file: File, name: string, type: string) => { setModal(null); setRunning(true); try { setResult(await importFile(file, name, type)); refreshSchema(); } catch (error) { showError(error); } finally { setRunning(false); } };
  const importIntoTable = async (file: File, table: string, type: string) => { setModal(null); setRunning(true); try { setResult(await importValues(file, table, type)); refreshSchema(); } catch (error) { showError(error); } finally { setRunning(false); } };
  const openDroppedFile = (file: File) => { const type = file.name.split(".").pop()?.toLowerCase() || ""; if (type === "sql") return openQueryFile(file); return importNewTable(file, file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_") || "imported_data", type); };
  const exportResult = async (format: string) => { const blob = await exportData(current.sql, format); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `duckdb-export.${format.toLowerCase()}`; link.click(); URL.revokeObjectURL(link.href); };

  return <main className="app-shell" onDragOverCapture={event => event.preventDefault()} onDropCapture={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void openDroppedFile(file); }}>
    <header className="topbar"><div className="brand"><span>DS</span><strong>Ducky Squacky</strong><small>DuckDB desktop client</small></div><div className="quick-actions"><button onClick={() => setModal("create")}>+ New table</button><button onClick={() => setModal("import")}>Import file</button><button onClick={() => sqlFile.current?.click()}>Open SQL</button><button onClick={() => setModal("values")}>Import values</button><button onClick={() => setModal("erd")}>ERD</button></div><div className="engine-status"><i /> DuckDB-WASM</div><input ref={sqlFile} type="file" accept=".sql,text/sql" hidden onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void openQueryFile(file); }} /></header>
    <div className="workspace"><Sidebar schema={schema} history={history} onSelect={openSql} onDrop={name => run(`DROP TABLE "${name}";`)} /><div className="main-pane"><div className="query-tabs">{tabs.map((tab, index) => <button key={tab.id} className={active === index ? "active" : ""} onClick={() => setActive(index)}>{tab.title} {tabs.length > 1 && <b onClick={event => { event.stopPropagation(); setTabs(items => items.filter((_, itemIndex) => itemIndex !== index)); setActive(value => Math.max(0, value - (index <= value ? 1 : 0))); }}>x</b>}</button>)}<button className="new-tab" onClick={() => { setTabs(items => [...items, freshTab()]); setActive(tabs.length); }}>+</button></div><SqlEditor value={current.sql} schema={schema} running={running} onChange={updateSql} onRun={run} onFormat={format} onSave={saveQuery} /><DataGrid result={result} onExport={exportResult} /></div></div>
    <footer className="app-footer"><span>DuckDB-WASM engine</span><span>{schema.length} tables · History saved locally</span></footer>
    {modal === "create" && <CreateTableModal onClose={() => setModal(null)} onCreate={sql => { setModal(null); run(sql); }} />}
    {modal === "import" && <ImportModal onClose={() => setModal(null)} onImport={importNewTable} />}
    {modal === "values" && <ImportValuesModal schema={schema} onClose={() => setModal(null)} onImport={importIntoTable} />}
    {modal === "erd" && <ErdModal schema={schema} onClose={() => setModal(null)} />}
  </main>;
}
