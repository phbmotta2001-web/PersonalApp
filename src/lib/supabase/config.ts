// Endereço e chave PÚBLICA do Supabase, lidos do .env.local (ver .env.example).

export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) {
    throw new Error(
      "Faltam as configurações do Supabase. Copie .env.example para .env.local, preencha e reinicie o npm run dev.",
    );
  }
  return { url, chave };
}
