// --- COMPONENTS: Filtros Pill horizontais (scroll lateral no mobile) ---
// RF-08: sem marcas hardcoded. Pills fixas + marcas dinâmicas de GET /api/vehicles/brands.
import { useBrands } from "../hooks";

const FIXED = ["Todos", "Modificados", "Originais"];

export function FilterPills({
  active,
  onChange,
}: {
  active: string;
  onChange: (f: string) => void;
}) {
  const { brands, loading } = useBrands();
  const pills = [...FIXED, ...brands.map((b) => b.brand)];

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {pills.map((f) => {
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

      {loading &&
        Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`sk-${i}`}
            className="h-[44px] w-24 shrink-0 animate-pulse rounded-full bg-white/5"
          />
        ))}
    </div>
  );
}
