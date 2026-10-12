// One series of bars, newest last. The last bar (today) is full colour and
// the rest lighter; hover shows the exact value. Same look as the member app.
export function BarChart({
  values,
  labels,
  format = (v) => String(v),
  height = 170,
  label,
}: {
  values: number[];
  labels: string[];
  format?: (v: number) => string;
  height?: number;
  // Read out by screen readers in place of the bars.
  label: string;
}) {
  const max = Math.max(...values, 1) * 1.15;
  return (
    <div role="img" aria-label={label} className="relative mb-5 flex items-end gap-1.5" style={{ height }}>
      {values.map((v, i) => {
        const last = i === values.length - 1;
        return (
          <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
            <span className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-[11px] text-background opacity-0 transition-opacity group-hover:opacity-100">
              {labels[i]}: {format(v)}
            </span>
            <div
              className={`w-[64%] max-w-6.5 rounded-t transition group-hover:brightness-90 ${last ? "bg-brand" : "bg-brand/45"}`}
              style={{ height: `${(v / max) * 100}%`, minHeight: 2 }}
            />
            <span className="absolute -bottom-5 text-[10.5px] text-muted">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
