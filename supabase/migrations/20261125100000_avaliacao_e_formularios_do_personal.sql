-- 67 · Avaliação física com evolução e ParQ/anamnese do personal (decisão 105).
--
-- • Avaliação física: o personal registra, com data, peso, % de gordura e medidas (cm) do aluno.
--   O personal e o aluno veem a evolução (gráfico e diferença para a avaliação anterior). O aluno
--   vê no app, sem notificação no celular.
-- • ParQ e anamnese do personal, como no estúdio: todo personal já vem com os dois (editáveis).
--   O aluno que entra no app pelo convite recebe os dois para preencher; o personal também pode
--   enviar para os alunos que já tem. Respondido, o personal é avisado ("sim" no ParQ em destaque).
-- • As respostas ficam na ficha do aluno, só para o personal dele (e o próprio aluno).
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

-- ─── Avaliação física ─────────────────────────────────────────────────────
create table if not exists public.avaliacoes_fisicas (
  id           uuid primary key default gen_random_uuid(),
  vinculo_id   uuid not null references public.vinculos (id) on delete cascade,
  personal_id  uuid not null references public.personais (id) on delete cascade,
  data         date not null,
  peso_kg      numeric(5, 1) check (peso_kg is null or peso_kg between 10 and 400),
  gordura_pct  numeric(4, 1) check (gordura_pct is null or gordura_pct between 1 and 75),
  -- Circunferências em cm: {"peito": 98.5, "cintura": 80, ...}
  medidas      jsonb not null default '{}'::jsonb check (jsonb_typeof(medidas) = 'object'),
  observacao   text check (observacao is null or char_length(observacao) <= 500),
  criado_em    timestamptz not null default now()
);
create index if not exists avaliacoes_fisicas_por_vinculo on public.avaliacoes_fisicas (vinculo_id, data desc);
comment on table public.avaliacoes_fisicas is 'Avaliações físicas do aluno feitas pelo personal (peso, % de gordura e medidas).';
alter table public.avaliacoes_fisicas enable row level security;
create policy "personal e aluno veem as avaliações" on public.avaliacoes_fisicas
  for select to authenticated using (
    personal_id = (select auth.uid())
    or exists (select 1 from public.vinculos v where v.id = vinculo_id and v.aluno_id = (select auth.uid())));

