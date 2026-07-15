// --- VehicleForm (Fase 5 + ajustes) ---
// Formulário de criação/edição de anúncio. Campos controlados, upload múltiplo de imagens
// (preview + progresso) ao Supabase Storage, arrays de specs e validação client-side.
// Ajustes: "stage" agora é "Tem remap?" (sim/não) + nível 1–4; localização puxa
// estados/cidades da API do IBGE (selects em cascata); tier removido.

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { X, Upload, Loader2, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import type { Vehicle, VehicleFormInput, Transmission, BuildStage } from "../types";
import { useApp } from "../store";
import { useCreateVehicle, useUpdateVehicle } from "../hooks";
import { uploadVehicleImage } from "../lib/storage";
import { ApiError } from "../lib/api";

const TRANSMISSIONS: Transmission[] = ["Manual", "Automático", "Sequencial", "DCT"];
const STAGE_LEVELS = [1, 2, 3, 4] as const;

const CURRENT_YEAR = new Date().getFullYear();

// --- IBGE ---
interface IbgeUf {
  id: number;
  sigla: string;
  nome: string;
}
interface IbgeCity {
  id: number;
  nome: string;
}

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

// stage "Stage 3" -> nível 3; qualquer não-remap -> null.
function stageToLevel(stage: BuildStage): number | null {
  const m = /^Stage (\d)$/.exec(stage);
  return m ? Number(m[1]) : null;
}

// "Curitiba, PR" -> { city: "Curitiba", uf: "PR" }
function parseLocation(loc?: string): { city: string; uf: string } {
  if (!loc) return { city: "", uf: "" };
  const idx = loc.lastIndexOf(",");
  if (idx < 0) return { city: loc.trim(), uf: "" };
  return { city: loc.slice(0, idx).trim(), uf: loc.slice(idx + 1).trim().toUpperCase() };
}

export function VehicleForm({ mode, vehicle, onClose, onSaved }: Props) {
  const { user } = useApp();
  const { createVehicle, loading: creating } = useCreateVehicle();
  const { updateVehicle, loading: updating } = useUpdateVehicle();
  const fileRef = useRef<HTMLInputElement>(null);

  const initialLoc = useMemo(() => parseLocation(vehicle?.location), [vehicle]);

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

  // Remap (substitui o antigo campo Stage).
  const initialLevel = stageToLevel(initial.stage);
  const [hasRemap, setHasRemap] = useState(initialLevel !== null);
  const [stageLevel, setStageLevel] = useState<number>(initialLevel ?? 1);

  // Localização (IBGE).
  const [ufs, setUfs] = useState<IbgeUf[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [uf, setUf] = useState(initialLoc.uf);
  const [city, setCity] = useState(initialLoc.city);
  const [loadingCities, setLoadingCities] = useState(false);

  const busy = creating || updating || uploading;

  // Deriva a stage a partir do remap.
  const stage: BuildStage = hasRemap ? (`Stage ${stageLevel}` as BuildStage) : "Original";

  function set<K extends keyof VehicleFormInput>(key: K, value: VehicleFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Carrega os estados uma vez.
  useEffect(() => {
    let alive = true;
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((r) => r.json())
      .then((data: IbgeUf[]) => {
        if (alive) setUfs(data);
      })
      .catch(() => {
        if (alive) toast.error("Não foi possível carregar os estados (IBGE).");
      });
    return () => {
      alive = false;
    };
  }, []);

  // Carrega as cidades quando a UF muda.
  useEffect(() => {
    if (!uf) {
      setCities([]);
      return;
    }
    let alive = true;
    setLoadingCities(true);
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    )
      .then((r) => r.json())
      .then((data: IbgeCity[]) => {
        if (alive) setCities(data);
      })
      .catch(() => {
        if (alive) toast.error("Não foi possível carregar as cidades (IBGE).");
      })
      .finally(() => {
        if (alive) setLoadingCities(false);
      });
    return () => {
      alive = false;
    };
  }, [uf]);

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

  // Validação client-side. Retorna a 1ª mensagem de erro, ou null.
  function validate(): string | null {
    if (!form.title.trim()) return "Informe o título do anúncio.";
    if (!form.brand.trim()) return "Informe a marca.";
    if (!form.model.trim()) return "Informe o modelo.";
    if (!uf) return "Selecione o estado.";
    if (!city) return "Selecione a cidade.";
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
      stage,
      location: `${city}, ${uf}`,
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

  // Garante que a cidade pré-selecionada (modo edição) apareça mesmo antes da lista carregar.
  const cityOptions =
    city && !cities.some((c) => c.nome === city)
      ? [{ id: -1, nome: city } as IbgeCity, ...cities]
      : cities;

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

        {/* Transmissão / Remap */}
        <div className="mt-3 grid grid-cols-2 gap-3">
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
            <label className={labelCls}>Preparação</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={hasRemap}
                  onChange={(e) => setHasRemap(e.target.checked)}
                />
                Tem remap?
              </label>
              {hasRemap && (
                <select
                  className={inputCls}
                  value={stageLevel}
                  onChange={(e) => setStageLevel(Number(e.target.value))}
                >
                  {STAGE_LEVELS.map((n) => (
                    <option key={n} value={n} className="bg-slate-900">
                      Stage {n}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Localização (IBGE) */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Estado *</label>
            <select
              className={inputCls}
              value={uf}
              onChange={(e) => {
                setUf(e.target.value);
                setCity(""); // troca de UF zera a cidade
              }}
            >
              <option value="" className="bg-slate-900">
                {ufs.length ? "Selecione…" : "Carregando…"}
              </option>
              {ufs.map((u) => (
                <option key={u.id} value={u.sigla} className="bg-slate-900">
                  {u.nome} ({u.sigla})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Cidade *</label>
            <select
              className={inputCls}
              value={city}
              disabled={!uf || loadingCities}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="" className="bg-slate-900">
                {!uf ? "Escolha o estado" : loadingCities ? "Carregando…" : "Selecione…"}
              </option>
              {cityOptions.map((c) => (
                <option key={c.id} value={c.nome} className="bg-slate-900">
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
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
