// --- GLOBAL STATE ---
// Context para Usuário Logado (sessão REAL via Supabase + GET /api/me) + Favoritos.
// Fase 3: o mock CURRENT_USER foi removido; `user` vem de `useMe` e pode ser null (deslogado).

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import type { Me, Vehicle } from "./types";
import { useMe, useAuthActions, useFavorites } from "./hooks";

interface AppState {
  user: Me | null;
  isLoggedIn: boolean;
  loadingUser: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  favorites: string[]; // ids (servidor quando logado; local caso contrário)
  favoriteVehicles: Vehicle[]; // veículos favoritados (só quando logado)
  favoritesLoading: boolean;
  toggleFavorite: (vehicleId: string) => void;
  isFavorite: (vehicleId: string) => boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { me, loading, isLoggedIn, mutate } = useMe();
  const { signIn: doSignIn, signOut: doSignOut } = useAuthActions();
  const {
    favoriteVehicles,
    favoriteIds,
    isFavorite,
    toggleFavorite: doToggleFavorite,
    loading: favoritesLoading,
  } = useFavorites();

  const signIn = useCallback(
    async (email: string, password: string) => {
      await doSignIn(email, password);
      await mutate(); // revalida /api/me imediatamente após logar
    },
    [doSignIn, mutate]
  );

  const signOut = useCallback(async () => {
    await doSignOut();
    await mutate(undefined, { revalidate: false }); // limpa o usuário no estado
  }, [doSignOut, mutate]);

  // Mantém a assinatura síncrona esperada pelos componentes; trata erro com toast.
  const toggleFavorite = useCallback(
    (vehicleId: string) => {
      doToggleFavorite(vehicleId).catch(() =>
        toast.error("Não foi possível atualizar o favorito.")
      );
    },
    [doToggleFavorite]
  );

  return (
    <AppContext.Provider
      value={{
        user: me,
        isLoggedIn,
        loadingUser: loading,
        signIn,
        signOut,
        favorites: favoriteIds,
        favoriteVehicles,
        favoritesLoading,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp deve ser usado dentro de AppProvider");
  return ctx;
}
