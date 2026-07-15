// --- SUPABASE STORAGE (Fase 5 / §3.5 / RF-05) ---
// Upload do binário direto do front ao bucket `vehicle-images`; o backend só recebe a URL
// pública (nunca manipula o arquivo — RNF-11). Reusa o client já autenticado de lib/supabase.

import { supabase } from "./supabase";

const BUCKET = "vehicle-images";

// Marcas diacríticas (Unicode property escape — só ASCII no fonte, evita caracteres
// combinantes literais que quebram alguns parsers/transformers).
const COMBINING_MARKS = /\p{Diacritic}/gu;

/** Normaliza o nome do arquivo para um path seguro (sem espaços/acentos/caracteres estranhos). */
function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base =
    (dot > 0 ? name.slice(0, dot) : name)
      .normalize("NFD")
      .replace(COMBINING_MARKS, "") // remove acentos
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
      .slice(0, 40) || "img";
  const ext =
    (dot > 0 ? name.slice(dot + 1) : "jpg")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase() || "jpg";
  return `${base}.${ext}`;
}

/**
 * Envia uma imagem ao bucket `vehicle-images` na pasta da loja e retorna a URL pública
 * (`${storeId}/${uuid}/${safeName}`). Lança `Error` com mensagem amigável em caso de falha
 * (o chamador trata com toast — §6.1).
 */
export async function uploadVehicleImage(file: File, storeId: string): Promise<string> {
  const path = `${storeId}/${crypto.randomUUID()}/${safeName(file.name)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    throw new Error(`Falha ao enviar "${file.name}": ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error(`Não foi possível obter a URL pública de "${file.name}".`);
  }

  return data.publicUrl;
}
