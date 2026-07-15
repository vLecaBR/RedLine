// --- COMPONENTS: LoginSheet (login e-mail+senha via Supabase, RF-07) ---
import { useState } from "react";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useApp } from "../store";

export function LoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      toast.success("Bem-vindo de volta!");
      setEmail("");
      setPassword("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login. Verifique as credenciais.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Entrar na conta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@garagem.dev"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Senha</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-white disabled:opacity-60"
          style={{ fontWeight: 700 }}
        >
          <LogIn className="h-5 w-5" /> {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </BottomSheet>
  );
}
