// --- HOOKS (Camada de Serviços simulada) ---
// Simulam chamadas de API. Retornam sempre dados dos mocks centralizados.

import { useState, useEffect } from "react";
import type { Vehicle, Lead, User } from "./types";
import { VEHICLES, LEADS, SELLERS, KPIS } from "./data/mocks";

/** Simula latência de rede. */
function delay<T>(data: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export function useCars(filter?: string) {
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    delay(VEHICLES).then((data) => {
      if (!active) return;
      const filtered =
        !filter || filter === "Todos"
          ? data
          : data.filter((c) =>
              filter === "Modificados"
                ? c.stage !== "Original"
                : filter === "Originais"
                ? c.stage === "Original"
                : c.brand === filter
            );
      setCars(filtered);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [filter]);

  return { cars, loading };
}

export function useCar(id: string) {
  return VEHICLES.find((c) => c.id === id) ?? null;
}

export function useSeller(id: string): User | null {
  return SELLERS.find((s) => s.id === id) ?? null;
}

export function useSellerVehicleCount(sellerId: string): number {
  return VEHICLES.filter((v) => v.sellerId === sellerId).length;
}

export function useLeads(): Lead[] {
  return LEADS;
}

export function useKpis() {
  return KPIS;
}

/**
 * Simula a "roleta" de distribuição de leads: sorteia um consultor.
 * Retorna o vendedor sorteado após uma simulação de processamento.
 */
export function useLeadDistribution() {
  const [loading, setLoading] = useState(false);
  const [assignedSeller, setAssignedSeller] = useState<User | null>(null);

  const distribute = () => {
    setLoading(true);
    setAssignedSeller(null);
    return new Promise<User>((resolve) => {
      setTimeout(() => {
        const picked = SELLERS[Math.floor(Math.random() * SELLERS.length)];
        setAssignedSeller(picked);
        setLoading(false);
        resolve(picked);
      }, 2200);
    });
  };

  const reset = () => {
    setAssignedSeller(null);
    setLoading(false);
  };

  return { loading, assignedSeller, distribute, reset };
}
