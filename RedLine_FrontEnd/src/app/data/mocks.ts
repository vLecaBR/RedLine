// --- MOCKS ---
// Fonte de dados centralizada. Nenhum dado hardcoded deve viver dentro do JSX.
// Substituir por chamadas reais à API .NET futuramente.

import type { User, Vehicle, Lead, KpiCard } from "../types";

export const CURRENT_USER: User = {
  id: "u-001",
  name: "Rafael Torque",
  email: "rafael@garagem.dev",
  role: "StoreManager",
  avatarUrl:
    "https://images.unsplash.com/photo-1595558883521-062b300985e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  memberSince: 2021,
};

export const SELLERS: User[] = [
  {
    id: "s-01",
    name: "João Mendes",
    email: "joao@garagem.dev",
    role: "Seller",
    avatarUrl:
      "https://images.unsplash.com/photo-1595558848762-e5ab72171957?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    memberSince: 2021,
  },
  {
    id: "s-02",
    name: "Bianca Rocha",
    email: "bianca@garagem.dev",
    role: "Seller",
    avatarUrl:
      "https://images.unsplash.com/photo-1610374634235-b51ef357f905?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    memberSince: 2022,
  },
  {
    id: "s-03",
    name: "Diego Nakamura",
    email: "diego@garagem.dev",
    role: "Seller",
    avatarUrl:
      "https://images.unsplash.com/photo-1623346483743-b968a27ed34c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    memberSince: 2020,
  },
];

const ENGINE_BAY =
  "https://images.unsplash.com/photo-1654616111851-5394318e3279?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const ENGINE_BAY_2 =
  "https://images.unsplash.com/photo-1752774581629-464238ee6996?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

