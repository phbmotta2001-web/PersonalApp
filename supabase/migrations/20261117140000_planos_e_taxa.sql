-- 52 · Planos trimestral, semestral e anual + taxa de matrícula (decisão 90) e fechar o estúdio num dia (decisão 91).
-- • A tabela continua por vezes na semana, agora também por plano (1, 3, 6 ou 12 meses). O valor
--   guardado é sempre o valor POR MÊS do plano.
-- • Cada plano oferecido (3, 6 ou 12 meses) é pago "mês a mês" ou "de uma vez" (o total do
--   período, cobrado no começo de cada período).
-- • O aluno tem o plano dele (padrão: mensal) e o mês em que o plano começou.
-- • Taxa de matrícula (opcional, valor do estúdio): marcada no aluno, vira uma cobrança separada
--   com o mesmo vencimento da primeira mensalidade gerada.
-- • O professor no percentual continua sobre o valor por mês (mensalidade_do_aluno_estudio).

begin;

-- ─── Tabela de preços por plano ──────────────────────────────────────────
alter table public.estudio_precos add column if not exists meses integer not null default 1;
alter table public.estudio_precos drop constraint if exists estudio_precos_meses_check;
alter table public.estudio_precos add constraint estudio_precos_meses_check check (meses in (1, 3, 6, 12));
alter table public.estudio_precos drop constraint if exists estudio_precos_pkey;
alter table public.estudio_precos add primary key (estudio_id, vezes, meses);

create table if not exists public.estudio_planos (
  estudio_id uuid not null references public.estudios (id) on delete cascade,
  meses      integer not null check (meses in (3, 6, 12)),
  pagamento  text not null default 'mensal' check (pagamento in ('mensal', 'unico')),
  primary key (estudio_id, meses)
);
comment on table public.estudio_planos is
  'Planos de 3, 6 ou 12 meses que o estúdio oferece, pagos mês a mês ou de uma vez (o mensal sempre existe).';
alter table public.estudio_planos enable row level security;
create policy "equipe vê os planos do estúdio" on public.estudio_planos
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);

alter table public.estudios
  add column if not exists taxa_matricula_centavos integer
    check (taxa_matricula_centavos is null or taxa_matricula_centavos between 100 and 10000000);

alter table public.estudio_alunos
  add column if not exists plano_meses integer not null default 1,
  add column if not exists plano_inicio date,
  add column if not exists taxa_pendente boolean not null default false;
alter table public.estudio_alunos drop constraint if exists estudio_alunos_plano_meses_check;
alter table public.estudio_alunos add constraint estudio_alunos_plano_meses_check check (plano_meses in (1, 3, 6, 12));

-- Cobranças: a taxa de matrícula é uma cobrança à parte, do mesmo mês.
alter table public.estudio_cobrancas add column if not exists tipo text not null default 'mensalidade';
alter table public.estudio_cobrancas drop constraint if exists estudio_cobrancas_tipo_check;
alter table public.estudio_cobrancas add constraint estudio_cobrancas_tipo_check check (tipo in ('mensalidade', 'taxa'));
alter table public.estudio_cobrancas drop constraint if exists estudio_cobrancas_estudio_aluno_id_referencia_key;
alter table public.estudio_cobrancas drop constraint if exists estudio_cobrancas_aluno_referencia_tipo_key;
alter table public.estudio_cobrancas
  add constraint estudio_cobrancas_aluno_referencia_tipo_key unique (estudio_aluno_id, referencia, tipo);

