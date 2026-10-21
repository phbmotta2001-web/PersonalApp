-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1, etapa 5b: alunos sem conta (cadastrados pelo personal).
--
-- Decisões de 21/10/2026:
-- • Vale para qualquer aluno que não queira usar o app (menor de idade ou adulto).
-- • O personal informa nome, data de nascimento, WhatsApp (opcional) e observações.
--   Menor de 18 anos: também nome e WhatsApp do responsável e a confirmação de que o
--   responsável autorizou o cadastro (LGPD, art. 14). Cobranças e avisos pelo
--   WhatsApp vão para o responsável.
-- • Matrícula, aulas, cobranças, calendário e aniversário funcionam como para os outros.
-- • "Convidar para ter conta": o personal gera um link; quando o aluno aceitar com a
--   conta dele, matrícula, aulas, cobranças e histórico passam para essa conta.
--
-- O aluno sem conta é um vínculo ATIVO sem aluno_id (sem_conta = true).
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261021180000_notificacoes_push.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.vinculos
  add column sem_conta                    boolean not null default false,
  add column data_nascimento              date,
  add column responsavel_nome             text check (responsavel_nome is null or char_length(btrim(responsavel_nome)) between 2 and 80),
  add column responsavel_whatsapp         text check (responsavel_whatsapp is null or responsavel_whatsapp ~ '^\d{10,13}$'),
  add column observacoes                  text check (observacoes is null or char_length(observacoes) <= 1000),
  add column consentimento_responsavel_em timestamptz;

comment on column public.vinculos.sem_conta is
  'Aluno cadastrado pelo personal, sem conta no Pienel (aluno_id fica vazio até ele aceitar um convite).';
comment on column public.vinculos.consentimento_responsavel_em is
  'Quando o personal confirmou que o responsável autorizou o cadastro do aluno menor (LGPD, art. 14).';

