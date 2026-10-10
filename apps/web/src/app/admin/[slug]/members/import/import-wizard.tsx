"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button, Card } from "@/components/ui";
import {
  checkRows,
  IMPORT_BATCH,
  parseTable,
  templateCsv,
  toRawRows,
  type CheckedRow,
  type ImportPlan,
  type RawRow,
} from "@/lib/member-import";
import { importMembers, type ImportOutcome } from "./actions";

type Step =
  | { kind: "pick"; error?: string }
  | { kind: "preview"; raw: RawRow[]; checked: CheckedRow[] }
  | { kind: "importing"; done: number; total: number }
  | { kind: "done"; results: ImportOutcome[]; error?: string };

const COLUMN_HELP: [string, string][] = [
  ["Name", "Required."],
  ["Phone", "10-digit mobile. Phone or Email is required; they also match members already in GOS."],
  ["Email", "Optional. Members with an email can sign in to the app straight away."],
  ["Plan", "Optional. Must match a plan name in GOS exactly (any capitals)."],
  ["Last paid on", "Needed with a plan. The day their current period started, e.g. 01/10/2026."],
  ["Paid until", "Optional. Leave blank to work it out from the plan, or fill it in (e.g. calendar months: 31/10/2026)."],
  ["Amount", "Optional. Recorded as a payment on the last paid date, so it shows in their history."],
];

const fmt = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export function ImportWizard({ slug, gymSlug, plans, countryCode }: {
  slug: string;
  gymSlug: string;
  plans: ImportPlan[];
  countryCode: string;
}) {
  const [step, setStep] = useState<Step>({ kind: "pick" });

  function load(text: string) {
    const { rows, error } = toRawRows(parseTable(text));
    if (error) return setStep({ kind: "pick", error });
    setStep({ kind: "preview", raw: rows, checked: checkRows(rows, plans, countryCode) });
  }

  async function runImport(raw: RawRow[], checked: CheckedRow[]) {
    const ready = checked.flatMap((c, i) => (c.problems.length ? [] : [{ line: c.line, row: raw[i] }]));
    const skipped: ImportOutcome[] = checked
      .filter((c) => c.problems.length)
      .map((c) => ({ line: c.line, outcome: "failed", message: c.problems.join("; ") }));
    const results: ImportOutcome[] = [];
    setStep({ kind: "importing", done: 0, total: ready.length });
    for (let i = 0; i < ready.length; i += IMPORT_BATCH) {
      try {
        const res = await importMembers({ slug, rows: ready.slice(i, i + IMPORT_BATCH) });
        if (res.error) return setStep({ kind: "done", results: [...results, ...skipped], error: res.error });
        results.push(...res.results);
      } catch {
        return setStep({
          kind: "done",
          results: [...results, ...skipped],
          error: "The connection dropped. Members imported so far are saved; import the file again to add the rest (people already added are skipped).",
        });
      }
      setStep({ kind: "importing", done: Math.min(i + IMPORT_BATCH, ready.length), total: ready.length });
    }
    setStep({ kind: "done", results: [...results, ...skipped] });
  }

  if (step.kind === "pick") {
    return <PickFile plans={plans} gymSlug={gymSlug} error={step.error} onText={load} onError={(error) => setStep({ kind: "pick", error })} />;
  }
  if (step.kind === "preview") {
    return <Preview checked={step.checked} plans={plans} onBack={() => setStep({ kind: "pick" })} onImport={() => runImport(step.raw, step.checked)} />;
  }
  if (step.kind === "importing") {
    const pct = step.total ? Math.round((step.done / step.total) * 100) : 100;
    return (
      <Card className="max-w-xl space-y-3">
        <p className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin" /> Importing members… {step.done} of {step.total}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-border/60" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-muted">Keep this page open until it finishes.</p>
      </Card>
    );
  }
  return <Done slug={slug} results={step.results} error={step.error} onAgain={() => setStep({ kind: "pick" })} />;
}