-- Valor POR MÊS do aluno: exceção, ou a tabela do plano dele, ou a tabela mensal.
create or replace function public.mensalidade_do_aluno_estudio(p_aluno uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with a as (
    select x.*, least(7, (select count(*) from public.turma_alunos ta
                            join public.turmas t on t.id = ta.turma_id and t.ativa
                           where ta.estudio_aluno_id = x.id))::integer as vezes
      from public.estudio_alunos x where x.id = p_aluno
  )
  select coalesce(a.valor_mensal_centavos,
                  (select p.valor_centavos from public.estudio_precos p
                    where p.estudio_id = a.estudio_id and p.vezes = a.vezes and p.meses = a.plano_meses),
                  (select p.valor_centavos from public.estudio_precos p
                    where p.estudio_id = a.estudio_id and p.vezes = a.vezes and p.meses = 1))
    from a;
$$;

-- Gera as cobranças que vencem nos próximos 7 dias (mensalidade, ou o total do período, e a taxa).
create or replace function public.gerar_cobrancas_estudio()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       record;
  v_hoje  date := public.hoje_brasilia();
  v_venc  date;
  v_val   integer;
  v_unico boolean;
  v_meses integer;
  n       integer := 0;
begin
  for r in
    select a.*, e.taxa_matricula_centavos as taxa from public.estudio_alunos a join public.estudios e on e.id = a.estudio_id
     where a.situacao = 'ativo' and a.dia_vencimento is not null and e.tipo = 'estudio'
       and exists (select 1 from public.turma_alunos ta join public.turmas t on t.id = ta.turma_id and t.ativa
                    where ta.estudio_aluno_id = a.id)
  loop
    -- Próximo vencimento (este mês ou o seguinte).
    v_venc := make_date(extract(year from v_hoje)::int, extract(month from v_hoje)::int, r.dia_vencimento);
    if v_venc < v_hoje then
      v_venc := (v_venc + interval '1 month')::date;
    end if;
    continue when v_venc > v_hoje + 7;
    v_val := public.mensalidade_do_aluno_estudio(r.id);
    continue when v_val is null;
    -- Plano pago de uma vez: só no primeiro mês de cada período, com o total.
    v_unico := r.plano_meses > 1 and exists (
      select 1 from public.estudio_planos p
       where p.estudio_id = r.estudio_id and p.meses = r.plano_meses and p.pagamento = 'unico');
    if v_unico then
      v_meses := (extract(year from v_venc)::int * 12 + extract(month from v_venc)::int)
               - (extract(year from coalesce(r.plano_inicio, v_venc))::int * 12
                  + extract(month from coalesce(r.plano_inicio, v_venc))::int);
      continue when v_meses < 0 or v_meses % r.plano_meses <> 0;
      v_val := v_val * r.plano_meses;
    end if;
    insert into public.estudio_cobrancas (estudio_id, estudio_aluno_id, aluno_id, referencia, vencimento, valor_centavos, tipo)
    values (r.estudio_id, r.id, r.aluno_id, date_trunc('month', v_venc)::date, v_venc, v_val, 'mensalidade')
    on conflict (estudio_aluno_id, referencia, tipo) do nothing;
    if found then
      n := n + 1;
      -- Taxa de matrícula: junto com a primeira mensalidade gerada depois de marcada.
      if r.taxa_pendente and r.taxa is not null then
        insert into public.estudio_cobrancas (estudio_id, estudio_aluno_id, aluno_id, referencia, vencimento, valor_centavos, tipo)
        values (r.estudio_id, r.id, r.aluno_id, date_trunc('month', v_venc)::date, v_venc, r.taxa, 'taxa')
        on conflict (estudio_aluno_id, referencia, tipo) do nothing;
        update public.estudio_alunos set taxa_pendente = false where id = r.id;
      end if;
    end if;
  end loop;
  return n;
end
$$;

-- Tabela: [{vezes, meses, valor_centavos}] (meses 1 se faltar).
create or replace function public.salvar_precos_estudio(p_estudio uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda as mensalidades.';
  end if;
  delete from public.estudio_precos where estudio_id = p_estudio;
  insert into public.estudio_precos (estudio_id, vezes, meses, valor_centavos)
  select p_estudio, (x ->> 'vezes')::integer, coalesce((x ->> 'meses')::integer, 1), (x ->> 'valor_centavos')::integer
    from jsonb_array_elements(p) x;
end
$$;

-- Planos oferecidos [{meses, pagamento}] e taxa de matrícula (null: não cobra).
create or replace function public.salvar_planos_estudio(p_estudio uuid, p_planos jsonb, p_taxa integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda os planos.';
  end if;
  delete from public.estudio_planos where estudio_id = p_estudio;
  insert into public.estudio_planos (estudio_id, meses, pagamento)
  select p_estudio, (x ->> 'meses')::integer, coalesce(x ->> 'pagamento', 'mensal') from jsonb_array_elements(coalesce(p_planos, '[]')) x;
  -- Preços de planos que deixaram de ser oferecidos saem da tabela.
  delete from public.estudio_precos pr
   where pr.estudio_id = p_estudio and pr.meses > 1
     and not exists (select 1 from public.estudio_planos pl where pl.estudio_id = p_estudio and pl.meses = pr.meses);
  update public.estudios set taxa_matricula_centavos = p_taxa where id = p_estudio;
end
$$;

-- Plano do aluno (meses, mês de início) e se a taxa de matrícula deve ser cobrada.
create or replace function public.salvar_plano_aluno(p_aluno uuid, p_meses integer, p_inicio date, p_taxa boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.estudio_alunos;
begin
  select * into a from public.estudio_alunos where id = p_aluno;
  if not found or not public.coordena_estudio(a.estudio_id) then
    raise exception 'Só a coordenação muda o plano dos alunos.';
  end if;
  if p_meses <> 1 and not exists (select 1 from public.estudio_planos where estudio_id = a.estudio_id and meses = p_meses) then
    raise exception 'Este plano não é oferecido pelo estúdio.';
  end if;
  update public.estudio_alunos
     set plano_meses = p_meses,
         plano_inicio = case when p_meses = 1 then null else date_trunc('month', coalesce(p_inicio, public.hoje_brasilia()))::date end,
         taxa_pendente = coalesce(p_taxa, false)
   where id = a.id;
end
$$;

revoke all on function public.mensalidade_do_aluno_estudio(uuid)                   from public, anon, authenticated;
revoke all on function public.gerar_cobrancas_estudio()                            from public, anon, authenticated;
revoke all on function public.salvar_precos_estudio(uuid, jsonb)                   from public, anon;
revoke all on function public.salvar_planos_estudio(uuid, jsonb, integer)          from public, anon;
revoke all on function public.salvar_plano_aluno(uuid, integer, date, boolean)     from public, anon;
grant execute on function public.salvar_precos_estudio(uuid, jsonb)                to authenticated;
grant execute on function public.salvar_planos_estudio(uuid, jsonb, integer)       to authenticated;
grant execute on function public.salvar_plano_aluno(uuid, integer, date, boolean)  to authenticated;

-- ─── Fechar o estúdio num dia (decisão 91) ─────────────────────────────────
-- A coordenação fecha um dia (enforcar feriado, imprevisto): todas as aulas do dia são
-- canceladas, inclusive as extras, e os alunos (com app) e os professores são avisados.
-- Reabrir o dia volta as aulas que tinham sido canceladas por isso.
create table if not exists public.estudio_dias_fechados (
  estudio_id uuid not null references public.estudios (id) on delete cascade,
  data       date not null,
  motivo     text check (motivo is null or char_length(motivo) <= 80),
  criado_por uuid references auth.users (id) on delete set null,
  criado_em  timestamptz not null default now(),
  primary key (estudio_id, data)
);
comment on table public.estudio_dias_fechados is 'Dias em que a coordenação fechou o estúdio (todas as aulas canceladas).';
alter table public.estudio_dias_fechados enable row level security;
create policy "equipe vê os dias fechados do estúdio" on public.estudio_dias_fechados
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);

-- Aula nova num dia fechado pela coordenação também nasce cancelada (inclusive extra).
create or replace function public.aula_turma_no_feriado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia date := (new.inicio at time zone 'America/Sao_Paulo')::date;
begin
  if new.situacao = 'agendada' and (
       exists (select 1 from public.estudio_dias_fechados d where d.estudio_id = new.estudio_id and d.data = v_dia)
       or (exists (select 1 from public.turmas t where t.id = new.turma_id and t.avulsa is null)
           and public.feriado_fechado_estudio(new.estudio_id, v_dia) is not null)) then
    new.situacao := 'cancelada';
    new.por_feriado := true;
  end if;
  return new;
end
$$;

create or replace function public.sincronizar_feriados_estudio(p_estudio uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Fecha: feriados fechados (só turmas) e dias fechados pela coordenação (todas as aulas).
  update public.aulas_turma a
     set situacao = 'cancelada', por_feriado = true
    from public.turmas t
   where t.id = a.turma_id
     and a.estudio_id = p_estudio and a.situacao = 'agendada' and a.inicio > now() and a.chamada_em is null
     and (exists (select 1 from public.estudio_dias_fechados d
                   where d.estudio_id = p_estudio and d.data = (a.inicio at time zone 'America/Sao_Paulo')::date)
          or (t.avulsa is null
              and public.feriado_fechado_estudio(p_estudio, (a.inicio at time zone 'America/Sao_Paulo')::date) is not null));
  -- Abre: reabre as canceladas por isso quando o dia volta a funcionar.
  update public.aulas_turma a
     set situacao = 'agendada', por_feriado = false
   where a.estudio_id = p_estudio and a.por_feriado and a.situacao = 'cancelada' and a.inicio > now()
     and not exists (select 1 from public.estudio_dias_fechados d
                      where d.estudio_id = p_estudio and d.data = (a.inicio at time zone 'America/Sao_Paulo')::date)
     and public.feriado_fechado_estudio(p_estudio, (a.inicio at time zone 'America/Sao_Paulo')::date) is null;
end
$$;

create or replace function public.fechar_dia_estudio(p_estudio uuid, p_data date, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e      public.estudios;
  v_mot  text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_tit  text;
  v_corp text;
  v_alunos uuid[];
  v_profs  uuid[];
  u      uuid;
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação fecha o estúdio num dia.';
  end if;
  if p_data is null or p_data < public.hoje_brasilia() then
    raise exception 'Escolha um dia de hoje em diante.';
  end if;
  select * into e from public.estudios where id = p_estudio;
  -- Quem precisa ser avisado: alunos das turmas com aula no dia e os professores dessas aulas.
  select coalesce(array_agg(distinct al.aluno_id), '{}') into v_alunos
    from public.aulas_turma a
    join public.turma_alunos ta on ta.turma_id = a.turma_id
    join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
   where a.estudio_id = p_estudio and a.situacao = 'agendada' and al.aluno_id is not null
     and (a.inicio at time zone 'America/Sao_Paulo')::date = p_data and a.inicio > now();
  select coalesce(array_agg(distinct a.professor_id), '{}') into v_profs
    from public.aulas_turma a
   where a.estudio_id = p_estudio and a.situacao = 'agendada' and a.professor_id is not null
     and (a.inicio at time zone 'America/Sao_Paulo')::date = p_data and a.inicio > now();

  insert into public.estudio_dias_fechados (estudio_id, data, motivo, criado_por)
  values (p_estudio, p_data, v_mot, auth.uid())
  on conflict (estudio_id, data) do update set motivo = excluded.motivo;
  perform public.sincronizar_feriados_estudio(p_estudio);

  v_tit := e.nome || ' fechado em ' || to_char(p_data, 'DD/MM');
  v_corp := coalesce(v_mot || '. ', '') || 'As aulas deste dia foram canceladas.';
  foreach u in array v_alunos loop
    perform public.notificar(u, 'dia_fechado', v_tit, v_corp, '/aluno/estudio/' || p_estudio,
      p_chave => 'dia-fechado:' || p_estudio || ':' || p_data || ':' || u, p_respeita_silencio => false);
  end loop;
  foreach u in array v_profs loop
    perform public.notificar(u, 'dia_fechado', v_tit, v_corp, '/agenda/estudio/' || p_estudio,
      p_chave => 'dia-fechado:' || p_estudio || ':' || p_data || ':' || u, p_respeita_silencio => false);
  end loop;
  return coalesce(array_length(v_alunos, 1), 0) + coalesce(array_length(v_profs, 1), 0);
end
$$;

create or replace function public.reabrir_dia_estudio(p_estudio uuid, p_data date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação reabre o estúdio.';
  end if;
  delete from public.estudio_dias_fechados where estudio_id = p_estudio and data = p_data;
  perform public.sincronizar_feriados_estudio(p_estudio);
end
$$;

revoke all on function public.fechar_dia_estudio(uuid, date, text)  from public, anon;
revoke all on function public.reabrir_dia_estudio(uuid, date)       from public, anon;
grant execute on function public.fechar_dia_estudio(uuid, date, text) to authenticated;
grant execute on function public.reabrir_dia_estudio(uuid, date)      to authenticated;

commit;
