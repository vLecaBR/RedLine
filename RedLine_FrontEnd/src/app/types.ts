// --- TYPES ---
// Domínio central da plataforma de venda de veículos.
// Tipagem estrita pronta para futura integração com API .NET C#.

export type UserRole = "Buyer" | "Seller" | "StoreManager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null; // D3: pode vir null (Buyer recém-provisionado)
  memberSince: number; // ano
}

// Retorno de GET /api/me (Fase 3 / §4.1). É o próprio usuário logado — inclui email.
// storeId/storeName são nullable (um Buyer pode não ter loja).
export interface Me {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  memberSince: number;
  storeId: string | null;
  storeName: string | null;
}

export type BuildStage = "Original" | "Stage 1" | "Stage 2" | "Stage 3" | "Stage 4" | "Full Build";
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
  images: string[];
  sellerId: string;
  location: string;
  createdAt: string;
  customSpecs: CustomSpecs;
  views: number;
  isActive?: boolean; // Fase 5 (aditivo/§4.6): vitrine sempre true; aba Estoque usa o valor real.
}

// Entrada do formulário de anúncio (Fase 5 / §6.4). Campos controlados; `images` são URLs
// já hospedadas no Storage (o upload roda antes da submissão).
export interface VehicleFormInput {
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  transmission: Transmission;
  stage: BuildStage;
  images: string[];
  location: string;
  customSpecs: CustomSpecs;
}

// Corpo de POST/PUT /api/vehicles (§4.6). Espelha o VehicleFormInput — o servidor deriva
// sellerId/storeId/views/isActive.
export type CreateVehicleRequest = VehicleFormInput;
export type UpdateVehicleRequest = VehicleFormInput;

// Vendedor público (retorno de GET /api/sellers/{id}). Não expõe email.
// avatarUrl pode vir null; vehicleCount substitui o antigo useSellerVehicleCount.
export interface PublicSeller {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  memberSince: number;
  vehicleCount: number;
}

export type LeadStatus = "Novo" | "Em atendimento" | "Convertido" | "Perdido";

export interface Lead {
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  storeId?: string; // §2.4/L8 — presente no contrato do Dashboard (GET/PATCH /api/leads)
  customerName: string;
  message: string;
  assignedSellerId: string;
  assignedSellerName: string;
  status: LeadStatus;
  createdAt: string;
}

// Card de KPI (retorno de GET /api/dashboard/kpis). `value` já vem formatado do backend.
export interface Kpi {
  label: string;
  value: string;
  delta: number; // variação (percentual ou pontos percentuais, conforme o card)
  icon: string;
}

// Alias retrocompatível com o mock KpiCard.
export type KpiCard = Kpi;

// Envelope de GET /api/dashboard/kpis (§4.4).
export interface DashboardSummary {
  cards: Kpi[];
}
