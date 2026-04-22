interface Props {
  title: string;
  headers: Record<string, string>;
  color: string;
}

export function HeaderSection({ title, headers, color }: Props) {
  return (
    <section className="space-y-3">
      <h4 className={`${color} text-[10px] font-bold uppercase tracking-widest flex items-center gap-2`}>
        <span className="opacity-50">#</span> {title}
      </h4>
      <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800/50">
        <dl className="space-y-1.5">
          {Object.entries(headers).map(([key, value]) => (
            <div key={key} className="flex gap-3 text-[11px] leading-relaxed">
              <dt className="text-zinc-500 font-medium shrink-0 select-none lowercase">{key}:</dt>
              <dd className="text-zinc-400 break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
