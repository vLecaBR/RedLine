// --- COMPONENTS: Modal Inteligente de Lead / WhatsApp (roleta) ---
// Fase 2: coleta nome/mensagem, persiste via POST /api/leads e revela o vendedor
// REAL retornado pela API. A animação da roleta roda sobre a resposta (sem sorteio local).
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "motion/react";
import { Loader2, MessageCircle, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import type { Vehicle } from "../types";
import { BottomSheet } from "./BottomSheet";
import { useLeadDistribution } from "../hooks";
import { ApiError } from "../lib/api";

/** Iniciais para o avatar (a API de lead não retorna foto do vendedor — só o nome). */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function LeadRouletteSheet({
  open,
  onClose,
  vehicle,
}: {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
}) {
  const { loading, assignedSeller, distribute, reset } = useLeadDistribution();
  const [customerName, setCustomerName] = useState("");
  const [message, setMessage] = useState("");

  // Limpa o formulário e o estado da roleta ao fechar.
  useEffect(() => {
    if (!open) {
      reset();
      setCustomerName("");
      setMessage("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Confete ao revelar o consultor.
  useEffect(() => {
    if (assignedSeller) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.7 },
        colors: ["#FF5A00", "#00E5FF", "#ffffff"],
      });
    }
  }, [assignedSeller]);

  const canSubmit =
    !!vehicle && customerName.trim().length > 0 && message.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!vehicle) return;
    try {
      await distribute(vehicle.id, customerName.trim(), message.trim());
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.status === 409
            ? "Nenhum consultor disponível nesta loja no momento."
            : e.status === 404
            ? "Este veículo não está mais disponível."
            : e.status === 400
            ? "Preencha seu nome e uma mensagem válida."
            : e.message
          : "Não foi possível enviar seu contato. Tente novamente.";
      toast.error(msg);
    }
  };

  const showForm = !loading && !assignedSeller;

  return (
    <BottomSheet open={open} onClose={onClose} title="Conectando você a um consultor">
      <div className="flex flex-col items-center py-4 text-center">
        {showForm && (
          <div className="w-full text-left">
            <p className="text-sm text-slate-400">
              Deixe seu contato para o {vehicle?.title}. Vamos direcionar você ao melhor
              consultor da loja.
            </p>

            <label className="mt-5 block text-xs text-slate-400">Seu nome</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex.: Marcos Vinícius"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/60"
            />

            <label className="mt-4 block text-xs text-slate-400">Mensagem</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Ex.: Aceita troca por hatch? Tem laudo do dyno?"
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/60"
            />

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ fontWeight: 700 }}
            >
              <Send className="h-5 w-5" /> Chamar consultor
            </button>
          </div>
        )}

        {loading && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 className="h-14 w-14 text-cyan-400" />
            </motion.div>
            <p className="mt-5 text-white">Buscando o melhor consultor...</p>
            <p className="mt-1 text-sm text-slate-400">
              Distribuindo lead do {vehicle?.title}
            </p>
            <div className="mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-cyan-400"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
              />
            </div>
          </>
        )}

        {assignedSeller && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="w-full"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs text-green-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Consultor encontrado
            </span>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-400/60 bg-cyan-400/10 text-cyan-200" style={{ fontWeight: 700, fontSize: 22 }}>
                {initials(assignedSeller.assignedSellerName)}
              </div>
              <p className="mt-3 text-white" style={{ fontWeight: 700 }}>
                {assignedSeller.assignedSellerName}
              </p>
              <p className="text-sm text-slate-400">
                Enviado para {assignedSeller.assignedSellerName}
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              animate={{ boxShadow: ["0 0 0 0 rgba(37,211,102,0.5)", "0 0 0 12px rgba(37,211,102,0)"] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              onClick={onClose}
              className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white"
              style={{ fontWeight: 700 }}
            >
              <MessageCircle className="h-5 w-5" /> Ir para o WhatsApp
            </motion.button>
          </motion.div>
        )}
      </div>
    </BottomSheet>
  );
}
