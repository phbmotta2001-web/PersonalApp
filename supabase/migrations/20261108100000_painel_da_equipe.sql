-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell: painel da equipe para acompanhar a beta (página /equipe).
--
-- Decisão de 08/11/2026: quem está na tabela "equipe" vê quantos personais e alunos
-- entraram e quem está usando. O painel mostra só contagens e datas: nada de dados de
-- saúde, cobranças individuais ou dados dos alunos.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez, depois de
-- 20261101100000_cref_opcional.sql. Depois, para entrar na equipe, rode (com o SEU e-mail):
--   insert into public.equipe (usuario_id) select id from auth.users where email = 'seu@email';
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table public.equipe (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  criado_em  timestamptz not null default now()
);

comment on table public.equipe is 'Pessoas da equipe do P-Bell: veem o painel da beta. Só se altera pelo SQL Editor.';

-- Sem regras de acesso: ninguém lê nem altera pelo app; só o painel abaixo consulta.
alter table public.equipe enable row level security;

create or replace function public.painel_beta()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoje date := public.hoje_brasilia();
begin
  if not exists (select 1 from public.equipe where usuario_id = auth.uid()) then
    raise exception 'Só a equipe do P-Bell vê este painel.';
  end if;

  return jsonb_build_object(
    'totais', jsonb_build_object(
      'personais', (select count(*) from public.personais),
      'personais_configurados', (select count(*) from public.personais where configurado_em is not null),
      'alunos_com_conta', (select count(*) from public.alunos),
      'alunos_ativos', (select count(*) from public.vinculos where situacao = 'ativo'),
      'alunos_sem_app', (select count(*) from public.vinculos where situacao = 'ativo' and sem_conta),
      'convites_pendentes', (select count(*) from public.vinculos where situacao = 'convidado' and expira_em > now()),
      'aulas_7_dias', (select count(*) from public.aulas
                        where inicio >= now() - interval '7 days' and inicio < now()
                          and situacao in ('agendada', 'confirmada', 'realizada')),
      'cobrancas_pagas_30_dias', (select count(*) from public.cobrancas
                                   where situacao = 'paga' and pago_em >= v_hoje - 30),
      'entraram_7_dias', (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days')
    ),
    'personais', coalesce((
      select jsonb_agg(linha order by (linha ->> 'criado_em') desc)
        from (
          select jsonb_build_object(
            'nome', p.nome_completo,
            'email', u.email,
            'whatsapp', p.whatsapp,
            'criado_em', p.criado_em,
            'configurado', p.configurado_em is not null,
            'ultimo_acesso', u.last_sign_in_at,
            'alunos_ativos', (select count(*) from public.vinculos v where v.personal_id = p.id and v.situacao = 'ativo'),
            'alunos_com_app', (select count(*) from public.vinculos v
                                where v.personal_id = p.id and v.situacao = 'ativo' and v.aluno_id is not null),
            'convites_pendentes', (select count(*) from public.vinculos v
                                    where v.personal_id = p.id and v.situacao = 'convidado' and v.expira_em > now()),
            'aulas_7_dias', (select count(*) from public.aulas a
                              where a.personal_id = p.id and a.inicio >= now() - interval '7 days' and a.inicio < now()
                                and a.situacao in ('agendada', 'confirmada', 'realizada')),
            'aulas_proximos_7_dias', (select count(*) from public.aulas a
                                       where a.personal_id = p.id and a.inicio >= now() and a.inicio < now() + interval '7 days'
                                         and a.situacao in ('agendada', 'confirmada', 'pendente')),
            'cobrancas_pagas_30_dias', (select count(*) from public.cobrancas c
                                         where c.personal_id = p.id and c.situacao = 'paga' and c.pago_em >= v_hoje - 30)
          ) as linha
            from public.personais p
            join auth.users u on u.id = p.id
        ) t
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.painel_beta() from public, anon;
grant execute on function public.painel_beta() to authenticated;

commit;
