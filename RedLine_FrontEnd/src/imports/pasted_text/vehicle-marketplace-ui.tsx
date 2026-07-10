Contexto do Projeto:
Plataforma SaaS de venda de veículos online (B2B e C2C) focada tanto em carros originais quanto no nicho de carros modificados/customizados (gearheads). Você atuará como um Desenvolvedor Frontend Sênior especializado em Next.js, React, Tailwind CSS e Framer Motion.

O objetivo é criar a interface de usuário (UI) completa, com foco obsessivo na conversão, design "Dark/Tech" e experiência Mobile-First. O código gerado deve ser estruturado com arquitetura pronta para produção, facilitando a futura integração com uma API robusta em .NET C#.

🛠️ 1. Stack Tecnológica e Arquitetura Esperada (Backend-Ready)

Gere o código seguindo estritamente as melhores práticas de arquitetura frontend:

Framework: React + Next.js (App Router pattern).

Estilização: Tailwind CSS (obrigatório para responsividade e theming).

Animações: Framer Motion (uso intenso para transições fluidas e micro-interações).

Gerenciamento de Estado: Crie um estado global simulado (pode usar React Context ou Zustand) para gerenciar o "Usuário Logado" e "Carrinho/Favoritos".

Isolamento de Dados (Camada de Serviços): REGRA DE OURO. - NÃO misture dados hardcoded no meio do JSX.

Crie uma estrutura simulada de API usando Custom Hooks (ex: useCars(), useLeadDistribution()).

Todos os retornos devem ser baseados em objetos de Mock centralizados.

Tipagem Estrita (TypeScript): Defina e utilize Interfaces/Types claros logo no início do código:

User (Role: Buyer, Seller, StoreManager)

Vehicle (com campos relacionais básicos e um objeto aninhado customSpecs para as modificações)

Lead (Mensagens de clientes).

📱 2. Diretrizes de Design, UX e Animações

Mobile First Extremo:

Touch targets de no mínimo 44x44px.

Navegação principal no mobile deve ser uma Bottom Navigation Bar (como em apps nativos).

Filtros complexos não abrem em modal no meio da tela, mas sim em Bottom Sheets (gavetas que sobem da base).

Galerias de fotos devem suportar swipe horizontal (scroll snap).

Tema e Estética (Cyber-Automotive):

Background Principal: Slate 900 (#0F172A) ou um Dark Mode puro (#121212).

Superfícies (Cards): Slate 800 (#1E293B) com bordas translúcidas de vidro (Glassmorphism: bg-opacity-50 backdrop-blur-md border border-white/10).

Cores de Destaque (Ação): Laranja Racing (#FF5A00) para CTAs de venda/contato e Cyan Neon (#00E5FF) para detalhes técnicos/badges.

Tipografia: Fonte sem serifa moderna (Inter ou Roboto). Títulos pesados e espaçados.

Animações Impressionantes (Framer Motion):

Layout Transitions: Ao clicar num card de veículo na Home, a imagem deve fazer um Shared Layout Transition (usando layoutId do Framer) expandindo para virar o cabeçalho da página de detalhes.

Stagger Children: Listas de carros devem carregar em cascata (um card aparecendo logo após o outro com fade-in up).

Micro-interações: Botões de ação principais devem ter um leve efeito de pulso contínuo para atrair o clique.

🎨 3. Especificação das Telas (Gere o Fluxo Completo)

Tela 1: Home Page ("A Vitrine Inteligente")

Header Dinâmico: Fica transparente e ganha fundo blur ao fazer scroll. Contém Logo, Busca Global e Avatar do usuário. No mobile, usar Hamburger Menu.

Hero Section: Imagem heroica de um carro de pista escurecida. Título com máquina de escrever ou reveal suave. CTA Primário: "Anunciar Meu Projeto".

Vitrine (Cards Misturados): - Filtros Pill horizontais (com scroll nativo lateral no mobile).

Vehicle Card: Proporção 16:9. Overlay gradiente na parte inferior da foto para garantir leitura de texto. Badges no canto ("Original", "Stage 2").

Renderizar no mínimo 6 cards baseados no Mock usando CSS Grid responsivo.

Tela 2: Single Page do Veículo (Foco na Conversão)

Galeria Imersiva: No topo, preenchendo a tela.

Barra de Ação Fixa (Sticky Bottom): No mobile, o preço e o botão "Chamar Vendedor no WhatsApp" nunca somem da tela; eles ficam fixos no rodapé (z-index alto).

Ficha Técnica Híbrida: - Uma grade mostrando Ano, Km, Câmbio.

Uma seção especial "Especificações Customizadas" construída com Accordions animados do Framer Motion (Motor, Suspensão, Interior).

Card de Confiança: Perfil de quem está vendendo (Nome, "Na plataforma desde 2021", Botão ver mais carros do vendedor).

Tela 3: Modal Inteligente de Lead / WhatsApp

Ao clicar em "Chamar no WhatsApp", não enviar direto. Abrir um Bottom Sheet rápido simulando o cálculo da roleta do sistema:

Animação de carregamento estilizada: "Buscando o melhor consultor..."

Revela o card do Vendedor Sorteado (com foto e nome) e um botão final "Ir para WhatsApp" (que dispara confetes virtuais ou um ping de sucesso).

Tela 4: Dashboard do Lojista (Multi-tenant B2B)

Sidebar: Navegação (Estoque, Leads, Equipe, Configurações).

Painel Principal: - Cards KPI (Leads Recebidos, Anúncios Ativos, Visualizações).

Tabela de Leads com Distribuição: Uma lista mostrando os leads recentes, informando qual vendedor atendeu e o Tier do carro (Ex: "João atendeu Civic Turbo - Tier C").

Botão "Adicionar Veículo" no topo direito.

⚙️ Instruções de Saída:

Unificação (Se necessário): Se for impossível gerar arquivos separados, gere um único documento grande, separando claramente com comentários visíveis (ex: // --- TYPES ---, // --- MOCKS ---, // --- HOOKS ---, // --- COMPONENTS ---, // --- PAGES ---).

Código Funcional: O código resultante deve ser 100% copiável para um arquivo page.tsx ou plataforma como CodeSandbox/StackBlitz, utilizando importações do pacote lucide-react para os ícones.

Não use placeholders como "adicionar lógica aqui". Escreva a simulação do estado com useState e useEffect para que a UI seja interativa (clicar em abas, abrir accordions, curtir o carro).