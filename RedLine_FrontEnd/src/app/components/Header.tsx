// --- COMPONENTS: Header dinâmico ---
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Search, Menu, Gauge, User as UserIcon } from "lucide-react";
import { useApp } from "../store";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { user } = useApp();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={false}
      animate={{
        backgroundColor: scrolled ? "rgba(15,23,42,0.7)" : "rgba(15,23,42,0)",
        borderColor: scrolled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0)",
      }}
      className="fixed inset-x-0 top-0 z-40 border-b backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <button
          onClick={onMenu}
          aria-label="Menu"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 md:hidden"
        >
          <Menu className="h-5 w-5 text-white" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500">
            <Gauge className="h-5 w-5 text-white" />
          </div>
          <span className="hidden text-white sm:block" style={{ fontWeight: 800, letterSpacing: "0.02em" }}>
            REDLINE<span className="text-orange-500">.</span>
          </span>
        </div>

        <div className="relative ml-2 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Buscar por marca, modelo, stage..."
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
          />
        </div>

        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-11 w-11 rounded-full border-2 border-orange-500/60 object-cover"
          />
        ) : (
          <div
            aria-label={user ? user.name : "Deslogado"}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/15 bg-white/5 text-slate-300"
          >
            <UserIcon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.header>
  );
}
