// --- COMPONENTS: Modal Inteligente de Lead / WhatsApp (roleta) ---
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "motion/react";
import { Loader2, MessageCircle, CheckCircle2 } from "lucide-react";
import type { Vehicle } from "../types";
import { BottomSheet } from "./BottomSheet";
import { useLeadDistribution } from "../hooks";

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

  // Inicia a roleta ao abrir.
  useEffect(() => {
    if (open) distribute();
    else reset();
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

  return (
    <BottomSheet open={open} onClose={onClose} title="Conectando você a um consultor">
      <div className="flex flex-col items-center py-4 text-center">
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
              Distribuindo lead do {vehicle?.title} (Tier {vehicle?.tier})
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
              <img
                src={assignedSeller.avatarUrl}
                alt={assignedSeller.name}
                className="mx-auto h-20 w-20 rounded-full border-2 border-cyan-400/60 object-cover"
              />
              <p className="mt-3 text-white" style={{ fontWeight: 700 }}>
                {assignedSeller.name}
              </p>
              <p className="text-sm text-slate-400">
                Consultor especialista · desde {assignedSeller.memberSince}
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
