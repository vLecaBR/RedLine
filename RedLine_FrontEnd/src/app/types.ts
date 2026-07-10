// --- TYPES ---
// Domínio central da plataforma de venda de veículos.
// Tipagem estrita pronta para futura integração com API .NET C#.

export type UserRole = "Buyer" | "Seller" | "StoreManager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  memberSince: number; // ano
}

export type BuildStage = "Original" | "Stage 1" | "Stage 2" | "Stage 3" | "Full Build";
export type VehicleTier = "A" | "B" | "C" | "D";
export type Transmission = "Manual" | "Automático" | "Sequencial" | "DCT";

// Especificações customizadas (o coração do nicho "gearhead").
export interface CustomSpecs {
  engine: string[]; // ex: ["Turbo Garrett GTX3582", "Intercooler frontal"]
  suspension: string[];
  interior: string[];
  hasDyno: boolean; // possui dinamômetro comprovado
  claimedHp?: number;
}

export interface Vehicle {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number; // km
  transmission: Transmission;
  stage: BuildStage;
  tier: VehicleTier;
  images: string[];
  sellerId: string;
  location: string;
  createdAt: string;
  customSpecs: CustomSpecs;
  views: number;
}

export type LeadStatus = "Novo" | "Em atendimento" | "Convertido" | "Perdido";

export interface Lead {
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  tier: VehicleTier;
  customerName: string;
  message: string;
  assignedSellerId: string;
  assignedSellerName: string;
  status: LeadStatus;
  createdAt: string;
}

export interface KpiCard {
  label: string;
  value: string;
  delta: number; // variação percentual
  icon: string;
}