-- Menor de 18 anos (em Brasília).
create or replace function public.eh_menor(p_nascimento date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_nascimento is not null and p_nascimento > (public.hoje_brasilia() - interval '18 years')::date;
$$;

-- Confere e grava os dados do aluno sem conta (criar: p_vinculo nulo).
create or replace function public.salvar_aluno_sem_conta(p_vinculo uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_personal   uuid := auth.uid();
  v_nome       text := btrim(coalesce(p_dados ->> 'nome', ''));
  v_whats      text := nullif(regexp_replace(coalesce(p_dados ->> 'whatsapp', ''), '\D', '', 'g'), '');
  v_nasc       date := nullif(p_dados ->> 'data_nascimento', '')::date;
  v_resp_nome  text := nullif(btrim(coalesce(p_dados ->> 'responsavel_nome', '')), '');
  v_resp_whats text := nullif(regexp_replace(coalesce(p_dados ->> 'responsavel_whatsapp', ''), '\D', '', 'g'), '');
  v_obs        text := nullif(btrim(coalesce(p_dados ->> 'observacoes', '')), '');
  v_autorizou  boolean := coalesce((p_dados ->> 'responsavel_autorizou')::boolean, false);
  v_menor      boolean;
  v_id         uuid;
begin
  if not exists (select 1 from public.personais where id = v_personal and situacao <> 'suspenso') then
    raise exception 'Só personais com conta ativa podem cadastrar alunos.';
  end if;
  if char_length(v_nome) not between 2 and 80 then
    raise exception 'Informe o nome do aluno.';
  end if;
  if v_nasc is null or v_nasc > public.hoje_brasilia() or v_nasc < date '1900-01-01' then
    raise exception 'Confira a data de nascimento.';
  end if;
  if v_whats is not null and v_whats !~ '^\d{10,13}$' then
    raise exception 'Confira o WhatsApp do aluno (com DDD).';
  end if;
  if v_obs is not null and char_length(v_obs) > 1000 then
    raise exception 'As observações passam de 1000 letras.';
  end if;

  v_menor := public.eh_menor(v_nasc);
  if v_menor then
    if v_resp_nome is null or char_length(v_resp_nome) not between 2 and 80 then
      raise exception 'Aluno menor de idade: informe o nome do responsável.';
    end if;
    if v_resp_whats is null or v_resp_whats !~ '^\d{10,13}$' then
      raise exception 'Aluno menor de idade: informe o WhatsApp do responsável (com DDD).';
    end if;
    if not v_autorizou then
      raise exception 'Aluno menor de idade: confirme que o responsável autorizou o cadastro.';
    end if;
  else
    -- Adulto: não guarda dados de responsável.
    v_resp_nome := null;
    v_resp_whats := null;
  end if;

  if p_vinculo is null then
    insert into public.vinculos
      (personal_id, nome_convite, whatsapp_convite, situacao, aceito_em, expira_em, sem_conta,
       data_nascimento, responsavel_nome, responsavel_whatsapp, observacoes, consentimento_responsavel_em)
    values
      (v_personal, v_nome, v_whats, 'ativo', now(), now(), true,
       v_nasc, v_resp_nome, v_resp_whats, v_obs, case when v_menor then now() end)
    returning id into v_id;
  else
    update public.vinculos
       set nome_convite = v_nome, whatsapp_convite = v_whats, data_nascimento = v_nasc,
           responsavel_nome = v_resp_nome, responsavel_whatsapp = v_resp_whats, observacoes = v_obs,
           consentimento_responsavel_em = case when v_menor then coalesce(consentimento_responsavel_em, now()) end
     where id = p_vinculo and personal_id = v_personal and situacao = 'ativo'
       and sem_conta and aluno_id is null
    returning id into v_id;
    if v_id is null then
      raise exception 'Aluno não encontrado entre os seus alunos sem app.';
    end if;
  end if;
  return v_id;
end
$$;

-- Dados do aluno sem conta, para a ficha (só o personal dele).
create or replace function public.ficha_sem_conta(p_vinculo uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'vinculo_id', v.id, 'aceito_em', v.aceito_em, 'nome', v.nome_convite,
           'whatsapp', v.whatsapp_convite, 'data_nascimento', v.data_nascimento,
           'idade', extract(year from age(public.hoje_brasilia(), v.data_nascimento))::int,
           'menor', public.eh_menor(v.data_nascimento),
           'responsavel_nome', v.responsavel_nome, 'responsavel_whatsapp', v.responsavel_whatsapp,
           'observacoes', v.observacoes, 'consentimento_responsavel_em', v.consentimento_responsavel_em,
           'convite_codigo', case when v.expira_em > now() then v.codigo end,
           'convite_expira_em', case when v.expira_em > now() then v.expira_em end)
    from public.vinculos v
   where v.id = p_vinculo and v.personal_id = auth.uid() and v.situacao = 'ativo'
     and v.sem_conta and v.aluno_id is null;
$$;

-- "Convidar para ter conta": link novo, válido por 14 dias.
create or replace function public.convidar_aluno_sem_conta(p_vinculo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
begin
  update public.vinculos
     set codigo = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
         expira_em = now() + interval '14 days'
   where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo' and sem_conta and aluno_id is null
  returning * into v;
  if not found then
    raise exception 'Aluno não encontrado entre os seus alunos sem app.';
  end if;
  return jsonb_build_object('codigo', v.codigo, 'expira_em', v.expira_em);
end
$$;

-- ─── Lista de alunos: inclui os sem conta ──────────────────────────────────
drop function public.meus_alunos();
create function public.meus_alunos()
returns table (
  vinculo_id uuid, situacao text, nome text, whatsapp text, codigo text,
  criado_em timestamptz, expira_em timestamptz, aceito_em timestamptz, encerrado_em timestamptz,
  encerrado_por text, sem_conta boolean, menor boolean, responsavel_nome text
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id,
         case when v.situacao = 'convidado' and v.expira_em <= now() then 'expirado' else v.situacao end,
         coalesce(a.nome_completo, v.nome_convite),
         -- Menor sem conta: o WhatsApp é o do responsável.
         case when v.sem_conta and v.responsavel_whatsapp is not null and public.eh_menor(v.data_nascimento)
              then v.responsavel_whatsapp
              else coalesce(a.whatsapp, v.whatsapp_convite) end,
         case when v.situacao = 'convidado'
                or (v.sem_conta and v.aluno_id is null and v.situacao = 'ativo' and v.expira_em > now())
              then v.codigo end,
         v.criado_em, v.expira_em, v.aceito_em, v.encerrado_em, v.encerrado_por,
         v.sem_conta and v.aluno_id is null,
         v.sem_conta and public.eh_menor(v.data_nascimento),
         case when v.sem_conta then v.responsavel_nome end
    from public.vinculos v
    left join public.alunos a on a.id = v.aluno_id and v.situacao = 'ativo'
   where v.personal_id = auth.uid()
   order by v.criado_em desc
$$;

-- ─── Convite: também serve para o aluno sem conta assumir o cadastro ───────
create or replace function public.ver_convite(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
  p public.personais;
begin
  select * into v from public.vinculos where codigo = p_codigo;
  if not found or char_length(coalesce(p_codigo, '')) <> 64 then
    return jsonb_build_object('situacao', 'inexistente');
  end if;

  select * into p from public.personais where id = v.personal_id;

  return jsonb_build_object(
    'situacao', case
                  when v.situacao = 'convidado' and v.expira_em <= now() then 'expirado'
                  when v.situacao = 'convidado' then 'valido'
                  when v.situacao = 'ativo' and v.sem_conta and v.aluno_id is null and v.expira_em > now() then 'valido'
                  when v.situacao = 'ativo' and v.sem_conta and v.aluno_id is null then 'expirado'
                  when v.situacao = 'ativo' then 'usado'
                  else v.situacao
                end,
    'nome_convite', v.nome_convite,
    'personal_nome', p.nome_completo,
    'personal_cref', p.cref || '/' || p.cref_uf,
    'ja_aceito_por_mim', v.aluno_id is not null and v.aluno_id = auth.uid()
  );
end
$$;

create or replace function public.aceitar_convite(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno     uuid := auth.uid();
  v           public.vinculos;
  v_existente uuid;
  v_assume    boolean;
begin
  if v_aluno is null or not exists (select 1 from public.alunos where id = v_aluno) then
    raise exception 'Entre com uma conta de aluno para aceitar o convite.';
  end if;

  if not public.perfil_completo(v_aluno) then
    raise exception 'Complete seu perfil (objetivo, nível e restrições) antes de aceitar o convite.';
  end if;

  select * into v from public.vinculos where codigo = p_codigo for update;
  if not found then
    raise exception 'Convite não encontrado.';
  end if;
  if v.situacao = 'ativo' and v.aluno_id = v_aluno then
    return v.id;   -- já aceito por este aluno
  end if;
  -- Aluno sem conta: o convite passa o cadastro (matrícula, aulas, cobranças) para esta conta.
  v_assume := v.situacao = 'ativo' and v.sem_conta and v.aluno_id is null and v.expira_em > now();
  if not v_assume and (v.situacao <> 'convidado' or v.expira_em <= now()) then
    raise exception 'Este convite não está mais válido. Peça um link novo ao seu personal.';
  end if;

  -- Já é aluno deste personal: o convite novo não é necessário.
  select id into v_existente from public.vinculos
   where personal_id = v.personal_id and aluno_id = v_aluno and situacao = 'ativo';
  if v_existente is not null then
    if v_assume then
      raise exception 'Sua conta já está ligada a este personal. Peça para ele conferir o cadastro.';
    end if;
    update public.vinculos set situacao = 'cancelado', encerrado_em = now(), encerrado_por = 'aluno'
     where id = v.id;
    return v_existente;
  end if;

  if v_assume then
    update public.vinculos
       set aluno_id = v_aluno, sem_conta = false, expira_em = now(), aceito_em = now(),
           -- Agora os dados vêm do perfil do próprio aluno.
           data_nascimento = null, responsavel_nome = null, responsavel_whatsapp = null
     where id = v.id;
    update public.matriculas set aluno_id = v_aluno where vinculo_id = v.id;
    update public.aulas      set aluno_id = v_aluno where vinculo_id = v.id;
    update public.cobrancas  set aluno_id = v_aluno where vinculo_id = v.id;
    update public.checkins   set aluno_id = v_aluno where vinculo_id = v.id;
    return v.id;
  end if;

  update public.vinculos
     set aluno_id = v_aluno, situacao = 'ativo', aceito_em = now()
   where id = v.id;
  return v.id;
end
$$;

-- Passar as aulas para a conta nova não é uma ação do aluno (não esbarra na suspensão).
create or replace function public.aulas_bloqueio_do_aluno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.aluno_id is distinct from old.aluno_id then
    return new;
  end if;
  if auth.uid() is not null and auth.uid() = new.aluno_id
     and public.suspensa_desde(new.vinculo_id) is not null then
    raise exception 'Sua matrícula está suspensa até a mensalidade ser paga. Pague e avise seu personal.';
  end if;
  return new;
end
$$;

-- ─── Aniversários: inclui os alunos sem conta ──────────────────────────────
create or replace function public.aniversariantes_do_mes(p_data date default null)
returns table (vinculo_id uuid, nome text, dia integer, faz_anos integer)
language sql
stable
security definer
set search_path = ''
as $$
  with ref as (select coalesce(p_data, public.hoje_brasilia()) as d),
  alunos as (
    select v.id, coalesce(a.nome_completo, v.nome_convite) as nome,
           coalesce(a.data_nascimento, v.data_nascimento) as nasc
      from public.vinculos v
      left join public.alunos a on a.id = v.aluno_id
     where v.personal_id = auth.uid() and v.situacao = 'ativo'
  )
  select al.id,
         al.nome,
         case
           when extract(month from al.nasc) = 2 and extract(day from al.nasc) = 29
                and extract(day from (date_trunc('month', ref.d) + interval '1 month' - interval '1 day')) = 28
           then 28
           else extract(day from al.nasc)::int
         end,
         (extract(year from ref.d) - extract(year from al.nasc))::int
    from ref, alunos al
   where al.nasc is not null
     and extract(month from al.nasc) = extract(month from ref.d)
   order by 3, 2
$$;

revoke all on function public.eh_menor(date)                           from public, anon, authenticated;
revoke all on function public.salvar_aluno_sem_conta(uuid, jsonb)      from public, anon;
revoke all on function public.ficha_sem_conta(uuid)                    from public, anon;
revoke all on function public.convidar_aluno_sem_conta(uuid)           from public, anon;
revoke all on function public.meus_alunos()                            from public, anon;
grant execute on function public.salvar_aluno_sem_conta(uuid, jsonb)   to authenticated;
grant execute on function public.ficha_sem_conta(uuid)                 to authenticated;
grant execute on function public.convidar_aluno_sem_conta(uuid)        to authenticated;
grant execute on function public.meus_alunos()                         to authenticated;

commit;
