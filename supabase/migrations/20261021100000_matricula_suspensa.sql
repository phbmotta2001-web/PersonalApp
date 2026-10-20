-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: matrícula suspensa quando a mensalidade vence sem pagamento.
--
-- Decisões de 20/10/2026 (substituem o "sem bloqueio por enquanto" da decisão 33):
-- • No dia seguinte ao vencimento de uma mensalidade em aberto, a matrícula fica
--   SUSPENSA: o horário continua reservado e as aulas continuam na agenda do
--   personal (marcadas), mas o aluno não cancela, não remarca, não marca reposição
--   e não responde questionários; a tela dele mostra o alerta e o Pix.
-- • Volta sozinha quando o personal marca a mensalidade como paga (ou a cancela).
--   Não há robô: a suspensão é calculada na hora, a partir das cobranças.
-- • Ligada por padrão; o personal pode desligar para um aluno específico.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261020180000_frequencia_personalizada.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.matriculas
  add column suspender_se_atrasar boolean not null default true;

comment on column public.matriculas.suspender_se_atrasar is
  'Suspende a matrícula no dia seguinte ao vencimento de uma mensalidade em aberto (até ser paga).';

-- Desde quando a matrícula ativa do vínculo está suspensa (null = não está).
-- Uso interno (gatilhos e funções); não confere quem está logado.
create or replace function public.suspensa_desde(p_vinculo uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select min(c.vencimento) + 1
    from public.matriculas m
    join public.vinculos v on v.id = m.vinculo_id and v.situacao = 'ativo'
    join public.cobrancas c on c.matricula_id = m.id
   where m.vinculo_id = p_vinculo
     and m.situacao = 'ativa'
     and m.suspender_se_atrasar
     and c.tipo = 'mensalidade'
     and c.situacao = 'aberta'
     and c.vencimento < public.hoje_brasilia();
$$;

-- Matrículas suspensas que o usuário logado pode ver (como personal ou como aluno).
create or replace function public.matriculas_suspensas()
returns table (vinculo_id uuid, desde date)
language sql
stable
security definer
set search_path = ''
as $$
  select m.vinculo_id, public.suspensa_desde(m.vinculo_id)
    from public.matriculas m
   where m.situacao = 'ativa'
     and (m.personal_id = auth.uid() or m.aluno_id = auth.uid())
     and public.suspensa_desde(m.vinculo_id) is not null;
$$;

-- O personal liga ou desliga a suspensão automática de um aluno.
create or replace function public.definir_suspensao_automatica(p_vinculo uuid, p_ligada boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.matriculas
     set suspender_se_atrasar = coalesce(p_ligada, true)
   where vinculo_id = p_vinculo and situacao = 'ativa' and personal_id = auth.uid();
  if not found then
    raise exception 'Matrícula não encontrada entre os seus alunos.';
  end if;
end
$$;

-- ─── Bloqueio do aluno ─────────────────────────────────────────────────────
-- Vale para o que o próprio aluno faz (cancelar, remarcar, reposição, responder
-- pedidos). O personal e os robôs continuam mexendo nas aulas normalmente.

create or replace function public.aulas_bloqueio_do_aluno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = new.aluno_id
     and public.suspensa_desde(new.vinculo_id) is not null then
    raise exception 'Sua matrícula está suspensa até a mensalidade ser paga. Pague e avise seu personal.';
  end if;
  return new;
end
$$;

create trigger aulas_bloqueio_do_aluno
  before insert or update on public.aulas
  for each row execute function public.aulas_bloqueio_do_aluno();

create or replace function public.checkins_bloqueio_do_aluno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = new.aluno_id
     and old.respondido_em is null and new.respondido_em is not null
     and public.suspensa_desde(new.vinculo_id) is not null then
    raise exception 'Sua matrícula está suspensa até a mensalidade ser paga. Pague e avise seu personal.';
  end if;
  return new;
end
$$;

create trigger checkins_bloqueio_do_aluno
  before update on public.checkins
  for each row execute function public.checkins_bloqueio_do_aluno();

revoke all on function public.suspensa_desde(uuid)                       from public, anon, authenticated;
revoke all on function public.aulas_bloqueio_do_aluno()                  from public, anon, authenticated;
revoke all on function public.checkins_bloqueio_do_aluno()               from public, anon, authenticated;
revoke all on function public.matriculas_suspensas()                     from public, anon;
revoke all on function public.definir_suspensao_automatica(uuid, boolean) from public, anon;
grant execute on function public.matriculas_suspensas()                     to authenticated;
grant execute on function public.definir_suspensao_automatica(uuid, boolean) to authenticated;

commit;
