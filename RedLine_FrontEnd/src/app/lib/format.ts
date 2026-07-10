// --- UTILS ---

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatKm(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value) + " km";
}

const STAGE_COLORS: Record<string, string> = {
  Original: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10",
  "Stage 1": "text-orange-300 border-orange-400/40 bg-orange-400/10",
  "Stage 2": "text-orange-300 border-orange-400/40 bg-orange-400/10",
  "Stage 3": "text-orange-200 border-orange-500/50 bg-orange-500/15",
  "Full Build": "text-orange-100 border-orange-500/60 bg-orange-500/20",
};

export function stageBadgeClass(stage: string): string {
  return STAGE_COLORS[stage] ?? STAGE_COLORS["Original"];
}
