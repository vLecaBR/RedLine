// --- COMPONENTS: Filtros Pill horizontais (scroll lateral no mobile) ---
export const FILTERS = ["Todos", "Modificados", "Originais", "McLaren", "Ferrari", "Nissan", "BMW", "Honda"];

export function FilterPills({
  active,
  onChange,
}: {
  active: string;
  onChange: (f: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FILTERS.map((f) => {
        const on = active === f;
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm transition ${
              on
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25"
            }`}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
}
