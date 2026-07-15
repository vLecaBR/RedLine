// --- PAGES: Dashboard do Lojista (Multi-tenant B2B) ---
// Fase 4: dados REAIS da loja logada (GET /api/leads, GET /api/dashboard/kpis) e
// transição de status (PATCH /api/leads/{id}/status). Nada de mock no caminho.
import { useState } from "react";
import { motion } from "motion/react";
import {
  Boxes,
  Inbox,
  Users,
  Settings,
  Plus,
  Car,
  Eye,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  ChevronDown,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useKpis, useLeads, useUpdateLeadStatus } from "../hooks";
import { useApp } from "../store";
import type { Lead, LeadStatus } from "../types";
import { ApiError } from "../lib/api";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "estoque", label: "Estoque", icon: Boxes },
  { id: "leads", label: "Leads", icon: Inbox },
  { id: "equipe", label: "Equipe", icon: Users },
  { id: "config", label: "Configurações", icon: Settings },
];

const KPI_ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  car: Car,
  eye: Eye,
  "trending-up": TrendingUp,
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  Novo: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  "Em atendimento": "border-orange-400/30 bg-orange-400/10 text-orange-300",
  Convertido: "border-green-400/30 bg-green-400/10 text-green-300",
  Perdido: "border-red-400/30 bg-red-400/10 text-red-300",
};

// Transições válidas (espelha a máquina de estados do backend — §4.3). Terminais = [].
const NEXT_STATUSES: Record<LeadStatus, LeadStatus[]> = {
  Novo: ["Em atendimento", "Convertido", "Perdido"],
  "Em atendimento": ["Convertido", "Perdido"],
  Convertido: [],
  Perdido: [],
};

export function DashboardPage({ onBack }: { onBack: () => void }) {
  const { user } = useApp();
  const { cards, loading: kpisLoading, error: kpisError } = useKpis();
  const { leads, loading: leadsLoading, error: leadsError } = useLeads();
  const { updateStatus } = useUpdateLeadStatus();
  const [nav, setNav] = useState("leads");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const storeLabel = user?.storeName ?? "Painel";

  async function handleStatusChange(lead: Lead, next: LeadStatus) {
    if (next === lead.status) return;
    setPendingId(lead.id);
    try {
      await updateStatus(lead.id, next);
      toast.success(`Status atualizado para "${next}".`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível atualizar o status.";
      toast.error(msg);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 pb-24 pt-20">
      {/* SIDEBAR */}
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-20 space-y-1 rounded-2xl border border-white/10 bg-white/5 p-3">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setNav(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                nav === id ? "bg-orange-500 text-white" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <Icon className="h-5 w-5" /> {label}
            </button>
          ))}
        </div>
      </aside>

      {/* PAINEL PRINCIPAL */}
      <main className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 md:hidden"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <div>
              <h1 className="text-white" style={{ fontWeight: 800 }}>
                Painel do Lojista
              </h1>
              <p className="text-sm text-slate-400">{storeLabel}</p>
            </div>
          </div>
          <button
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm text-white"
            style={{ fontWeight: 700 }}
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar Veículo</span>
          </button>
        </div>

        {/* KPIs */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpisLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Skeleton className="h-9 w-9 rounded-lg bg-white/10" />
                <Skeleton className="mt-3 h-7 w-20 bg-white/10" />
                <Skeleton className="mt-2 h-3 w-24 bg-white/10" />
              </div>
            ))
          ) : kpisError ? (
            <div className="col-span-2 flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300 lg:col-span-4">
              <AlertCircle className="h-4 w-4" /> Não foi possível carregar os KPIs.
            </div>
          ) : (
            cards.map((kpi) => {
              const Icon = KPI_ICONS[kpi.icon] ?? Inbox;
              const flat = kpi.delta === 0;
              const up = kpi.delta > 0;
              return (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    {!flat && (
                      <span
                        className={`flex items-center gap-0.5 text-xs ${up ? "text-green-400" : "text-red-400"}`}
                      >
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(kpi.delta)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-white" style={{ fontWeight: 800, fontSize: "1.6rem" }}>
                    {kpi.value}
                  </p>
                  <p className="text-xs text-slate-400">{kpi.label}</p>
                </motion.div>
              );
            })
          )}
        </div>

        {/* TABELA DE LEADS COM DISTRIBUIÇÃO */}
        <h2 className="mt-8 text-white">Leads recentes & distribuição</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {/* Cabeçalho (desktop) */}
          <div className="hidden grid-cols-12 gap-2 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-slate-500 md:grid">
            <span className="col-span-3">Cliente</span>
            <span className="col-span-4">Veículo</span>
            <span className="col-span-3">Vendedor</span>
            <span className="col-span-2 text-right">Status</span>
          </div>

          {leadsLoading ? (
            <div className="divide-y divide-white/5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                  <Skeleton className="col-span-3 h-8 bg-white/10" />
                  <Skeleton className="col-span-4 h-8 bg-white/10" />
                  <Skeleton className="col-span-3 h-8 bg-white/10" />
                  <Skeleton className="col-span-2 h-6 justify-self-end bg-white/10" />
                </div>
              ))}
            </div>
          ) : leadsError ? (
            <div className="flex items-center gap-2 px-4 py-10 text-sm text-red-300">
              <AlertCircle className="h-4 w-4" /> Não foi possível carregar os leads.
            </div>
          ) : leads.length === 0 ? (
            <div className="px-4 py-14 text-center text-sm text-slate-400">
              <Inbox className="mx-auto mb-2 h-6 w-6 text-slate-500" />
              Nenhum lead ainda. Assim que um cliente demonstrar interesse, ele aparece aqui.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {leads.map((lead: Lead) => {
                const targets = NEXT_STATUSES[lead.status];
                const terminal = targets.length === 0;
                const busy = pendingId === lead.id;
                return (
                  <div
                    key={lead.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-12 md:items-center"
                  >
                    <div className="md:col-span-3">
                      <p className="text-sm text-white">{lead.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(lead.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="md:col-span-4">
                      <p className="flex items-center gap-2 text-sm text-slate-200">
                        {lead.vehicleTitle}
                        <Badge className="border-white/15 bg-white/5 text-slate-300">
                          Tier {lead.tier}
                        </Badge>
                      </p>
                      <p className="truncate text-xs text-slate-500">{lead.message}</p>
                    </div>
                    <div className="text-sm text-slate-300 md:col-span-3">
                      <span className="text-slate-500 md:hidden">Atendido por: </span>
                      {lead.assignedSellerName}
                    </div>
                    <div className="md:col-span-2 md:flex md:justify-end">
                      {terminal ? (
                        <Badge className={STATUS_STYLE[lead.status]}>{lead.status}</Badge>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            disabled={busy}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60 ${STATUS_STYLE[lead.status]}`}
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            {lead.status}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {targets.map((next) => (
                              <DropdownMenuItem
                                key={next}
                                onClick={() => handleStatusChange(lead, next)}
                              >
                                Mover para “{next}”
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
