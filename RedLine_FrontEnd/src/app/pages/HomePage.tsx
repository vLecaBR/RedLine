// --- PAGES: Home ("A Vitrine Inteligente") ---
import { useState } from "react";
import { motion } from "motion/react";
import { PlusCircle, Sparkles, Search } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { VehicleCard } from "../components/VehicleCard";
import { FilterPills } from "../components/FilterPills";
import { useCars } from "../hooks";

const HERO_IMG =
  "https://images.unsplash.com/photo-1610374634235-b51ef357f905?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600";

type Sort = "recent" | "priceAsc" | "priceDesc" | "views";

export function HomePage({ onOpenVehicle }: { onOpenVehicle: (id: string) => void }) {
  const [filter, setFilter] = useState("Todos");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const { cars, loading, error } = useCars({
    filter,
    q: q.trim() || undefined,
    sort,
  });

  return (
    <div className="pb-8">
      {/* HERO */}
      <section className="relative -mt-[64px] h-[78vh] min-h-[520px] w-full overflow-hidden">
        <ImageWithFallback
          src={HERO_IMG}
          alt="Carro de pista à noite"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/70" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300"
          >
            <Sparkles className="h-3.5 w-3.5" /> O marketplace dos projetos de verdade
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-2xl text-white"
            style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em" }}
          >
            Onde motores modificados encontram donos de verdade.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-4 max-w-xl text-slate-300"
          >
            Originais impecáveis ou builds de arrancar aplausos. Anuncie, filtre por stage e fale com o vendedor em segundos.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            whileTap={{ scale: 0.97 }}
            style={{ boxShadow: "0 0 0 0 rgba(255,90,0,0.5)", fontWeight: 700 }}
            className="pulse-cta mt-6 flex min-h-[52px] w-fit items-center gap-2 rounded-xl bg-orange-500 px-6 text-white"
          >
            <PlusCircle className="h-5 w-5" /> Anunciar Meu Projeto
          </motion.button>
        </div>
      </section>

      {/* VITRINE */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="sticky top-[64px] z-30 -mx-4 space-y-3 bg-slate-900/80 px-4 py-3 backdrop-blur-md">
          {/* Busca (q) + ordenação (sort) ligadas aos params */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título, marca ou modelo…"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-orange-500/60 focus:outline-none"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-200 focus:border-orange-500/60 focus:outline-none"
            >
              <option value="recent">Mais recentes</option>
              <option value="priceAsc">Menor preço</option>
              <option value="priceDesc">Maior preço</option>
              <option value="views">Mais vistos</option>
            </select>
          </div>

          <FilterPills active={filter} onChange={setFilter} />
        </div>

        {error ? (
          <div className="mt-16 flex flex-col items-center text-center text-slate-400">
            <p className="text-white" style={{ fontWeight: 700 }}>
              Não foi possível carregar a vitrine
            </p>
            <p className="mt-1 text-sm">Verifique se a RedlineApi está no ar e tente novamente.</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-5 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-16 text-center text-slate-400">
            Nenhum veículo encontrado para os filtros atuais.
          </div>
        ) : (
          <motion.div
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-5 pt-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {cars.map((v) => (
              <VehicleCard key={v.id} vehicle={v} onOpen={onOpenVehicle} />
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
