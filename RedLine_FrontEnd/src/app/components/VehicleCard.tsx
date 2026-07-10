// --- COMPONENTS: VehicleCard ---
import { motion } from "motion/react";
import { Heart, Gauge, Zap, MapPin } from "lucide-react";
import type { Vehicle } from "../types";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Badge } from "./Badge";
import { formatPrice, formatKm, stageBadgeClass } from "../lib/format";
import { useApp } from "../store";

export function VehicleCard({
  vehicle,
  onOpen,
}: {
  vehicle: Vehicle;
  onOpen: (id: string) => void;
}) {
  const { isFavorite, toggleFavorite } = useApp();
  const fav = isFavorite(vehicle.id);

  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0 },
      }}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      onClick={() => onOpen(vehicle.id)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 backdrop-blur-md"
    >
      {/* Imagem 16:9 com layoutId para shared transition */}
      <div className="relative aspect-video overflow-hidden">
        <motion.div layoutId={`vehicle-image-${vehicle.id}`} className="absolute inset-0">
          <ImageWithFallback
            src={vehicle.images[0]}
            alt={vehicle.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        </motion.div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />

        {/* Badges */}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge className={stageBadgeClass(vehicle.stage)}>
            {vehicle.stage !== "Original" && <Zap className="h-3 w-3" />}
            {vehicle.stage}
          </Badge>
          <Badge className="border-white/15 bg-black/40 text-slate-200">Tier {vehicle.tier}</Badge>
        </div>

        {/* Favorito */}
        <button
          aria-label="Favoritar"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(vehicle.id);
          }}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-md transition hover:bg-black/60"
        >
          <Heart
            className={`h-5 w-5 transition ${fav ? "fill-orange-500 text-orange-500" : "text-white"}`}
          />
        </button>

        {/* Título sobre o gradiente */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-white drop-shadow">{vehicle.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-300">
            <MapPin className="h-3 w-3" /> {vehicle.location}
          </p>
        </div>
      </div>

      {/* Rodapé do card */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-lg text-orange-500" style={{ fontWeight: 700 }}>
            {formatPrice(vehicle.price)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Gauge className="h-3.5 w-3.5" /> {formatKm(vehicle.mileage)} · {vehicle.year}
          </p>
        </div>
        {vehicle.customSpecs.claimedHp && (
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-center">
            <span className="block text-sm text-cyan-300" style={{ fontWeight: 700 }}>
              {vehicle.customSpecs.claimedHp}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-cyan-400/70">cv</span>
          </div>
        )}
      </div>
    </motion.article>
  );
}
