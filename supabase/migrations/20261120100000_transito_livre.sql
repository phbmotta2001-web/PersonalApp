-- 57 · Trânsito livre dos alunos entre horários (decisão 96).
--
-- A coordenação liga ou desliga, no cadastro do estúdio e em Ajustes:
-- • Ligado (padrão, como era): o aluno entra numa turma, troca de horário ou sai de uma turma
--   sem confirmação (decisão 94).
-- • Desligado: cada uma dessas ações vira um pedido pendente. A coordenação é avisada e aprova
--   ou recusa no Início; o aluno é avisado da resposta. A vaga pedida fica guardada para ele
--   enquanto espera. A lista de espera continua igual; só a entrada na turma vira pedido.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

alter table public.estudios add column if not exists transito_livre boolean not null default true;

-- Fila: quem pediu para entrar a partir da vaga oferecida fica 'pedido' até a coordenação decidir.
alter table public.estudio_fila drop constraint if exists estudio_fila_situacao_check;
alter table public.estudio_fila add constraint estudio_fila_situacao_check
  check (situacao in ('esperando', 'oferecida', 'pedido', 'entrou', 'saiu', 'expirou'));

create table if not exists public.estudio_pedidos_frequencia (
  id                uuid primary key default gen_random_uuid(),
  estudio_id        uuid not null references public.estudios (id) on delete cascade,
  estudio_aluno_id  uuid not null references public.estudio_alunos (id) on delete cascade,
  -- entrar: entra na turma (com trocar_turma_id, larga essa turma dele); sair: sai da turma.
  tipo              text not null check (tipo in ('entrar', 'sair')),
  turma_id          uuid not null references public.turmas (id) on delete cascade,
  trocar_turma_id   uuid references public.turmas (id) on delete set null,
  fila_id           uuid references public.estudio_fila (id) on delete set null,
  situacao          text not null default 'pendente' check (situacao in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  criado_em         timestamptz not null default now(),
  decidido_em       timestamptz,
  decidido_por      uuid references auth.users (id) on delete set null
);
create unique index if not exists estudio_pedidos_um_por_turma
  on public.estudio_pedidos_frequencia (estudio_aluno_id, turma_id) where situacao = 'pendente';
create index if not exists estudio_pedidos_pendentes
  on public.estudio_pedidos_frequencia (estudio_id, criado_em) where situacao = 'pendente';
comment on table public.estudio_pedidos_frequencia is 'Pedidos do aluno para mudar de turma quando o trânsito livre está desligado.';
alter table public.estudio_pedidos_frequencia enable row level security;
create policy "coordenação e o próprio aluno veem os pedidos" on public.estudio_pedidos_frequencia
  for select to authenticated using (
    public.coordena_estudio(estudio_id)
    or exists (select 1 from public.estudio_alunos al where al.id = estudio_aluno_id and al.aluno_id = (select auth.uid())));

create or replace function public.salvar_transito_livre(p_estudio uuid, p_ligado boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda esta opção.';
  end if;
  update public.estudios set transito_livre = coalesce(p_ligado, true) where id = p_estudio;
end
$$;

-- Vagas livres: também desconta as vagas guardadas para pedidos de entrada pendentes.
create or replace function public.vagas_livres_turma(p_turma uuid, p_para uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select t.vagas
         - (select count(*)::integer from public.turma_alunos ta
              join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
             where ta.turma_id = t.id)
         - (select count(*)::integer from public.estudio_fila f
             where f.turma_id = t.id and f.situacao = 'oferecida' and f.expira_em > now()
               and f.estudio_aluno_id is distinct from p_para)
         - (select count(*)::integer from public.estudio_pedidos_frequencia pf
              join public.estudio_alunos al on al.id = pf.estudio_aluno_id and al.situacao = 'ativo'
             where pf.turma_id = t.id and pf.tipo = 'entrar' and pf.situacao = 'pendente'
               and pf.estudio_aluno_id is distinct from p_para)
    from public.turmas t where t.id = p_turma;
$$;

-- Avisa os professores das turmas envolvidas (e a coordenação, se p_coordenacao).
drop function if exists public.avisar_mudanca_frequencia(uuid, text, uuid[]);
create function public.avisar_mudanca_frequencia(p_estudio uuid, p_texto text, p_turmas uuid[], p_coordenacao boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select m.personal_id as quem, true as coordena
      from public.estudio_membros m where p_coordenacao and m.estudio_id = p_estudio and m.papel = 'coordenacao'
    union
    select t.professor_id, false
      from public.turmas t
     where t.id = any (p_turmas) and t.professor_id is not null
       and not exists (select 1 from public.estudio_membros m
                        where m.estudio_id = p_estudio and m.personal_id = t.professor_id and m.papel = 'coordenacao')
  loop
    perform public.notificar(r.quem, 'frequencia_aluno', 'Mudança de frequência', p_texto,
      case when r.coordena then '/estudio/' || p_estudio || '?aba=alunos' else '/agenda/estudio/' || p_estudio end,
      p_chave => 'frequencia:' || md5(p_texto || now()::text) || ':' || r.quem);
  end loop;
end
$$;

-- Faz a entrada (e a troca). Uso interno: quem chama já conferiu as regras.
create or replace function public.aplicar_entrada_turma(p_al uuid, p_turma uuid, p_troca uuid, p_coordenacao boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t      public.turmas;
  v_nome text;
begin
  select * into t from public.turmas where id = p_turma;
  insert into public.turma_alunos (turma_id, estudio_aluno_id) values (t.id, p_al);
  if p_troca is not null then
    delete from public.turma_alunos where turma_id = p_troca and estudio_aluno_id = p_al;
  end if;
  update public.estudio_fila set situacao = 'entrou'
   where turma_id = t.id and estudio_aluno_id = p_al and situacao = 'pedido';
  select nome into v_nome from public.estudio_alunos where id = p_al;
  perform public.avisar_mudanca_frequencia(t.estudio_id,
    v_nome || ' entrou na turma de ' || public.texto_turma(t.id)
      || coalesce(' no lugar da de ' || public.texto_turma(p_troca), '') || '.',
    array_remove(array[t.id, p_troca], null), p_coordenacao);
end
$$;

-- Avisa a coordenação de um pedido novo.
create or replace function public.avisar_pedido_frequencia(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p      public.estudio_pedidos_frequencia;
  v_nome text;
begin
  select * into p from public.estudio_pedidos_frequencia where id = p_pedido;
  select nome into v_nome from public.estudio_alunos where id = p.estudio_aluno_id;
  perform public.notificar(m.personal_id, 'pedido_frequencia', 'Pedido de mudança de turma',
            v_nome || case when p.tipo = 'sair' then ' pediu para sair da turma de ' else ' pediu para entrar na turma de ' end
              || public.texto_turma(p.turma_id)
              || coalesce(' no lugar da de ' || public.texto_turma(p.trocar_turma_id), '') || '. Aprove ou recuse no Início.',
            '/agenda', p_chave => 'pedido-frequencia:' || p.id)
     from public.estudio_membros m
    where m.estudio_id = p.estudio_id and m.papel = 'coordenacao';
end
$$;

-- O aluno entra numa turma (toda semana). Com p_trocar, larga essa turma dele.
-- Devolve 'feito' ou, com o trânsito livre desligado, 'pendente' (pedido para a coordenação).
drop function if exists public.entrar_na_turma_estudio(uuid, uuid);
create function public.entrar_na_turma_estudio(p_turma uuid, p_trocar uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  t       public.turmas;
  v_al    uuid;
  v_troca uuid := p_trocar;
  v_fila  public.estudio_fila;
  v_id    uuid;
begin
  select * into t from public.turmas where id = p_turma for update;
  if not found or not t.ativa or t.tipo <> 'turma' or t.avulsa is not null then
    raise exception 'Turma não encontrada.';
  end if;
  v_al := public.meu_aluno_no_estudio(t.estudio_id);
  if v_al is null then
    raise exception 'Você não é aluno deste estúdio.';
  end if;
  if exists (select 1 from public.turma_alunos where turma_id = t.id and estudio_aluno_id = v_al) then
    raise exception 'Você já está nesta turma.';
  end if;
  if exists (select 1 from public.estudio_pedidos_frequencia
              where estudio_aluno_id = v_al and turma_id = t.id and situacao = 'pendente') then
    raise exception 'Você já pediu esta mudança. Aguarde a coordenação.';
  end if;
  select * into v_fila from public.estudio_fila f
   where f.turma_id = t.id and f.estudio_aluno_id = v_al and f.situacao in ('esperando', 'oferecida');
  if v_troca is null and v_fila.id is not null then
    v_troca := v_fila.trocar_turma_id;
  end if;
  if v_troca is not null and not exists (select 1 from public.turma_alunos where turma_id = v_troca and estudio_aluno_id = v_al) then
    if p_trocar is not null then
      raise exception 'Escolha uma turma sua para trocar.';
    end if;
    v_troca := null; -- a turma escolhida na fila já não é dele
  end if;
  if coalesce(public.vagas_livres_turma(t.id, v_al), 0) <= 0 then
    raise exception 'Esta turma está cheia. Entre na lista de espera.';
  end if;

  if (select transito_livre from public.estudios where id = t.estudio_id) then
    perform public.aplicar_entrada_turma(v_al, t.id, v_troca, true);
    return 'feito';
  end if;

  -- Trânsito livre desligado: vira pedido e a vaga fica guardada para ele.
  if v_fila.id is not null then
    update public.estudio_fila set situacao = 'pedido' where id = v_fila.id;
  end if;
  insert into public.estudio_pedidos_frequencia (estudio_id, estudio_aluno_id, tipo, turma_id, trocar_turma_id, fila_id)
  values (t.estudio_id, v_al, 'entrar', t.id, v_troca, v_fila.id)
  returning id into v_id;
  perform public.avisar_pedido_frequencia(v_id);
  return 'pendente';
end
$$;

-- O aluno sai de uma turma dele (diminui a frequência); precisa ficar em pelo menos uma.
drop function if exists public.sair_da_turma_estudio(uuid);
create function public.sair_da_turma_estudio(p_turma uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  t      public.turmas;
  v_al   uuid;
  v_nome text;
  v_id   uuid;
begin
  select * into t from public.turmas where id = p_turma;
  if not found then
    raise exception 'Turma não encontrada.';
  end if;
  v_al := public.meu_aluno_no_estudio(t.estudio_id);
  if v_al is null or not exists (select 1 from public.turma_alunos where turma_id = t.id and estudio_aluno_id = v_al) then
    raise exception 'Esta turma não é sua.';
  end if;
  if (select count(*) from public.turma_alunos where estudio_aluno_id = v_al) <= 1 then
    raise exception 'Esta é sua única turma. Para sair do estúdio, fale com a coordenação.';
  end if;
  if exists (select 1 from public.estudio_pedidos_frequencia
              where estudio_aluno_id = v_al and turma_id = t.id and situacao = 'pendente') then
    raise exception 'Você já pediu esta mudança. Aguarde a coordenação.';
  end if;

  if not (select transito_livre from public.estudios where id = t.estudio_id) then
    insert into public.estudio_pedidos_frequencia (estudio_id, estudio_aluno_id, tipo, turma_id)
    values (t.estudio_id, v_al, 'sair', t.id)
    returning id into v_id;
    perform public.avisar_pedido_frequencia(v_id);
    return 'pendente';
  end if;

  delete from public.turma_alunos where turma_id = t.id and estudio_aluno_id = v_al;
  select nome into v_nome from public.estudio_alunos where id = v_al;
  perform public.avisar_mudanca_frequencia(t.estudio_id,
    v_nome || ' saiu da turma de ' || public.texto_turma(t.id) || '.', array[t.id]);
  return 'feito';
end
$$;

-- A coordenação aprova ou recusa um pedido. O aluno é avisado.
create or replace function public.decidir_pedido_frequencia(p_pedido uuid, p_aprovar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p       public.estudio_pedidos_frequencia;
  al      public.estudio_alunos;
  v_troca uuid;
  v_texto text;
begin
  select * into p from public.estudio_pedidos_frequencia where id = p_pedido for update;
  if not found or not public.coordena_estudio(p.estudio_id) then
    raise exception 'Pedido não encontrado.';
  end if;
  if p.situacao <> 'pendente' then
    raise exception 'Este pedido já foi respondido.';
  end if;
  select * into al from public.estudio_alunos where id = p.estudio_aluno_id;
  v_texto := case when p.tipo = 'sair' then 'sair da turma de ' else 'entrar na turma de ' end || public.texto_turma(p.turma_id)
             || coalesce(' no lugar da de ' || public.texto_turma(p.trocar_turma_id), '');

  if p_aprovar then
    if al.situacao <> 'ativo' then
      raise exception 'Este aluno não está mais ativo no estúdio.';
    end if;
    if p.tipo = 'entrar' then
      if exists (select 1 from public.turma_alunos where turma_id = p.turma_id and estudio_aluno_id = al.id) then
        raise exception 'O aluno já está nesta turma.';
      end if;
      v_troca := case when exists (select 1 from public.turma_alunos where turma_id = p.trocar_turma_id and estudio_aluno_id = al.id)
                      then p.trocar_turma_id end;
      update public.estudio_pedidos_frequencia set situacao = 'aprovado', decidido_em = now(), decidido_por = auth.uid() where id = p.id;
      perform public.aplicar_entrada_turma(al.id, p.turma_id, v_troca, false);
    else
      if not exists (select 1 from public.turma_alunos where turma_id = p.turma_id and estudio_aluno_id = al.id) then
        raise exception 'O aluno já não está nesta turma.';
      end if;
      if (select count(*) from public.turma_alunos where estudio_aluno_id = al.id) <= 1 then
        raise exception 'É a única turma do aluno. Para tirá-lo do estúdio, use a lista de alunos.';
      end if;
      update public.estudio_pedidos_frequencia set situacao = 'aprovado', decidido_em = now(), decidido_por = auth.uid() where id = p.id;
      delete from public.turma_alunos where turma_id = p.turma_id and estudio_aluno_id = al.id;
      perform public.avisar_mudanca_frequencia(p.estudio_id,
        al.nome || ' saiu da turma de ' || public.texto_turma(p.turma_id) || '.', array[p.turma_id], false);
    end if;
  else
    update public.estudio_pedidos_frequencia set situacao = 'recusado', decidido_em = now(), decidido_por = auth.uid() where id = p.id;
    if p.fila_id is not null then
      update public.estudio_fila set situacao = 'saiu' where id = p.fila_id and situacao = 'pedido';
    end if;
    if p.tipo = 'entrar' then
      perform public.oferecer_vagas_fila(p.turma_id);
    end if;
  end if;

  if al.aluno_id is not null then
    perform public.notificar(al.aluno_id, 'pedido_frequencia_resposta',
      case when p_aprovar then 'Pedido aprovado' else 'Pedido recusado' end,
      'A coordenação ' || case when p_aprovar then 'aprovou' else 'recusou' end || ' seu pedido para ' || v_texto || '.',
      '/aluno/estudio/' || p.estudio_id, p_chave => 'pedido-frequencia-resposta:' || p.id);
  end if;
end
$$;

-- O aluno desiste de um pedido pendente.
create or replace function public.cancelar_pedido_frequencia(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.estudio_pedidos_frequencia;
begin
  select x.* into p from public.estudio_pedidos_frequencia x
    join public.estudio_alunos al on al.id = x.estudio_aluno_id and al.aluno_id = auth.uid()
   where x.id = p_pedido and x.situacao = 'pendente'
   for update of x;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  update public.estudio_pedidos_frequencia set situacao = 'cancelado', decidido_em = now() where id = p.id;
  if p.fila_id is not null then
    update public.estudio_fila set situacao = 'saiu' where id = p.fila_id and situacao = 'pedido';
  end if;
  if p.tipo = 'entrar' then
    perform public.oferecer_vagas_fila(p.turma_id);
  end if;
end
$$;

-- Pedidos pendentes: da coordenação (todos os estúdios que coordena) ou do aluno logado.
create or replace function public.pedidos_frequencia_pendentes()
returns table (id uuid, estudio_id uuid, estudio text, aluno text, whatsapp text, tipo text,
               turma_id uuid, turma text, trocar text, criado_em timestamptz, meu boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.estudio_id, e.nome, al.nome, al.whatsapp, p.tipo,
         p.turma_id, public.texto_turma(p.turma_id), public.texto_turma(p.trocar_turma_id), p.criado_em,
         al.aluno_id is not distinct from auth.uid()
    from public.estudio_pedidos_frequencia p
    join public.estudio_alunos al on al.id = p.estudio_aluno_id
    join public.estudios e on e.id = p.estudio_id
   where p.situacao = 'pendente' and al.situacao = 'ativo'
     and (al.aluno_id = auth.uid() or public.coordena_estudio(p.estudio_id))
   order by p.criado_em;
$$;

revoke all on function public.salvar_transito_livre(uuid, boolean)                from public, anon;
revoke all on function public.vagas_livres_turma(uuid, uuid)                      from public, anon, authenticated;
revoke all on function public.avisar_mudanca_frequencia(uuid, text, uuid[], boolean) from public, anon, authenticated;
revoke all on function public.aplicar_entrada_turma(uuid, uuid, uuid, boolean)    from public, anon, authenticated;
revoke all on function public.avisar_pedido_frequencia(uuid)                      from public, anon, authenticated;
revoke all on function public.entrar_na_turma_estudio(uuid, uuid)                 from public, anon;
revoke all on function public.sair_da_turma_estudio(uuid)                         from public, anon;
revoke all on function public.decidir_pedido_frequencia(uuid, boolean)            from public, anon;
revoke all on function public.cancelar_pedido_frequencia(uuid)                    from public, anon;
revoke all on function public.pedidos_frequencia_pendentes()                      from public, anon;
grant execute on function public.salvar_transito_livre(uuid, boolean)     to authenticated;
grant execute on function public.entrar_na_turma_estudio(uuid, uuid)      to authenticated;
grant execute on function public.sair_da_turma_estudio(uuid)              to authenticated;
grant execute on function public.decidir_pedido_frequencia(uuid, boolean) to authenticated;
grant execute on function public.cancelar_pedido_frequencia(uuid)         to authenticated;
grant execute on function public.pedidos_frequencia_pendentes()           to authenticated;

commit;
