// --- VehicleForm (Fase 5 / §6.5) ---
// Formulário de criação/edição de anúncio. Campos controlados, upload múltiplo de imagens
// (preview + progresso) ao Supabase Storage, arrays de specs e validação client-side espelhando
// a RNF-03. Submissão via useCreateVehicle/useUpdateVehicle; sucesso/erro via toast (sonner).

import { useMemo, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { X, Upload, Loader2, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import type {
  Vehicle,
  VehicleFormInput,
  Transmission,
  BuildStage,
  VehicleTier,
} from "../types";
import { useApp } from "../store";
import { useCreateVehicle, useUpdateVehicle } from "../hooks";
import { uploadVehicleImage } from "../lib/storage";
import { ApiError } from "../lib/api";

const TRANSMISSIONS: Transmission[] = ["Manual", "Automático", "Sequencial", "DCT"];
const STAGES: BuildStage[] = ["Original", "Stage 1", "Stage 2", "Stage 3", "Full Build"];
const TIERS: VehicleTier[] = ["A", "B", "C", "D"];

const CURRENT_YEAR = new Date().getFullYear();

interface Props {
  mode: "create" | "edit";
  vehicle?: Vehicle | null; // presente no modo edição
  onClose: () => void;
  onSaved?: (v: Vehicle) => void;
}

// Converte um array de strings em texto (1 por linha) e vice-versa.
const toLines = (arr: string[]) => arr.join("\n");
const fromLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export function VehicleForm({ mode, vehicle, onClose, onSaved }: Props) {
  const { user } = useApp();
  const { createVehicle, loading: creating } = useCreateVehicle();
  const { updateVehicle, loading: updating } = useUpdateVehicle();
  const fileRef = useRef<HTMLInputElement>(null);

  const initial = useMemo<VehicleFormInput>(
    () => ({
      title: vehicle?.title ?? "",
      brand: vehicle?.brand ?? "",
      model: vehicle?.model ?? "",
      year: vehicle?.year ?? CURRENT_YEAR,
      price: vehicle?.price ?? 0,
      mileage: vehicle?.mileage ?? 0,
      transmission: vehicle?.transmission ?? "Manual",
      stage: vehicle?.stage ?? "Original",
      tier: vehicle?.tier ?? "B",
      images: vehicle?.images ?? [],
      location: vehicle?.location ?? "",
      customSpecs: {
        engine: vehicle?.customSpecs?.engine ?? [],
        suspension: vehicle?.customSpecs?.suspension ?? [],
        interior: vehicle?.customSpecs?.interior ?? [],
        hasDyno: vehicle?.customSpecs?.hasDyno ?? false,
        claimedHp: vehicle?.customSpecs?.claimedHp,
      },
    }),
    [vehicle]
  );

  const [form, setForm] = useState<VehicleFormInput>(initial);
  const [engineText, setEngineText] = useState(toLines(initial.customSpecs.engine));
  const [suspText, setSuspText] = useState(toLines(initial.customSpecs.suspension));
  const [interiorText, setInteriorText] = useState(toLines(initial.customSpecs.interior));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = creating || updating || uploading;

  function set<K extends keyof VehicleFormInput>(key: K, value: VehicleFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!user?.storeId) {
      toast.error("Sua conta não está vinculada a uma loja.");
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadVehicleImage(file, user.storeId);
        urls.push(url);
      }
      set("images", [...form.images, ...urls]);
      toast.success(`${urls.length} imagem(ns) enviada(s).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no upload da imagem.";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeImage(url: string) {
    set(
      "images",
      form.images.filter((i) => i !== url)
    );
  }

  // Validação client-side (espelha RNF-03). Retorna a 1ª mensagem de erro, ou null.
  function validate(): string | null {
    if (!form.title.trim()) return "Informe o título do anúncio.";
    if (!form.brand.trim()) return "Informe a marca.";
    if (!form.model.trim()) return "Informe o modelo.";
    if (!form.location.trim()) return "Informe a localização.";
    if (!(form.price > 0)) return "O preço deve ser maior que zero.";
    if (form.mileage < 0) return "A quilometragem não pode ser negativa.";
    if (form.year < 1900 || form.year > CURRENT_YEAR + 1)
      return `O ano deve estar entre 1900 e ${CURRENT_YEAR + 1}.`;
    if (form.images.length === 0) return "Envie ao menos 1 imagem.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) {
      setError(v);
      toast.error(v);
      return;
    }

    const payload: VehicleFormInput = {
      ...form,
      title: form.title.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      location: form.location.trim(),
      customSpecs: {
        engine: fromLines(engineText),
        suspension: fromLines(suspText),
        interior: fromLines(interiorText),
        hasDyno: form.customSpecs.hasDyno,
        claimedHp: form.customSpecs.claimedHp || undefined,
      },
    };

    try {
      const saved =
        mode === "edit" && vehicle
          ? await updateVehicle(vehicle.id, payload)
          : await createVehicle(payload);
      toast.success(mode === "edit" ? "Anúncio atualizado." : "Anúncio publicado.");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Não foi possível salvar o anúncio.";
      setError(msg);
      toast.error(msg);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-orange-500/60";
  const labelCls = "mb-1 block text-xs font-medium text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <motion.form
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white" style={{ fontWeight: 800 }}>
            {mode === "edit" ? "Editar anúncio" : "Novo anúncio"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Imagens */}
        <div className="mt-4">
          <label className={labelCls}>Imagens *</label>
          <div className="flex flex-wrap gap-2">
            {form.images.map((url) => (
              <div key={url} className="group relative h-20 w-28 overflow-hidden rounded-lg border border-white/10">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-red-300 opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 bg-white/5 text-xs text-slate-400 hover:border-orange-500/50 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
              {uploading ? "Enviando…" : "Adicionar"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Título */}
        <div className="mt-4">
          <label className={labelCls}>Título *</label>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex.: Nissan GT-R Street Build"
          />
        </div>

        {/* Marca / Modelo */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Marca *</label>
            <input className={inputCls} value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Modelo *</label>
            <input className={inputCls} value={form.model} onChange={(e) => set("model", e.target.value)} />
          </div>
        </div>

        {/* Ano / Preço / KM */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Ano *</label>
            <input
              type="number"
              className={inputCls}
              value={form.year}
              onChange={(e) => set("year", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls}>Preço (R$) *</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputCls}
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls}>KM *</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.mileage}
              onChange={(e) => set("mileage", Number(e.target.value))}
            />
          </div>
        </div>

        {/* Transmissão / Stage / Tier */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Transmissão</label>
            <select
              className={inputCls}
              value={form.transmission}
              onChange={(e) => set("transmission", e.target.value as Transmission)}
            >
              {TRANSMISSIONS.map((t) => (
                <option key={t} value={t} className="bg-slate-900">
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Stage</label>
            <select
              className={inputCls}
              value={form.stage}
              onChange={(e) => set("stage", e.target.value as BuildStage)}
            >
              {STAGES.map((s) => (
                <option key={s} value={s} className="bg-slate-900">
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tier</label>
            <select
              className={inputCls}
              value={form.tier}
              onChange={(e) => set("tier", e.target.value as VehicleTier)}
            >
              {TIERS.map((t) => (
                <option key={t} value={t} className="bg-slate-900">
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Localização */}
        <div className="mt-3">
          <label className={labelCls}>Localização *</label>
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Ex.: Curitiba, PR"
          />
        </div>

        {/* Specs */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            Ficha técnica (1 item por linha)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Motor</label>
              <textarea
                rows={3}
                className={inputCls}
                value={engineText}
                onChange={(e) => setEngineText(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Suspensão</label>
              <textarea
                rows={3}
                className={inputCls}
                value={suspText}
                onChange={(e) => setSuspText(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Interior</label>
              <textarea
                rows={3}
                className={inputCls}
                value={interiorText}
                onChange={(e) => setInteriorText(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.customSpecs.hasDyno}
                onChange={(e) =>
                  set("customSpecs", { ...form.customSpecs, hasDyno: e.target.checked })
                }
              />
              Possui laudo de dyno
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">HP:</label>
              <input
                type="number"
                min={0}
                className={`${inputCls} w-28`}
                value={form.customSpecs.claimedHp ?? ""}
                onChange={(e) =>
                  set("customSpecs", {
                    ...form.customSpecs,
                    claimedHp: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm text-white disabled:opacity-60"
            style={{ fontWeight: 700 }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {mode === "edit" ? "Salvar alterações" : "Publicar anúncio"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
