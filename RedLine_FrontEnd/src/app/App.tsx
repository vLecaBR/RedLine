import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, User as UserIcon, Store, LogOut, Settings } from "lucide-react";
import { Toaster } from "sonner";
import { AppProvider, useApp } from "./store";
import { Header } from "./components/Header";
import { BottomNav, type Tab } from "./components/BottomNav";
import { VehicleCard } from "./components/VehicleCard";
import { LeadRouletteSheet } from "./components/LeadRouletteSheet";
import { HomePage } from "./pages/HomePage";
import { VehicleDetailPage } from "./pages/VehicleDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { useCar } from "./hooks";
import { VEHICLES } from "./data/mocks";

// --- PAGES: Favoritos ---
function FavoritesPage({ onOpenVehicle }: { onOpenVehicle: (id: string) => void }) {
  const { favorites } = useApp();
  const cars = VEHICLES.filter((v) => favorites.includes(v.id));
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-24">
      <h1 className="text-white" style={{ fontWeight: 800 }}>
        Meus Favoritos
      </h1>
      <p className="mt-1 text-sm text-slate-400">{cars.length} veículo(s) salvos</p>
      {cars.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center text-slate-500">
          <Heart className="h-12 w-12" />
          <p className="mt-3">Nenhum favorito ainda. Toque no coração de um anúncio.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((v) => (
            <VehicleCard key={v.id} vehicle={v} onOpen={onOpenVehicle} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- PAGES: Perfil ---
function ProfilePage() {
  const { user, favorites } = useApp();
  const rows = [
    { icon: Store, label: "Meus anúncios", value: "4 ativos" },
    { icon: Heart, label: "Favoritos", value: `${favorites.length} salvos` },
    { icon: Settings, label: "Configurações", value: "" },
  ];
  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-24">
      <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="h-20 w-20 rounded-full border-2 border-orange-500/60 object-cover"
        />
        <p className="mt-3 text-white" style={{ fontWeight: 700 }}>
          {user.name}
        </p>
        <p className="text-sm text-slate-400">
          {user.role} · desde {user.memberSince}
        </p>
      </div>
      <div className="mt-4 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {rows.map(({ icon: Icon, label, value }) => (
          <button
            key={label}
            className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left hover:bg-white/5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex-1 text-slate-200">{label}</span>
            <span className="text-sm text-slate-500">{value}</span>
          </button>
        ))}
      </div>
      <button className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/5 text-red-300">
        <LogOut className="h-5 w-5" /> Sair da conta
      </button>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  const [openVehicleId, setOpenVehicleId] = useState<string | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const { vehicle, loading: vehicleLoading, error: vehicleError } = useCar(
    openVehicleId ?? undefined
  );

  const goTab = (t: Tab) => {
    setOpenVehicleId(null);
    setTab(t);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100" style={{ fontFamily: "Inter, sans-serif" }}>
      {!openVehicleId && <Header onMenu={() => goTab("dashboard")} />}

      <AnimatePresence mode="popLayout">
        {openVehicleId ? (
          <motion.div key="detail">
            <VehicleDetailPage
              vehicle={vehicle}
              loading={vehicleLoading}
              error={vehicleError}
              onBack={() => setOpenVehicleId(null)}
              onContact={() => setLeadOpen(true)}
            />
          </motion.div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {tab === "home" && <HomePage onOpenVehicle={setOpenVehicleId} />}
            {tab === "favorites" && <FavoritesPage onOpenVehicle={setOpenVehicleId} />}
            {tab === "dashboard" && <DashboardPage onBack={() => goTab("home")} />}
            {tab === "profile" && <ProfilePage />}
          </motion.div>
        )}
      </AnimatePresence>

      {!openVehicleId && <BottomNav active={tab} onChange={goTab} />}

      <LeadRouletteSheet open={leadOpen} onClose={() => setLeadOpen(false)} vehicle={vehicle ?? null} />

      {/* Nav desktop simples */}
      {!openVehicleId && (
        <div className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 md:flex">
          {([
            { id: "home", icon: Store },
            { id: "favorites", icon: Heart },
            { id: "dashboard", icon: Settings },
            { id: "profile", icon: UserIcon },
          ] as const).map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => goTab(id as Tab)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition ${
                tab === id
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25"
              }`}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      )}

      <Toaster theme="dark" position="top-center" />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
