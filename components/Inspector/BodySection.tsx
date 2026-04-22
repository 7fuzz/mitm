interface Props {
  title: string;
  body: string;
  color: string;
}

export function BodySection({ title, body, color }: Props) {
  if (!body) return null;

  // Try to format as JSON if possible
  let displayBody = body;
  try {
    const json = JSON.parse(body);
    displayBody = JSON.stringify(json, null, 2);
  } catch (e) {
    displayBody = body;
  }

  return (
    <section className="space-y-3">
      <h4 className={`${color} text-[10px] font-bold uppercase tracking-widest flex items-center gap-2`}>
        <span className="opacity-50">#</span> {title}
      </h4>
      <div className="relative group">
        <pre className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 overflow-x-auto text-[11px] text-zinc-300 leading-normal scrollbar-thin scrollbar-thumb-zinc-700">
          <code>{displayBody}</code>
        </pre>
      </div>
    </section>
  );
}
