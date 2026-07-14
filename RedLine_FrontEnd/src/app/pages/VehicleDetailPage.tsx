// --- PAGES: Single Page do Veículo (foco na conversão) ---
import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Calendar,
  Gauge,
  Cog,
  Wind,
  Sofa,
  MapPin,
  Eye,
  Zap,
  BadgeCheck,
} from "lucide-react";
import type { Vehicle } from "../types";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Badge } from "../components/Badge";
import { VehicleCard } from "../components/VehicleCard";
import { SpecAccordion } from "../components/SpecAccordion";
import { formatPrice, formatKm, stageBadgeClass } from "../lib/format";
import { useSeller, useSellerVehicles } from "../hooks";
import { useApp } from "../store";

const AVATAR_FALLBACK =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200";

export function VehicleDetailPage({
  vehicle,
  loading,
  error,
  onBack,
  onContact,
  onOpenVehicle,
}: {
  vehicle?: Vehicle;
  loading?: boolean;
  error?: unknown;
  onBack: () => void;
  onContact: () => void;
  onOpenVehicle?: (id: string) => void;
}) {
  const { isFavorite, toggleFavorite } = useApp();
  const { seller } = useSeller(vehicle?.sellerId);
  const [activeImg, setActiveImg] = useState(0);
  const [showSellerCars, setShowSellerCars] = useState(false);

  // Só busca quando o usuário clica em "Ver mais…" (RF-10).
  const { cars: sellerCars, loading: sellerLoading } = useSellerVehicles(
    showSellerCars ? vehicle?.sellerId : undefined
  );

  // Estado de carregamento: skeleton enquanto o GET não resolve.
  if (loading) {
    return (
      <div className="pb-32">
        <div className="aspect-[4/3] w-full animate-pulse bg-white/5 sm:aspect-video" />
        <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
          <div className="h-6 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  // Estado de erro / não encontrado.
  if (error || !vehicle) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 pb-24 pt-32 text-center">
        <h1 className="text-white" style={{ fontWeight: 800 }}>
          Veículo não encontrado
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          O anúncio que você procura não existe mais ou o link está incorreto.
        </p>
        <button
          onClick={onBack}
          className="mt-6 min-h-[48px] rounded-xl border border-white/10 bg-white/5 px-6 text-slate-200 transition hover:border-white/25"
        >
          Voltar para a vitrine
        </button>
      </div>
    );
  }

  const fav = isFavorite(vehicle.id);
  const otherSellerCars = sellerCars.filter((v) => v.id !== vehicle.id);

  const facts = [
    { icon: Calendar, label: "Ano", value: String(vehicle.year) },
    { icon: Gauge, label: "Km", value: formatKm(vehicle.mileage) },
    { icon: Cog, label: "Câmbio", value: vehicle.transmission },
  ];

  return (
    <div className="pb-32">
      {/* GALERIA IMERSIVA com swipe horizontal */}
      <div className="relative">
        <motion.div layoutId={`vehicle-image-${vehicle.id}`} className="relative">
          <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {vehicle.images.map((img, i) => (
              <div
                key={i}
                className="relative aspect-[4/3] w-full shrink-0 snap-center sm:aspect-video"
                onScroll={() => setActiveImg(i)}
              >
                <ImageWithFallback
                  src={img}
                  alt={`${vehicle.title} — foto ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </motion.div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/40" />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <button
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-md"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={() => toggleFavorite(vehicle.id)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-md"
          >
            <Heart className={`h-5 w-5 ${fav ? "fill-orange-500 text-orange-500" : "text-white"}`} />
          </button>
        </div>

        {/* Dots */}
        {vehicle.images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {vehicle.images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeImg ? "w-6 bg-orange-500" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-4">
        {/* Cabeçalho */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="pt-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge className={stageBadgeClass(vehicle.stage)}>
              {vehicle.stage !== "Original" && <Zap className="h-3 w-3" />}
              {vehicle.stage}
            </Badge>
            <Badge className="border-white/15 bg-white/5 text-slate-200">Tier {vehicle.tier}</Badge>
            {vehicle.customSpecs.hasDyno && (
              <Badge className="border-green-400/30 bg-green-400/10 text-green-300">
                <BadgeCheck className="h-3 w-3" /> Dyno comprovado
              </Badge>
            )}
          </div>
          <h1 className="text-white" style={{ fontWeight: 800, letterSpacing: "-0.01em" }}>
            {vehicle.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {vehicle.location}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" /> {vehicle.views.toLocaleString("pt-BR")} visualizações
            </span>
          </p>
        </motion.div>

        {/* Ficha técnica */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {facts.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"
            >
              <Icon className="mx-auto mb-1.5 h-5 w-5 text-cyan-300" />
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-0.5 text-sm text-white">{value}</p>
            </div>
          ))}
        </div>

        {vehicle.customSpecs.claimedHp && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
            <span className="text-slate-300">Potência estimada</span>
            <span className="text-cyan-300" style={{ fontWeight: 800, fontSize: "1.25rem" }}>
              {vehicle.customSpecs.claimedHp} cv
            </span>
          </div>
        )}

        {/* Especificações customizadas */}
        <h2 className="mt-8 text-white">Especificações Customizadas</h2>
        <div className="mt-3 space-y-3">
          <SpecAccordion icon={Cog} title="Motor & Powertrain" items={vehicle.customSpecs.engine} defaultOpen />
          <SpecAccordion icon={Wind} title="Suspensão & Chassi" items={vehicle.customSpecs.suspension} />
          <SpecAccordion icon={Sofa} title="Interior & Cockpit" items={vehicle.customSpecs.interior} />
        </div>

        {/* Card de confiança do vendedor */}
        {seller && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-4">
              <img
                src={seller.avatarUrl ?? AVATAR_FALLBACK}
                alt={seller.name}
                className="h-14 w-14 rounded-full border-2 border-orange-500/50 object-cover"
              />
              <div className="flex-1">
                <p className="flex items-center gap-1.5 text-white">
                  {seller.name} <BadgeCheck className="h-4 w-4 text-cyan-400" />
                </p>
                <p className="text-sm text-slate-400">Na plataforma desde {seller.memberSince}</p>
              </div>
            </div>

            {/* RF-10: "Ver mais N veículos deste vendedor" consome GET /api/sellers/{id}/vehicles */}
            {!showSellerCars ? (
              <button
                onClick={() => setShowSellerCars(true)}
                className="mt-4 min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 text-sm text-slate-200 transition hover:border-white/25"
              >
                Ver mais {seller.vehicleCount} veículos deste vendedor
              </button>
            ) : (
              <div className="mt-4">
                {sellerLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/5" />
                    ))}
                  </div>
                ) : otherSellerCars.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Este vendedor não tem outros anúncios no momento.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {otherSellerCars.map((v) => (
                      <VehicleCard
                        key={v.id}
                        vehicle={v}
                        onOpen={(id) => onOpenVehicle?.(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BARRA DE AÇÃO FIXA (sticky bottom) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-900/90 backdrop-blur-xl md:mx-auto md:max-w-3xl md:rounded-t-2xl md:border-x">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex-1">
            <p className="text-xs text-slate-500">Preço à vista</p>
            <p className="text-orange-500" style={{ fontWeight: 800, fontSize: "1.3rem" }}>
              {formatPrice(vehicle.price)}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            animate={{ boxShadow: ["0 0 0 0 rgba(37,211,102,0.5)", "0 0 0 12px rgba(37,211,102,0)"] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            onClick={onContact}
            className="flex min-h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-white"
            style={{ fontWeight: 700 }}
          >
            <MessageCircle className="h-5 w-5" /> Chamar Vendedor
          </motion.button>
        </div>
      </div>
    </div>
  );
}