create or replace function public.salvar_avaliacao_fisica(
  p_vinculo uuid, p_id uuid, p_data date, p_peso numeric, p_gordura numeric, p_medidas jsonb, p_observacao text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_medidas jsonb := '{}'::jsonb;
  k text;
  x jsonb;
begin
  if not exists (select 1 from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo') then
    raise exception 'Aluno não encontrado.';
  end if;
  if p_data is null or p_data > public.hoje_brasilia() then
    raise exception 'Confira a data da avaliação.';
  end if;
  -- Só as medidas conhecidas, com número entre 5 e 300 cm.
  for k, x in select * from jsonb_each(coalesce(p_medidas, '{}'::jsonb)) loop
    if k not in ('peito', 'cintura', 'abdomen', 'quadril', 'braco', 'coxa', 'panturrilha') then
      continue;
    end if;
    if jsonb_typeof(x) <> 'number' or x::text::numeric not between 5 and 300 then
      raise exception 'Confira as medidas (em cm).';
    end if;
    v_medidas := v_medidas || jsonb_build_object(k, round(x::text::numeric, 1));
  end loop;
  if p_peso is null and p_gordura is null and v_medidas = '{}'::jsonb then
    raise exception 'Preencha pelo menos o peso, o percentual de gordura ou uma medida.';
  end if;
  if v_id is null then
    insert into public.avaliacoes_fisicas (vinculo_id, personal_id, data, peso_kg, gordura_pct, medidas, observacao)
    values (p_vinculo, auth.uid(), p_data, p_peso, p_gordura, v_medidas, nullif(btrim(coalesce(p_observacao, '')), ''))
    returning id into v_id;
  else
    update public.avaliacoes_fisicas
       set data = p_data, peso_kg = p_peso, gordura_pct = p_gordura, medidas = v_medidas,
           observacao = nullif(btrim(coalesce(p_observacao, '')), '')
     where id = v_id and vinculo_id = p_vinculo and personal_id = auth.uid();
    if not found then
      raise exception 'Avaliação não encontrada.';
    end if;
  end if;
  return v_id;
end
$$;

create or replace function public.apagar_avaliacao_fisica(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.avaliacoes_fisicas where id = p_id and personal_id = auth.uid();
$$;

-- ─── Formulários do personal (ParQ e anamnese) ────────────────────────────
create table if not exists public.personal_formularios (
  id             uuid primary key default gen_random_uuid(),
  personal_id    uuid not null references public.personais (id) on delete cascade,
  tipo           text not null check (tipo in ('parq', 'anamnese')),
  nome           text not null check (char_length(btrim(nome)) between 2 and 60),
  perguntas      jsonb not null check (jsonb_typeof(perguntas) = 'array' and jsonb_array_length(perguntas) between 1 and 30),
  atualizado_em  timestamptz not null default now(),
  unique (personal_id, tipo)
);
comment on table public.personal_formularios is 'ParQ e anamnese do personal (padrão do P-Bell, editáveis).';
alter table public.personal_formularios enable row level security;
create policy "personal vê os formulários dele" on public.personal_formularios
  for select to authenticated using (personal_id = (select auth.uid()));

create table if not exists public.personal_respostas (
  id             uuid primary key default gen_random_uuid(),
  personal_id    uuid not null references public.personais (id) on delete cascade,
  formulario_id  uuid references public.personal_formularios (id) on delete set null,
  vinculo_id     uuid not null references public.vinculos (id) on delete cascade,
  tipo           text not null check (tipo in ('parq', 'anamnese')),
  titulo         text not null,
  -- Cópia das perguntas do envio.
  perguntas      jsonb not null,
  enviado_em     timestamptz not null default now(),
  respondido_em  timestamptz,
  respostas      jsonb
);
create index if not exists personal_respostas_por_vinculo on public.personal_respostas (vinculo_id, enviado_em desc);
create unique index if not exists personal_respostas_uma_pendente
  on public.personal_respostas (vinculo_id, formulario_id) where respondido_em is null;
comment on table public.personal_respostas is 'Cada ParQ/anamnese do personal enviado a um aluno e as respostas dele.';
alter table public.personal_respostas enable row level security;
create policy "personal e o próprio aluno veem as respostas" on public.personal_respostas
  for select to authenticated using (
    personal_id = (select auth.uid())
    or exists (select 1 from public.vinculos v where v.id = vinculo_id and v.aluno_id = (select auth.uid())));

create or replace function public.criar_formularios_padrao_personal(p_personal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.personal_formularios (personal_id, tipo, nome, perguntas)
  values (p_personal, 'parq', 'ParQ', $j$[
    {"id": "parq1", "tipo": "sim_nao", "obrigatoria": true, "texto": "Algum médico já disse que você tem problema no coração ou pressão alta e só deve fazer exercício com acompanhamento médico?"},
    {"id": "parq2", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você sente dor no peito quando faz atividade física?"},
    {"id": "parq3", "tipo": "sim_nao", "obrigatoria": true, "texto": "No último mês, você sentiu dor no peito sem estar fazendo atividade física?"},
    {"id": "parq4", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você já perdeu o equilíbrio por causa de tontura ou já desmaiou?"},
    {"id": "parq5", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você tem algum problema nos ossos ou nas articulações que pode piorar com atividade física?"},
    {"id": "parq6", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você toma algum remédio para pressão arterial ou para o coração?"},
    {"id": "parq7", "tipo": "sim_nao", "obrigatoria": true, "texto": "Existe alguma outra razão pela qual você não deveria fazer atividade física?"},
    {"id": "declaracao", "tipo": "sim_nao", "obrigatoria": true, "texto": "Declaro que respondi com sinceridade e que, se respondi sim a alguma pergunta, vou consultar um médico antes de treinar."}
  ]$j$::jsonb)
  on conflict (personal_id, tipo) do nothing;

  insert into public.personal_formularios (personal_id, tipo, nome, perguntas)
  values (p_personal, 'anamnese', 'Anamnese', $j$[
    {"id": "an1", "tipo": "texto", "obrigatoria": true, "texto": "Qual o seu objetivo com os treinos?"},
    {"id": "an2", "tipo": "escolha", "obrigatoria": true, "texto": "Você pratica atividade física?", "opcoes": ["Não", "Já pratiquei, mas parei", "Sim, pratico"]},
    {"id": "an3", "tipo": "texto", "obrigatoria": false, "texto": "Tem ou teve alguma lesão, dor ou cirurgia? Qual?"},
    {"id": "an4", "tipo": "texto", "obrigatoria": false, "texto": "Tem alguma doença (ex.: diabetes, hipertensão, asma)? Qual?"},
    {"id": "an5", "tipo": "texto", "obrigatoria": false, "texto": "Usa algum remédio? Qual?"},
    {"id": "an6", "tipo": "sim_nao", "obrigatoria": false, "texto": "Está grávida ou teve bebê nos últimos 6 meses?"},
    {"id": "an7", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você fuma?"},
    {"id": "an8", "tipo": "nota", "obrigatoria": true, "texto": "De 0 a 10, como está o seu sono?"},
    {"id": "an9", "tipo": "texto", "obrigatoria": false, "texto": "Tem mais alguma coisa que o personal deva saber?"}
  ]$j$::jsonb)
  on conflict (personal_id, tipo) do nothing;
end
$$;

create or replace function public.personais_formularios_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.criar_formularios_padrao_personal(new.id);
  return new;
end
$$;
drop trigger if exists personais_formularios_padrao on public.personais;
create trigger personais_formularios_padrao
  after insert on public.personais
  for each row execute function public.personais_formularios_padrao();

-- Os personais que já existem também ganham os dois.
select public.criar_formularios_padrao_personal(id) from public.personais;

-- Aluno entrou no app pelo convite (vínculo ativo com conta): ParQ e anamnese para preencher.
create or replace function public.vinculos_formularios_iniciais()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.situacao <> 'ativo' or new.aluno_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.situacao = 'ativo' and old.aluno_id is not distinct from new.aluno_id then
    return new;
  end if;
  insert into public.personal_respostas (personal_id, formulario_id, vinculo_id, tipo, titulo, perguntas)
  select f.personal_id, f.id, new.id, f.tipo, f.nome, f.perguntas
    from public.personal_formularios f
   where f.personal_id = new.personal_id
     and not exists (select 1 from public.personal_respostas r where r.vinculo_id = new.id and r.formulario_id = f.id);
  return new;
end
$$;
drop trigger if exists vinculos_formularios_iniciais on public.vinculos;
create trigger vinculos_formularios_iniciais
  after insert or update of situacao, aluno_id on public.vinculos
  for each row execute function public.vinculos_formularios_iniciais();

create or replace function public.salvar_formulario_personal(p_id uuid, p_nome text, p_perguntas jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_nome, ''))) not between 2 and 60 then
    raise exception 'Dê um nome ao formulário (até 60 caracteres).';
  end if;
  if jsonb_typeof(p_perguntas) <> 'array' or jsonb_array_length(p_perguntas) not between 1 and 30
     or exists (select 1 from jsonb_array_elements(p_perguntas) q
                 where coalesce(q ->> 'id', '') = '' or q ->> 'tipo' not in ('nota', 'numero', 'sim_nao', 'escolha', 'texto')
                    or char_length(btrim(coalesce(q ->> 'texto', ''))) not between 2 and 140) then
    raise exception 'Confira as perguntas (de 1 a 30, cada uma com texto).';
  end if;
  update public.personal_formularios
     set nome = btrim(p_nome), perguntas = p_perguntas, atualizado_em = now()
   where id = p_id and personal_id = auth.uid();
  if not found then
    raise exception 'Formulário não encontrado.';
  end if;
  -- Quem ainda não respondeu recebe a versão nova.
  update public.personal_respostas set titulo = btrim(p_nome), perguntas = p_perguntas
   where formulario_id = p_id and respondido_em is null;
  return p_id;
end
$$;

-- Envia o formulário para os alunos com o app (todos ou os escolhidos). Quem já tem este
-- formulário pendente não recebe outro. Devolve quem recebeu (para o WhatsApp).
create or replace function public.enviar_formulario_personal(p_formulario uuid, p_vinculos uuid[] default null)
returns table (resposta_id uuid, vinculo_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.personal_formularios;
  r record;
begin
  select * into f from public.personal_formularios where id = p_formulario and personal_id = auth.uid();
  if not found then
    raise exception 'Formulário não encontrado.';
  end if;
  if p_vinculos is not null and cardinality(p_vinculos) = 0 then
    raise exception 'Escolha pelo menos um aluno.';
  end if;
  for r in
    insert into public.personal_respostas (personal_id, formulario_id, vinculo_id, tipo, titulo, perguntas)
    select f.personal_id, f.id, v.id, f.tipo, f.nome, f.perguntas
      from public.vinculos v
     where v.personal_id = f.personal_id and v.situacao = 'ativo' and v.aluno_id is not null
       and (p_vinculos is null or v.id = any (p_vinculos))
       and not exists (select 1 from public.personal_respostas x
                        where x.vinculo_id = v.id and x.formulario_id = f.id and x.respondido_em is null)
    returning id, personal_respostas.vinculo_id as vid
  loop
    resposta_id := r.id;
    vinculo_id := r.vid;
    perform public.notificar(v.aluno_id, 'formulario_personal', 'Formulário de ' || public.primeiro_nome_do_personal(f.personal_id),
              'Responda: ' || f.nome || '. Leva poucos minutos.',
              '/aluno/formulario/' || r.id, p_chave => 'formulario:' || r.id)
       from public.vinculos v where v.id = r.vid;
    return next;
  end loop;
end
$$;

create or replace function public.responder_formulario_personal(p_resposta uuid, p_respostas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      public.personal_respostas;
  v_sim  boolean;
  v_nome text;
begin
  select q.* into r from public.personal_respostas q
    join public.vinculos v on v.id = q.vinculo_id and v.aluno_id = auth.uid()
   where q.id = p_resposta
   for update of q;
  if not found then
    raise exception 'Formulário não encontrado.';
  end if;
  if r.respondido_em is not null then
    raise exception 'Você já respondeu este formulário.';
  end if;
  if jsonb_typeof(p_respostas) <> 'object' then
    raise exception 'Responda as perguntas.';
  end if;
  if exists (select 1 from jsonb_array_elements(r.perguntas) q
              where (q ->> 'obrigatoria')::boolean
                and (p_respostas -> (q ->> 'id') is null or jsonb_typeof(p_respostas -> (q ->> 'id')) = 'null'
                     or btrim(p_respostas ->> (q ->> 'id')) = '')) then
    raise exception 'Responda todas as perguntas obrigatórias.';
  end if;
  if r.tipo = 'parq' and p_respostas ? 'declaracao' and p_respostas -> 'declaracao' = 'false'::jsonb then
    raise exception 'Para enviar, confirme a declaração do final.';
  end if;
  update public.personal_respostas set respostas = p_respostas, respondido_em = now() where id = r.id;

  v_nome := coalesce(public.primeiro_nome_do_aluno(r.vinculo_id), 'O aluno');
  v_sim := r.tipo = 'parq' and exists (
    select 1 from jsonb_array_elements(r.perguntas) q
     where q ->> 'tipo' = 'sim_nao' and q ->> 'id' <> 'declaracao' and p_respostas -> (q ->> 'id') = 'true'::jsonb);
  perform public.notificar(r.personal_id, 'formulario_respondido',
    case when v_sim then 'ParQ com "sim"' when r.tipo = 'parq' then 'ParQ preenchido' else 'Anamnese preenchida' end,
    v_nome || ' preencheu ' || case when r.tipo = 'parq' then 'o ParQ' else 'a anamnese' end
      || case when v_sim then ' e respondeu "sim" a alguma pergunta. Confira antes de treinar.' else '. Veja na ficha do aluno.' end,
    '/agenda/alunos/' || r.vinculo_id, p_chave => 'formulario-respondido:' || r.id, p_vinculo => r.vinculo_id);
end
$$;

-- Formulários pendentes do aluno logado: os dos estúdios e os dos personais (estudio_id vazio,
-- "estudio" com o nome do personal).
create or replace function public.meus_formularios_pendentes()
returns table (id uuid, estudio_id uuid, estudio text, tipo text, titulo text, enviado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.estudio_id, x.estudio, x.tipo, x.titulo, x.enviado_em from (
    select r.id, r.estudio_id, e.nome as estudio, r.tipo, r.titulo, r.enviado_em
      from public.estudio_respostas r
      join public.estudio_alunos al on al.id = r.estudio_aluno_id and al.aluno_id = auth.uid()
                                    and al.situacao in ('ativo', 'experimental')
      join public.estudios e on e.id = r.estudio_id
     where r.respondido_em is null
    union all
    select r.id, null::uuid, p.nome_completo, r.tipo, r.titulo, r.enviado_em
      from public.personal_respostas r
      join public.vinculos v on v.id = r.vinculo_id and v.aluno_id = auth.uid() and v.situacao = 'ativo'
      join public.personais p on p.id = r.personal_id
     where r.respondido_em is null
  ) x
  order by case x.tipo when 'parq' then 0 when 'anamnese' then 1 else 2 end, x.enviado_em;
$$;

revoke all on function public.salvar_avaliacao_fisica(uuid, uuid, date, numeric, numeric, jsonb, text) from public, anon;
revoke all on function public.apagar_avaliacao_fisica(uuid)                                              from public, anon;
revoke all on function public.criar_formularios_padrao_personal(uuid)                                    from public, anon, authenticated;
revoke all on function public.personais_formularios_padrao()                                             from public, anon, authenticated;
revoke all on function public.vinculos_formularios_iniciais()                                            from public, anon, authenticated;
revoke all on function public.salvar_formulario_personal(uuid, text, jsonb)                              from public, anon;
revoke all on function public.enviar_formulario_personal(uuid, uuid[])                                   from public, anon;
revoke all on function public.responder_formulario_personal(uuid, jsonb)                                 from public, anon;
revoke all on function public.meus_formularios_pendentes()                                               from public, anon;
grant execute on function public.salvar_avaliacao_fisica(uuid, uuid, date, numeric, numeric, jsonb, text) to authenticated;
grant execute on function public.apagar_avaliacao_fisica(uuid)                                            to authenticated;
grant execute on function public.salvar_formulario_personal(uuid, text, jsonb)                            to authenticated;
grant execute on function public.enviar_formulario_personal(uuid, uuid[])                                 to authenticated;
grant execute on function public.responder_formulario_personal(uuid, jsonb)                               to authenticated;
grant execute on function public.meus_formularios_pendentes()                                             to authenticated;

commit;
