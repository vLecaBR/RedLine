// --- COMPONENTS: Bottom Navigation Bar (mobile-first) ---
import { motion } from "motion/react";
import { Home, Heart, LayoutDashboard, User } from "lucide-react";

export type Tab = "home" | "favorites" | "dashboard" | "profile";

const ITEMS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Vitrine", icon: Home },
  { id: "favorites", label: "Favoritos", icon: Heart },
  { id: "dashboard", label: "Lojista", icon: LayoutDashboard },
  { id: "profile", label: "Perfil", icon: User },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-1 py-2"
            >
              {on && (
                <motion.span
                  layoutId="bottomnav-pill"
                  className="absolute inset-x-2 top-1 h-1 rounded-full bg-orange-500"
                />
              )}
              <Icon className={`h-5 w-5 ${on ? "text-orange-500" : "text-slate-400"}`} />
              <span className={`text-[10px] ${on ? "text-white" : "text-slate-500"}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
