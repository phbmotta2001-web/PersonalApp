-- 64 · Mensalidade no app do aluno, ganhos do professor e comunicados (decisão 102).
--
-- • O aluno do estúdio vê as mensalidades no app, com o Pix do estúdio, e avisa "Já paguei". A
--   coordenação é avisada e confirma (a aba Alunos já mostra "avisou que pagou").
-- • O professor vê quanto vai receber de cada estúdio no mês (a mesma previsão da coordenação,
--   só a dele) e se já foi pago.
-- • Comunicados: a coordenação escreve um recado para todos ou alguns alunos. Aparece no Início
--   do aluno (sem notificação no celular) e vai com link no WhatsApp.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

-- ─── Mensalidade no app do aluno ──────────────────────────────────────────
create or replace function public.minhas_mensalidades_estudio(p_estudio uuid)
returns table (id uuid, tipo text, vencimento date, valor_centavos integer, situacao text, pago_em date, aluno_avisou_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.tipo, c.vencimento, c.valor_centavos, c.situacao, c.pago_em, c.aluno_avisou_em
    from public.estudio_cobrancas c
   where c.estudio_aluno_id = public.meu_aluno_no_estudio(p_estudio) and c.situacao <> 'cancelada'
   order by c.vencimento desc
   limit 12;
$$;

-- O Pix do estúdio, para o aluno pagar.
create or replace function public.pix_do_estudio_para_aluno(p_estudio uuid)
returns table (tipo text, chave text, nome text, cidade text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.pix_tipo, e.pix_chave, e.pix_nome, e.pix_cidade
    from public.estudios e
   where e.id = p_estudio and e.pix_chave is not null and public.meu_aluno_no_estudio(p_estudio) is not null;
$$;

create or replace function public.avisar_pagamento_estudio(p_cobranca uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c      public.estudio_cobrancas;
  v_nome text;
begin
  select * into c from public.estudio_cobrancas where id = p_cobranca for update;
  if not found or c.estudio_aluno_id is distinct from public.meu_aluno_no_estudio(c.estudio_id) then
    raise exception 'Mensalidade não encontrada.';
  end if;
  if c.situacao <> 'aberta' then
    raise exception 'Esta mensalidade não está em aberto.';
  end if;
  if c.aluno_avisou_em is not null then
    return;
  end if;
  update public.estudio_cobrancas set aluno_avisou_em = now() where id = c.id;
  select nome into v_nome from public.estudio_alunos where id = c.estudio_aluno_id;
  perform public.notificar(m.personal_id, 'pagamento_avisado_estudio', 'Aluno avisou que pagou',
            split_part(btrim(v_nome), ' ', 1) || ' avisou que pagou '
              || case when c.tipo = 'taxa' then 'a taxa de matrícula' else 'a mensalidade' end
              || ' de R$ ' || replace(replace(replace(to_char(c.valor_centavos / 100.0, 'FM999,999,990.00'), ',', '#'), '.', ','), '#', '.')
              || '. Confira e confirme.',
            '/estudio/' || c.estudio_id || '?aba=alunos', p_chave => 'pagou:' || c.id || ':' || m.personal_id)
     from public.estudio_membros m
    where m.estudio_id = c.estudio_id and m.papel = 'coordenacao';
end
$$;

-- ─── Ganhos do professor ──────────────────────────────────────────────────
-- A previsão de pagamento (mesma de 20261115180000), agora também chamada por meus_ganhos_estudios.
create or replace function public.previsao_pagamento_professores(p_estudio uuid, p_mes date)
returns table (personal_id uuid, valor_centavos integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e       public.estudios;
  v_ini   timestamptz := public.instante_brasilia(date_trunc('month', p_mes)::date, 0);
  v_fim   timestamptz := public.instante_brasilia((date_trunc('month', p_mes) + interval '1 month')::date, 0);
begin
  if not public.coordena_estudio(p_estudio) and coalesce(current_setting('pbell.meus_ganhos', true), '') <> 'sim' then
    raise exception 'Só a coordenação vê o pagamento dos professores.';
  end if;
  select * into e from public.estudios where id = p_estudio;

  return query
  with todas as (
    select a.*, t.tipo,
           (case when a.fim <= now()
                 then (select count(*) from public.presencas p where p.aula_turma_id = a.id and p.situacao = 'presente')
                 else (select count(*) from public.turma_alunos ta
                         join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
                        where ta.turma_id = a.turma_id)
            end)::integer as presentes
      from public.aulas_turma a join public.turmas t on t.id = a.turma_id
     where a.estudio_id = p_estudio and a.situacao = 'agendada' and a.inicio >= v_ini and a.inicio < v_fim
  ),
  dadas as (select * from todas where ausencia_id is null),
  repostas as (
    select r.professor_id,
           sum(case
                 when r.tipo = 'turma' and e.reposicao_modelo = 'por_aluno'
                   then r.presentes * coalesce(e.reposicao_valor_centavos, 0)
                 else round(extract(epoch from r.fim - r.inicio) / 3600.0
                            * coalesce(case when e.reposicao_modelo = 'hora' then e.reposicao_valor_centavos end, e.valor_hora_centavos, 0))
               end)::integer as valor
      from todas r where r.ausencia_id is not null and r.professor_id is not null
     group by r.professor_id
  ),
  por_prof as (
    select d.professor_id,
           (count(*) filter (where d.tipo = 'turma'))::integer as aulas,
           sum(extract(epoch from d.fim - d.inicio) / 60)::integer as minutos,
           coalesce(sum(extract(epoch from d.fim - d.inicio) / 60) filter (where d.tipo = 'turno'), 0)::integer as minutos_turno,
           coalesce(sum(d.presentes) filter (where d.tipo = 'turma'), 0)::integer as presencas
      from dadas d where d.professor_id is not null
     group by d.professor_id
  ),
  -- Decisão 86: no percentual, o professor recebe pelo mês, pelas turmas dele (não pelas aulas
  -- dadas). Aluno em turmas de professores diferentes: a mensalidade se divide pelas turmas.
  partes as (
    select t.professor_id, ta.estudio_aluno_id,
           count(*)::numeric / sum(count(*)) over (partition by ta.estudio_aluno_id) as fracao
      from public.turma_alunos ta
      join public.turmas t on t.id = ta.turma_id and t.estudio_id = p_estudio and t.ativa and t.tipo = 'turma'
      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
     where ta.desde < (date_trunc('month', p_mes) + interval '1 month')::date
     group by t.professor_id, ta.estudio_aluno_id
  ),
  base_percentual as (
    select pt.professor_id,
           sum(pt.fracao * coalesce(public.mensalidade_do_aluno_estudio(pt.estudio_aluno_id), 0)) as soma
      from partes pt where pt.professor_id is not null group by pt.professor_id
  )
  select m.personal_id,
         ((case e.pagamento_modelo
            when 'hora' then round(coalesce(pp.minutos, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            when 'aula_comissao' then coalesce(pp.aulas, 0) * coalesce(m.valor_aula_centavos, e.valor_aula_centavos, 0)
                                    + coalesce(pp.presencas, 0) * coalesce(m.valor_por_aluno_centavos, e.valor_por_aluno_centavos, 0)
                                    + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            else round(coalesce(bp.soma, 0) * coalesce(m.percentual, e.percentual, 0) / 100)
                 + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
          end) + coalesce(rp.valor, 0))::integer
    from public.estudio_membros m
    left join por_prof pp on pp.professor_id = m.personal_id
    left join repostas rp on rp.professor_id = m.personal_id
    left join base_percentual bp on bp.professor_id = m.personal_id
   where m.estudio_id = p_estudio;
end
$$;

-- Quanto o professor logado recebe de cada estúdio no mês (só o valor dele).
create or replace function public.meus_ganhos_estudios(p_mes date)
returns table (estudio_id uuid, nome text, previsao_centavos integer, pago_em date, valor_pago_centavos integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  x     record;
begin
  perform set_config('pbell.meus_ganhos', 'sim', true);
  for x in
    select m.estudio_id, e.nome from public.estudio_membros m join public.estudios e on e.id = m.estudio_id
     where m.personal_id = auth.uid() order by e.nome
  loop
    estudio_id := x.estudio_id;
    nome := x.nome;
    select pv.valor_centavos into previsao_centavos
      from public.previsao_pagamento_professores(x.estudio_id, v_mes) pv where pv.personal_id = auth.uid();
    select pg.pago_em, pg.valor_centavos into pago_em, valor_pago_centavos
      from public.estudio_pagamentos pg where pg.estudio_id = x.estudio_id and pg.personal_id = auth.uid() and pg.mes = v_mes;
    previsao_centavos := coalesce(previsao_centavos, 0);
    return next;
    pago_em := null;
    valor_pago_centavos := null;
  end loop;
  perform set_config('pbell.meus_ganhos', '', true);
end
$$;

-- ─── Comunicados da coordenação ───────────────────────────────────────────
create table if not exists public.estudio_comunicados (
  id          uuid primary key default gen_random_uuid(),
  estudio_id  uuid not null references public.estudios (id) on delete cascade,
  texto       text not null check (char_length(btrim(texto)) between 2 and 600),
  criado_por  uuid references auth.users (id) on delete set null,
  criado_em   timestamptz not null default now()
);
create index if not exists estudio_comunicados_por_estudio on public.estudio_comunicados (estudio_id, criado_em desc);
create table if not exists public.estudio_comunicado_alunos (
  comunicado_id     uuid not null references public.estudio_comunicados (id) on delete cascade,
  estudio_aluno_id  uuid not null references public.estudio_alunos (id) on delete cascade,
  lido_em           timestamptz,
  primary key (comunicado_id, estudio_aluno_id)
);
create index if not exists estudio_comunicado_alunos_por_aluno on public.estudio_comunicado_alunos (estudio_aluno_id) where lido_em is null;
comment on table public.estudio_comunicados is 'Recados da coordenação para os alunos (aparecem no Início do app e vão pelo WhatsApp).';
alter table public.estudio_comunicados enable row level security;
alter table public.estudio_comunicado_alunos enable row level security;
create policy "coordenação vê os comunicados" on public.estudio_comunicados
  for select to authenticated using (public.coordena_estudio(estudio_id));

create or replace function public.enviar_comunicado_estudio(p_estudio uuid, p_texto text, p_alunos uuid[] default null)
returns table (estudio_aluno_id uuid, nome text, whatsapp text, com_app boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação envia comunicados.';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 600 then
    raise exception 'Escreva o comunicado (até 600 letras).';
  end if;
  if p_alunos is not null and cardinality(p_alunos) = 0 then
    raise exception 'Escolha pelo menos um aluno.';
  end if;
  insert into public.estudio_comunicados (estudio_id, texto, criado_por)
  values (p_estudio, btrim(p_texto), auth.uid())
  returning id into v_id;
  insert into public.estudio_comunicado_alunos (comunicado_id, estudio_aluno_id)
  select v_id, al.id from public.estudio_alunos al
   where al.estudio_id = p_estudio and al.situacao = 'ativo' and (p_alunos is null or al.id = any (p_alunos));
  return query
  select al.id, al.nome, al.whatsapp, al.aluno_id is not null
    from public.estudio_comunicado_alunos ca join public.estudio_alunos al on al.id = ca.estudio_aluno_id
   where ca.comunicado_id = v_id
   order by al.nome;
end
$$;

-- Os últimos comunicados, com quantos alunos receberam e leram (coordenação).
create or replace function public.comunicados_do_estudio(p_estudio uuid)
returns table (id uuid, texto text, criado_em timestamptz, enviados integer, lidos integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação vê os comunicados.';
  end if;
  return query
  select c.id, c.texto, c.criado_em,
         (select count(*)::integer from public.estudio_comunicado_alunos ca where ca.comunicado_id = c.id),
         (select count(*)::integer from public.estudio_comunicado_alunos ca where ca.comunicado_id = c.id and ca.lido_em is not null)
    from public.estudio_comunicados c
   where c.estudio_id = p_estudio
   order by c.criado_em desc
   limit 5;
end
$$;

-- Comunicados ainda não lidos do aluno logado (dos últimos 30 dias).
create or replace function public.meus_comunicados()
returns table (id uuid, estudio_id uuid, estudio text, texto text, criado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.estudio_id, e.nome, c.texto, c.criado_em
    from public.estudio_comunicado_alunos ca
    join public.estudio_alunos al on al.id = ca.estudio_aluno_id and al.aluno_id = auth.uid()
    join public.estudio_comunicados c on c.id = ca.comunicado_id
    join public.estudios e on e.id = c.estudio_id
   where ca.lido_em is null and c.criado_em > now() - interval '30 days'
   order by c.criado_em desc;
$$;

create or replace function public.marcar_comunicado_lido(p_comunicado uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.estudio_comunicado_alunos ca set lido_em = now()
    from public.estudio_alunos al
   where ca.comunicado_id = p_comunicado and al.id = ca.estudio_aluno_id and al.aluno_id = auth.uid() and ca.lido_em is null;
$$;

revoke all on function public.minhas_mensalidades_estudio(uuid)                from public, anon;
revoke all on function public.pix_do_estudio_para_aluno(uuid)                  from public, anon;
revoke all on function public.avisar_pagamento_estudio(uuid)                   from public, anon;
revoke all on function public.meus_ganhos_estudios(date)                       from public, anon;
revoke all on function public.enviar_comunicado_estudio(uuid, text, uuid[])    from public, anon;
revoke all on function public.comunicados_do_estudio(uuid)                     from public, anon;
revoke all on function public.meus_comunicados()                               from public, anon;
revoke all on function public.marcar_comunicado_lido(uuid)                     from public, anon;
grant execute on function public.minhas_mensalidades_estudio(uuid)             to authenticated;
grant execute on function public.pix_do_estudio_para_aluno(uuid)               to authenticated;
grant execute on function public.avisar_pagamento_estudio(uuid)                to authenticated;
grant execute on function public.meus_ganhos_estudios(date)                    to authenticated;
grant execute on function public.enviar_comunicado_estudio(uuid, text, uuid[]) to authenticated;
grant execute on function public.comunicados_do_estudio(uuid)                  to authenticated;
grant execute on function public.meus_comunicados()                            to authenticated;
grant execute on function public.marcar_comunicado_lido(uuid)                  to authenticated;

commit;
