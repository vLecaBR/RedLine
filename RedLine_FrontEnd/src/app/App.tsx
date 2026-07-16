import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, User as UserIcon, Store, LogOut, LogIn, Settings, Lock, Car } from "lucide-react";
import { Toaster, toast } from "sonner";
import { AppProvider, useApp } from "./store";
import { Header } from "./components/Header";
import { BottomNav, type Tab } from "./components/BottomNav";
import { VehicleCard } from "./components/VehicleCard";
import { LeadRouletteSheet } from "./components/LeadRouletteSheet";
import { LoginSheet } from "./components/LoginSheet";
import { HomePage } from "./pages/HomePage";
import { VehicleDetailPage } from "./pages/VehicleDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { useCar, useVehiclesByIds, useMyVehicles } from "./hooks";

// --- PAGES: Favoritos (RF-09: resolvido via API, sem leitura de mocks) ---
function FavoritesPage({ onOpenVehicle }: { onOpenVehicle: (id: string) => void }) {
  const { favorites, favoriteVehicles, favoritesLoading, isLoggedIn } = useApp();
  // Logado: veículos vêm do servidor (Fase 6). Deslogado: resolve os ids locais via API.
  const localFallback = useVehiclesByIds(isLoggedIn ? [] : favorites);
  const cars = isLoggedIn ? favoriteVehicles : localFallback.cars;
  const loading = isLoggedIn ? favoritesLoading : localFallback.loading;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-24">
      <h1 className="text-white" style={{ fontWeight: 800 }}>
        Meus Favoritos
      </h1>
      <p className="mt-1 text-sm text-slate-400">{cars.length} veículo(s) salvos</p>

      {loading && favorites.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: favorites.length }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : cars.length === 0 ? (
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
function ProfilePage({ onRequestLogin }: { onRequestLogin: () => void }) {
  const { user, favorites, loadingUser, signOut } = useApp();
  const { total: myVehiclesTotal } = useMyVehicles();

  if (loadingUser) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-24">
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  // Deslogado: CTA de login (a vitrine/favoritos seguem públicos).
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-24">
        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-slate-300">
            <UserIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-white" style={{ fontWeight: 700 }}>
            Você não está logado
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Entre para acessar seu perfil e o painel do lojista.
          </p>
          <button
            onClick={onRequestLogin}
            className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-white"
            style={{ fontWeight: 700 }}
          >
            <LogIn className="h-5 w-5" /> Entrar
          </button>
        </div>
      </div>
    );
  }

  const rows = [
    { icon: Store, label: "Loja", value: user.storeName ?? "—" },
    { icon: Car, label: "Meus Anúncios", value: `${myVehiclesTotal} anúncio(s)` },
    { icon: Heart, label: "Favoritos", value: `${favorites.length} salvos` },
    { icon: Settings, label: "Configurações", value: "" },
  ];

  async function handleSignOut() {
    await signOut();
    toast.success("Você saiu da conta.");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-24">
      <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-20 w-20 rounded-full border-2 border-orange-500/60 object-cover"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/15 bg-white/5 text-slate-300">
            <UserIcon className="h-9 w-9" />
          </span>
        )}
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
      <button
        onClick={handleSignOut}
        className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/5 text-red-300"
      >
        <LogOut className="h-5 w-5" /> Sair da conta
      </button>
    </div>
  );
}

// --- Guarda de rota do Dashboard (RF-10): exige login + papel de loja. ---
function DashboardGuard({
  onBack,
  onRequestLogin,
  autoCreate,
  onConsumeAutoCreate,
}: {
  onBack: () => void;
  onRequestLogin: () => void;
  autoCreate?: boolean;
  onConsumeAutoCreate?: () => void;
}) {
  const { user, isLoggedIn, loadingUser } = useApp();

  if (loadingUser) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-24">
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-24">
        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-slate-300">
            <Lock className="h-7 w-7" />
          </span>
          <p className="mt-4 text-white" style={{ fontWeight: 700 }}>
            Painel restrito
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Faça login para acessar o painel do lojista.
          </p>
          <button
            onClick={onRequestLogin}
            className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-white"
            style={{ fontWeight: 700 }}
          >
            <LogIn className="h-5 w-5" /> Entrar
          </button>
        </div>
      </div>
    );
  }

  // Logado, mas comprador sem acesso ao painel de loja.
  if (user && user.role === "Buyer") {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-24">
        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-slate-300">
            <Lock className="h-7 w-7" />
          </span>
          <p className="mt-4 text-white" style={{ fontWeight: 700 }}>
            Sem acesso ao painel
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Sua conta ({user.role}) não está vinculada a uma loja.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardPage
      onBack={onBack}
      autoCreate={autoCreate}
      onConsumeAutoCreate={onConsumeAutoCreate}
    />
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  const [openVehicleId, setOpenVehicleId] = useState<string | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [dashboardAutoCreate, setDashboardAutoCreate] = useState(false);
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
              onOpenVehicle={setOpenVehicleId}
            />
          </motion.div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {tab === "home" && (
              <HomePage
                onOpenVehicle={setOpenVehicleId}
                onAnunciar={() => {
                  setDashboardAutoCreate(true);
                  goTab("dashboard");
                }}
              />
            )}
            {tab === "favorites" && <FavoritesPage onOpenVehicle={setOpenVehicleId} />}
            {tab === "dashboard" && (
              <DashboardGuard
                onBack={() => goTab("home")}
                onRequestLogin={() => setLoginOpen(true)}
                autoCreate={dashboardAutoCreate}
                onConsumeAutoCreate={() => setDashboardAutoCreate(false)}
              />
            )}
            {tab === "profile" && <ProfilePage onRequestLogin={() => setLoginOpen(true)} />}
          </motion.div>
        )}
      </AnimatePresence>

      {!openVehicleId && <BottomNav active={tab} onChange={goTab} />}

      <LeadRouletteSheet open={leadOpen} onClose={() => setLeadOpen(false)} vehicle={vehicle ?? null} />
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />

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
