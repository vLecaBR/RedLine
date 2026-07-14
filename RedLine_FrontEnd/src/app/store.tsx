// --- GLOBAL STATE (simulado) ---
// Context para Usuário Logado + Favoritos. Substituível por Zustand no futuro.

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { User } from "./types";
import { CURRENT_USER } from "./data/mocks";

interface AppState {
  user: User;
  favorites: string[];
  toggleFavorite: (vehicleId: string) => void;
  isFavorite: (vehicleId: string) => boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user] = useState<User>(CURRENT_USER);
  const [favorites, setFavorites] = useState<string[]>([]);

  const toggleFavorite = useCallback((vehicleId: string) => {
    setFavorites((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
    );
  }, []);

  const isFavorite = useCallback(
    (vehicleId: string) => favorites.includes(vehicleId),
    [favorites]
  );

  return (
    <AppContext.Provider value={{ user, favorites, toggleFavorite, isFavorite }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp deve ser usado dentro de AppProvider");
  return ctx;
}