export const VEHICLES: Vehicle[] = [
  {
    id: "v-01",
    title: "McLaren P1 Track Edition",
    brand: "McLaren",
    model: "P1",
    year: 2021,
    price: 4890000,
    mileage: 8200,
    transmission: "DCT",
    stage: "Stage 2",
    tier: "A",
    images: [
      "https://images.unsplash.com/photo-1555532686-d0fccaccadcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      ENGINE_BAY,
    ],
    sellerId: "s-01",
    location: "São Paulo, SP",
    createdAt: "2026-06-28",
    views: 3120,
    customSpecs: {
      engine: ["Remap ECU dedicada", "Downpipe Akrapovic titânio", "Intercooler frontal"],
      suspension: ["KW Clubsport coilover", "Barras estabilizadoras Whiteline"],
      interior: ["Bancos Recaro carbono", "Volante Alcantara custom"],
      hasDyno: true,
      claimedHp: 980,
    },
  },
  {
    id: "v-02",
    title: "Ferrari 488 Rosso Corsa",
    brand: "Ferrari",
    model: "488",
    year: 2020,
    price: 3250000,
    mileage: 14500,
    transmission: "DCT",
    stage: "Original",
    tier: "A",
    images: [
      "https://images.unsplash.com/photo-1596639410348-8470f7fa9f84?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    ],
    sellerId: "s-02",
    location: "Rio de Janeiro, RJ",
    createdAt: "2026-07-01",
    views: 2410,
    customSpecs: {
      engine: ["Motor de fábrica lacrado"],
      suspension: ["Suspensão original com lift kit"],
      interior: ["Couro Nero completo"],
      hasDyno: false,
    },
  },
  {
    id: "v-03",
    title: "Nissan GT-R Street Build",
    brand: "Nissan",
    model: "GT-R R35",
    year: 2018,
    price: 890000,
    mileage: 42000,
    transmission: "DCT",
    stage: "Stage 3",
    tier: "B",
    images: [
      "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      ENGINE_BAY_2,
    ],
    sellerId: "s-03",
    location: "Curitiba, PR",
    createdAt: "2026-07-04",
    views: 5890,
    customSpecs: {
      engine: ["Turbos híbridos Garrett", "Bicos 1300cc", "Coletor de admissão custom", "Flex fuel E85"],
      suspension: ["KW V3", "Bushings poliuretano"],
      interior: ["Roll cage bolt-in", "Painel digital AEM"],
      hasDyno: true,
      claimedHp: 1150,
    },
  },
  {
    id: "v-04",
    title: "Lamborghini Aventador SV",
    brand: "Lamborghini",
    model: "Aventador",
    year: 2019,
    price: 5600000,
    mileage: 9800,
    transmission: "Sequencial",
    stage: "Stage 1",
    tier: "A",
    images: [
      "https://images.unsplash.com/photo-1595558883521-062b300985e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    ],
    sellerId: "s-01",
    location: "São Paulo, SP",
    createdAt: "2026-06-20",
    views: 4020,
    customSpecs: {
      engine: ["Escapamento Capristo válvulas", "Filtros de ar esportivos"],
      suspension: ["Lift system hidráulico"],
      interior: ["Alcantara teto", "Carbon fiber trim"],
      hasDyno: false,
      claimedHp: 770,
    },
  },
  {
    id: "v-05",
    title: "Honda Civic Type R Turbo",
    brand: "Honda",
    model: "Civic Type R",
    year: 2022,
    price: 385000,
    mileage: 21000,
    transmission: "Manual",
    stage: "Stage 2",
    tier: "C",
    images: [
      "https://images.unsplash.com/photo-1674133461006-5db277b238e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      ENGINE_BAY_2,
    ],
    sellerId: "s-02",
    location: "Belo Horizonte, MG",
    createdAt: "2026-07-06",
    views: 1980,
    customSpecs: {
      engine: ["Downpipe Invidia", "Remap Hondata", "Intake Eventuri carbono"],
      suspension: ["Molas Eibach Pro-Kit", "Camber kit dianteiro"],
      interior: ["Volante Momo", "Pedaleira alumínio"],
      hasDyno: true,
      claimedHp: 380,
    },
  },
  {
    id: "v-06",
    title: "BMW M4 Competition Night",
    brand: "BMW",
    model: "M4",
    year: 2023,
    price: 720000,
    mileage: 12300,
    transmission: "DCT",
    stage: "Stage 1",
    tier: "B",
    images: [
      "https://images.unsplash.com/photo-1610374634235-b51ef357f905?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    ],
    sellerId: "s-03",
    location: "Porto Alegre, RS",
    createdAt: "2026-07-08",
    views: 2650,
    customSpecs: {
      engine: ["Stage 1 bootmod3", "Charge pipes upgrade"],
      suspension: ["KW DDC eletrônico"],
      interior: ["Bancos M Carbon", "Volante M Performance"],
      hasDyno: true,
      claimedHp: 610,
    },
  },
];

export const LEADS: Lead[] = [
  {
    id: "l-01",
    vehicleId: "v-05",
    vehicleTitle: "Civic Type R Turbo",
    tier: "C",
    customerName: "Marcos Vinícius",
    message: "Aceita troca por hatch? Tem laudo do dyno?",
    assignedSellerId: "s-01",
    assignedSellerName: "João Mendes",
    status: "Em atendimento",
    createdAt: "2026-07-10 09:12",
  },
  {
    id: "l-02",
    vehicleId: "v-03",
    vehicleTitle: "Nissan GT-R Street Build",
    tier: "B",
    customerName: "Amanda Prado",
    message: "Qual a procedência do motor? Documentação em dia?",
    assignedSellerId: "s-02",
    assignedSellerName: "Bianca Rocha",
    status: "Novo",
    createdAt: "2026-07-10 08:40",
  },
  {
    id: "l-03",
    vehicleId: "v-01",
    vehicleTitle: "McLaren P1 Track Edition",
    tier: "A",
    customerName: "Eduardo Salles",
    message: "Interesse real. Posso agendar test drive?",
    assignedSellerId: "s-03",
    assignedSellerName: "Diego Nakamura",
    status: "Convertido",
    createdAt: "2026-07-09 17:22",
  },
  {
    id: "l-04",
    vehicleId: "v-06",
    vehicleTitle: "BMW M4 Competition Night",
    tier: "B",
    customerName: "Letícia Fontes",
    message: "Financiamento em até 48x?",
    assignedSellerId: "s-01",
    assignedSellerName: "João Mendes",
    status: "Novo",
    createdAt: "2026-07-09 14:05",
  },
];

export const KPIS: KpiCard[] = [
  { label: "Leads Recebidos", value: "128", delta: 12.4, icon: "inbox" },
  { label: "Anúncios Ativos", value: "42", delta: 3.1, icon: "car" },
  { label: "Visualizações", value: "24.3k", delta: 18.7, icon: "eye" },
  { label: "Taxa de Conversão", value: "6.8%", delta: -1.2, icon: "trending-up" },
];