function PickFile({ plans, gymSlug, error, onText, onError }: {
  plans: ImportPlan[];
  gymSlug: string;
  error?: string;
  onText: (text: string) => void;
  onError: (error: string) => void;
}) {
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);

  function downloadTemplate() {
    const blob = new Blob(["﻿" + templateCsv(plans)], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${gymSlug}-members-template.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      return onError("That's an Excel file. In Excel choose File → Save as → CSV (UTF-8), then upload the CSV. Or copy the rows and paste them below.");
    }
    onText(await file.text());
  }

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold">1. Fill in the template</h2>
          <p className="mt-1 text-sm text-muted">Open it in Excel or Google Sheets, paste your members in, and save as CSV.</p>
        </div>
        <Button variant="secondary" onClick={downloadTemplate}>
          <Download className="size-4" /> Download template
        </Button>
        <dl className="divide-y divide-border rounded-xl border border-border text-sm">
          {COLUMN_HELP.map(([col, help]) => (
            <div key={col} className="grid grid-cols-[7rem_1fr] gap-3 px-3 py-2">
              <dt className="font-medium">{col}</dt>
              <dd className="text-muted">{help}</dd>
            </div>
          ))}
        </dl>
        {plans.length > 0 && (
          <p className="text-xs text-muted">Your plans: {plans.map((p) => p.name).join(", ")}</p>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">2. Upload it</h2>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0]); }}
          className={clsx(
            "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
            dragging ? "border-brand bg-brand/5" : "border-border hover:border-brand/60",
          )}
        >
          <FileUp className="size-8 text-muted" />
          <span className="font-medium">Choose a CSV file or drop it here</span>
          <span className="text-xs text-muted">Excel: File → Save as → CSV (UTF-8)</span>
          <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
        </label>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-border" /> or paste from a spreadsheet <span className="h-px flex-1 bg-border" />
        </div>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder={"Copy the rows, including the header row, and paste here"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-brand"
        />
        <Button disabled={!pasted.trim()} onClick={() => onText(pasted)}>
          Check pasted rows
        </Button>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </Card>
    </div>
  );
}

function Preview({ checked, plans, onBack, onImport }: {
  checked: CheckedRow[];
  plans: ImportPlan[];
  onBack: () => void;
  onImport: () => void;
}) {
  const [problemsOnly, setProblemsOnly] = useState(false);
  const planName = useMemo(() => new Map(plans.map((p) => [p.id, p.name])), [plans]);
  const ready = checked.filter((c) => !c.problems.length).length;
  const problems = checked.length - ready;
  const withPlan = checked.filter((c) => !c.problems.length && c.plan_id).length;
  const shown = problemsOnly ? checked.filter((c) => c.problems.length) : checked;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-sm font-medium">
          <CheckCircle2 className="size-4 text-brand" /> {ready} ready
          {withPlan > 0 && <span className="font-normal text-muted">· {withPlan} with a membership</span>}
        </span>
        {problems > 0 && (
          <button
            type="button"
            onClick={() => setProblemsOnly((p) => !p)}
            className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", problemsOnly ? "bg-amber-500 text-white" : "bg-amber-500/15")}
          >
            <AlertTriangle className="size-4" /> {problems} need fixing {problemsOnly ? "· show all" : "· show only these"}
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={onBack}>
            <RotateCcw className="size-4" /> Choose another file
          </Button>
          <Button disabled={!ready} onClick={onImport}>
            <Upload className="size-4" /> Import {ready} {ready === 1 ? "member" : "members"}
          </Button>
        </div>
      </div>
      {problems > 0 && (
        <p className="text-sm text-muted">Rows that need fixing are skipped. Fix them in your file and import it again later; members already added are skipped then.</p>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="p-3 font-medium">Row</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Phone / email</th>
              <th className="p-3 font-medium">Membership</th>
              <th className="p-3 text-right font-medium">Amount</th>
              <th className="p-3 font-medium">Check</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.line} className={clsx("border-b border-border last:border-0", c.problems.length > 0 && "bg-amber-500/5")}>
                <td className="p-3 text-muted">{c.line}</td>
                <td className="p-3 font-medium">{c.full_name || "—"}</td>
                <td className="p-3">
                  <div>{c.phone}</div>
                  {c.email && <div className="text-xs text-muted">{c.email}</div>}
                </td>
                <td className="p-3">
                  {c.plan_id ? (
                    <>
                      <div>{planName.get(c.plan_id)}</div>
                      <div className="text-xs text-muted">{fmt(c.starts_on)} – {fmt(c.ends_on)}</div>
                    </>
                  ) : (
                    <span className="text-muted">No plan</span>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums">{c.amount_paise !== null ? `₹${(c.amount_paise / 100).toLocaleString("en-IN")}` : ""}</td>
                <td className="p-3">
                  {c.problems.length ? (
                    <span className="text-amber-700 dark:text-amber-400">{c.problems.join("; ")}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-brand"><CheckCircle2 className="size-4" /> Ready</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Done({ slug, results, error, onAgain }: { slug: string; results: ImportOutcome[]; error?: string; onAgain: () => void }) {
  const added = results.filter((r) => r.outcome === "added").length;
  const exists = results.filter((r) => r.outcome === "exists");
  const failed = results.filter((r) => r.outcome === "failed").sort((a, b) => a.line - b.line);

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="space-y-3">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="size-5 text-brand" /> {added} {added === 1 ? "member" : "members"} added
        </p>
        {exists.length > 0 && <p className="text-sm text-muted">{exists.length} were already in your gym and were left as they are.</p>}
        {failed.length > 0 && <p className="text-sm text-muted">{failed.length} weren&apos;t added (listed below).</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/admin/${slug}/members`} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:opacity-90">
            View members
          </Link>
          <Button variant="secondary" onClick={onAgain}>Import another file</Button>
        </div>
      </Card>
      {failed.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-border text-sm">
            {failed.map((f) => (
              <li key={f.line} className="flex gap-3 px-4 py-2">
                <span className="w-14 shrink-0 text-muted">Row {f.line}</span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
