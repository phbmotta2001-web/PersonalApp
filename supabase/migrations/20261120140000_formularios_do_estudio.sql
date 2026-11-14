-- 58 · Formulários do estúdio (decisão 97).
--
-- • Aba "Formulários" da coordenação. Todo estúdio já vem com um ParQ e uma anamnese padrão,
--   que a coordenação pode editar (não dá para apagar). Pode criar outros (pesquisas).
-- • Só a coordenação cria, edita e envia formulários.
-- • Quem entra no app como aluno do estúdio (aula experimental, link de alunos ou convite)
--   recebe o ParQ e a anamnese para preencher. Respondidos por quem vai fazer a experimental,
--   o professor da aula é avisado; "sim" no ParQ avisa também a coordenação.
-- • Enviar um formulário: para todos os alunos ou os de uma turma; o aluno é avisado no app e
--   a coordenação manda o link pelo WhatsApp.
-- • Respostas: a coordenação e os professores do aluno (turmas, aulas e experimental) veem.
-- • Cada envio guarda a cópia das perguntas; mudar o formulário só altera os ainda não respondidos.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

create table if not exists public.estudio_formularios (
  id             uuid primary key default gen_random_uuid(),
  estudio_id     uuid not null references public.estudios (id) on delete cascade,
  tipo           text not null check (tipo in ('parq', 'anamnese', 'pesquisa')),
  nome           text not null check (char_length(btrim(nome)) between 2 and 60),
  perguntas      jsonb not null check (jsonb_typeof(perguntas) = 'array' and jsonb_array_length(perguntas) between 1 and 30),
  arquivado      boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create unique index if not exists estudio_formularios_um_padrao
  on public.estudio_formularios (estudio_id, tipo) where tipo in ('parq', 'anamnese');
comment on table public.estudio_formularios is 'Formulários do estúdio: ParQ e anamnese padrão (editáveis) e pesquisas.';
alter table public.estudio_formularios enable row level security;
create policy "equipe vê os formulários do estúdio" on public.estudio_formularios
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);

create table if not exists public.estudio_respostas (
  id                uuid primary key default gen_random_uuid(),
  estudio_id        uuid not null references public.estudios (id) on delete cascade,
  formulario_id     uuid references public.estudio_formularios (id) on delete set null,
  estudio_aluno_id  uuid not null references public.estudio_alunos (id) on delete cascade,
  tipo              text not null check (tipo in ('parq', 'anamnese', 'pesquisa')),
  titulo            text not null,
  -- Cópia das perguntas do envio.
  perguntas         jsonb not null,
  enviado_em        timestamptz not null default now(),
  enviado_por       uuid references auth.users (id) on delete set null,
  respondido_em     timestamptz,
  respondido_por    uuid references auth.users (id) on delete set null,
  respostas         jsonb
);
create index if not exists estudio_respostas_por_aluno on public.estudio_respostas (estudio_aluno_id, enviado_em desc);
create index if not exists estudio_respostas_por_formulario on public.estudio_respostas (formulario_id);
create unique index if not exists estudio_respostas_uma_pendente
  on public.estudio_respostas (estudio_aluno_id, formulario_id) where respondido_em is null;
comment on table public.estudio_respostas is 'Cada formulário enviado a um aluno do estúdio e as respostas dele.';
alter table public.estudio_respostas enable row level security;
create policy "coordenação e o próprio aluno veem as respostas" on public.estudio_respostas
  for select to authenticated using (
    public.coordena_estudio(estudio_id)
    or exists (select 1 from public.estudio_alunos al where al.id = estudio_aluno_id and al.aluno_id = (select auth.uid())));

-- ─── ParQ e anamnese padrão ───────────────────────────────────────────────
create or replace function public.criar_formularios_padrao(p_estudio uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.estudio_formularios (estudio_id, tipo, nome, perguntas)
  select p_estudio, 'parq', 'ParQ', $j$[
    {"id": "parq1", "tipo": "sim_nao", "obrigatoria": true, "texto": "Algum médico já disse que você tem problema no coração ou pressão alta e só deve fazer exercício com acompanhamento médico?"},
    {"id": "parq2", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você sente dor no peito quando faz atividade física?"},
    {"id": "parq3", "tipo": "sim_nao", "obrigatoria": true, "texto": "No último mês, você sentiu dor no peito sem estar fazendo atividade física?"},
    {"id": "parq4", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você já perdeu o equilíbrio por causa de tontura ou já desmaiou?"},
    {"id": "parq5", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você tem algum problema nos ossos ou nas articulações que pode piorar com atividade física?"},
    {"id": "parq6", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você toma algum remédio para pressão arterial ou para o coração?"},
    {"id": "parq7", "tipo": "sim_nao", "obrigatoria": true, "texto": "Existe alguma outra razão pela qual você não deveria fazer atividade física?"},
    {"id": "declaracao", "tipo": "sim_nao", "obrigatoria": true, "texto": "Declaro que respondi com sinceridade e que, se respondi sim a alguma pergunta, vou consultar um médico antes de treinar."}
  ]$j$::jsonb
  where not exists (select 1 from public.estudio_formularios where estudio_id = p_estudio and tipo = 'parq');

  insert into public.estudio_formularios (estudio_id, tipo, nome, perguntas)
  select p_estudio, 'anamnese', 'Anamnese', $j$[
    {"id": "an1", "tipo": "texto", "obrigatoria": true, "texto": "Qual o seu objetivo com os treinos?"},
    {"id": "an2", "tipo": "escolha", "obrigatoria": true, "texto": "Você pratica atividade física?", "opcoes": ["Não", "Já pratiquei, mas parei", "Sim, pratico"]},
    {"id": "an3", "tipo": "texto", "obrigatoria": false, "texto": "Tem ou teve alguma lesão, dor ou cirurgia? Qual?"},
    {"id": "an4", "tipo": "texto", "obrigatoria": false, "texto": "Tem alguma doença (ex.: diabetes, hipertensão, asma)? Qual?"},
    {"id": "an5", "tipo": "texto", "obrigatoria": false, "texto": "Usa algum remédio? Qual?"},
    {"id": "an6", "tipo": "sim_nao", "obrigatoria": false, "texto": "Está grávida ou teve bebê nos últimos 6 meses?"},
    {"id": "an7", "tipo": "sim_nao", "obrigatoria": true, "texto": "Você fuma?"},
    {"id": "an8", "tipo": "nota", "obrigatoria": true, "texto": "De 0 a 10, como está o seu sono?"},
    {"id": "an9", "tipo": "texto", "obrigatoria": false, "texto": "Tem mais alguma coisa que o professor deva saber?"}
  ]$j$::jsonb
  where not exists (select 1 from public.estudio_formularios where estudio_id = p_estudio and tipo = 'anamnese');
end
$$;

create or replace function public.estudios_formularios_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.criar_formularios_padrao(new.id);
  return new;
end
$$;
drop trigger if exists estudios_formularios_padrao on public.estudios;
create trigger estudios_formularios_padrao
  after insert on public.estudios
  for each row execute function public.estudios_formularios_padrao();

-- Os estúdios que já existem também ganham os dois.
select public.criar_formularios_padrao(id) from public.estudios;

-- ─── Aluno entrou no app: ParQ e anamnese para preencher ─────────────────
create or replace function public.estudio_alunos_formularios_iniciais()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.aluno_id is null or new.situacao not in ('ativo', 'experimental') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.aluno_id is not distinct from new.aluno_id then
    return new;
  end if;
  insert into public.estudio_respostas (estudio_id, formulario_id, estudio_aluno_id, tipo, titulo, perguntas)
  select f.estudio_id, f.id, new.id, f.tipo, f.nome, f.perguntas
    from public.estudio_formularios f
   where f.estudio_id = new.estudio_id and f.tipo in ('parq', 'anamnese')
     and not exists (select 1 from public.estudio_respostas r where r.estudio_aluno_id = new.id and r.formulario_id = f.id);
  return new;
end
$$;
drop trigger if exists estudio_alunos_formularios_iniciais on public.estudio_alunos;
create trigger estudio_alunos_formularios_iniciais
  after insert or update of aluno_id on public.estudio_alunos
  for each row execute function public.estudio_alunos_formularios_iniciais();

-- ─── Coordenação: salvar, arquivar e enviar ──────────────────────────────
create or replace function public.salvar_formulario_estudio(p_estudio uuid, p_id uuid, p_nome text, p_perguntas jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda os formulários.';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) not between 2 and 60 then
    raise exception 'Dê um nome ao formulário (até 60 caracteres).';
  end if;
  if jsonb_typeof(p_perguntas) <> 'array' or jsonb_array_length(p_perguntas) not between 1 and 30
     or exists (select 1 from jsonb_array_elements(p_perguntas) q
                 where coalesce(q ->> 'id', '') = '' or q ->> 'tipo' not in ('nota', 'numero', 'sim_nao', 'escolha', 'texto')
                    or char_length(btrim(coalesce(q ->> 'texto', ''))) not between 2 and 140) then
    raise exception 'Confira as perguntas (de 1 a 30, cada uma com texto).';
  end if;
  if v_id is null then
    insert into public.estudio_formularios (estudio_id, tipo, nome, perguntas)
    values (p_estudio, 'pesquisa', btrim(p_nome), p_perguntas)
    returning id into v_id;
  else
    update public.estudio_formularios
       set nome = btrim(p_nome), perguntas = p_perguntas, atualizado_em = now()
     where id = v_id and estudio_id = p_estudio and not arquivado;
    if not found then
      raise exception 'Formulário não encontrado.';
    end if;
    -- Quem ainda não respondeu recebe a versão nova.
    update public.estudio_respostas set titulo = btrim(p_nome), perguntas = p_perguntas
     where formulario_id = v_id and respondido_em is null;
  end if;
  return v_id;
end
$$;

create or replace function public.arquivar_formulario_estudio(p_formulario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.estudio_formularios;
begin
  select * into f from public.estudio_formularios where id = p_formulario;
  if not found or not public.coordena_estudio(f.estudio_id) then
    raise exception 'Formulário não encontrado.';
  end if;
  if f.tipo <> 'pesquisa' then
    raise exception 'O ParQ e a anamnese não podem ser apagados; edite as perguntas.';
  end if;
  update public.estudio_formularios set arquivado = true, atualizado_em = now() where id = f.id;
  delete from public.estudio_respostas where formulario_id = f.id and respondido_em is null;
end
$$;

-- Envia para os alunos ativos (de uma turma, se p_turma). Quem já tem este formulário
-- pendente não recebe outro. Devolve os alunos que receberam (para o WhatsApp).
create or replace function public.enviar_formulario_estudio(p_formulario uuid, p_turma uuid default null)
returns table (resposta_id uuid, nome text, whatsapp text, com_app boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.estudio_formularios;
  r record;
begin
  select * into f from public.estudio_formularios where id = p_formulario;
  if not found or f.arquivado or not public.coordena_estudio(f.estudio_id) then
    raise exception 'Formulário não encontrado.';
  end if;
  if p_turma is not null and not exists (select 1 from public.turmas where id = p_turma and estudio_id = f.estudio_id) then
    raise exception 'Turma não encontrada.';
  end if;
  for r in
    insert into public.estudio_respostas (estudio_id, formulario_id, estudio_aluno_id, tipo, titulo, perguntas, enviado_por)
    select f.estudio_id, f.id, al.id, f.tipo, f.nome, f.perguntas, auth.uid()
      from public.estudio_alunos al
     where al.estudio_id = f.estudio_id and al.situacao = 'ativo'
       and (p_turma is null or exists (select 1 from public.turma_alunos ta where ta.turma_id = p_turma and ta.estudio_aluno_id = al.id))
       and not exists (select 1 from public.estudio_respostas x
                        where x.estudio_aluno_id = al.id and x.formulario_id = f.id and x.respondido_em is null)
    returning id, estudio_aluno_id
  loop
    select r.id, al.nome, al.whatsapp, al.aluno_id is not null
      into resposta_id, nome, whatsapp, com_app
      from public.estudio_alunos al where al.id = r.estudio_aluno_id;
    if com_app then
      perform public.notificar(al.aluno_id, 'formulario_estudio', 'Formulário do ' || e.nome,
                'Responda: ' || f.nome || '. Leva poucos minutos.',
                '/aluno/formulario/' || r.id, p_chave => 'formulario:' || r.id)
         from public.estudio_alunos al, public.estudios e
        where al.id = r.estudio_aluno_id and e.id = f.estudio_id;
    end if;
    return next;
  end loop;
end
$$;

-- ─── Aluno: responder ────────────────────────────────────────────────────
create or replace function public.responder_formulario_estudio(p_resposta uuid, p_respostas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      public.estudio_respostas;
  al     public.estudio_alunos;
  x      public.estudio_experimentais;
  v_sim  boolean;
  v_nome text;
begin
  select q.* into r from public.estudio_respostas q
    join public.estudio_alunos a on a.id = q.estudio_aluno_id and a.aluno_id = auth.uid()
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
  update public.estudio_respostas set respostas = p_respostas, respondido_em = now(), respondido_por = auth.uid() where id = r.id;

  if r.tipo not in ('parq', 'anamnese') then
    return;
  end if;
  select * into al from public.estudio_alunos where id = r.estudio_aluno_id;
  v_nome := split_part(btrim(al.nome), ' ', 1);
  v_sim := r.tipo = 'parq' and exists (
    select 1 from jsonb_array_elements(r.perguntas) q
     where q ->> 'tipo' = 'sim_nao' and q ->> 'id' <> 'declaracao' and p_respostas -> (q ->> 'id') = 'true'::jsonb);

  -- Aula experimental marcada: o professor da aula recebe antes.
  select * into x from public.estudio_experimentais
   where estudio_aluno_id = al.id and resultado is null and aula_turma_id is not null;
  if found and x.professor_id is not null then
    perform public.notificar(x.professor_id, 'formulario_respondido',
      case when r.tipo = 'parq' then 'ParQ da aula experimental' else 'Anamnese da aula experimental' end,
      v_nome || ' preencheu ' || case when r.tipo = 'parq' then 'o ParQ' else 'a anamnese' end
        || case when v_sim then ' e respondeu "sim" a alguma pergunta' else '' end
        || '. Veja antes da aula, na chamada.',
      '/agenda/turma/' || x.aula_turma_id, p_chave => 'formulario-respondido:' || r.id || ':' || x.professor_id);
  end if;
  -- "Sim" no ParQ: a coordenação também é avisada.
  if v_sim then
    perform public.notificar(m.personal_id, 'formulario_respondido', 'ParQ com "sim"',
              al.nome || ' respondeu "sim" a alguma pergunta do ParQ. Confira na ficha do aluno.',
              '/estudio/' || al.estudio_id || '?aba=alunos', p_chave => 'parq-sim:' || r.id || ':' || m.personal_id)
       from public.estudio_membros m
      where m.estudio_id = al.estudio_id and m.papel = 'coordenacao' and m.personal_id is distinct from x.professor_id;
  end if;
end
$$;

-- Formulários pendentes do aluno logado (todos os estúdios).
create or replace function public.meus_formularios_pendentes()
returns table (id uuid, estudio_id uuid, estudio text, tipo text, titulo text, enviado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.estudio_id, e.nome, r.tipo, r.titulo, r.enviado_em
    from public.estudio_respostas r
    join public.estudio_alunos al on al.id = r.estudio_aluno_id and al.aluno_id = auth.uid()
                                  and al.situacao in ('ativo', 'experimental')
    join public.estudios e on e.id = r.estudio_id
   where r.respondido_em is null
   order by case r.tipo when 'parq' then 0 when 'anamnese' then 1 else 2 end, r.enviado_em;
$$;

-- ─── Equipe: respostas de um aluno ───────────────────────────────────────
-- A coordenação vê todas; o professor, só as dos alunos dele (turmas, aulas dadas ou experimental).
create or replace function public.formularios_do_aluno_estudio(p_estudio_aluno uuid)
returns table (id uuid, tipo text, titulo text, perguntas jsonb, respostas jsonb, enviado_em timestamptz, respondido_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ea public.estudio_alunos;
begin
  select * into ea from public.estudio_alunos where estudio_alunos.id = p_estudio_aluno;
  if not found then
    raise exception 'Aluno não encontrado.';
  end if;
  if not public.coordena_estudio(ea.estudio_id)
     and not exists (select 1 from public.turma_alunos ta join public.turmas t on t.id = ta.turma_id
                      where ta.estudio_aluno_id = ea.id and t.professor_id = auth.uid())
     and not exists (select 1 from public.presencas p join public.aulas_turma a on a.id = p.aula_turma_id
                      where p.estudio_aluno_id = ea.id and a.professor_id = auth.uid())
     and not exists (select 1 from public.estudio_experimentais x
                      where x.estudio_aluno_id = ea.id and x.professor_id = auth.uid()) then
    raise exception 'Só a coordenação e os professores do aluno veem os formulários dele.';
  end if;
  return query
  select r.id, r.tipo, r.titulo, r.perguntas, r.respostas, r.enviado_em, r.respondido_em
    from public.estudio_respostas r
   where r.estudio_aluno_id = ea.id
   order by case r.tipo when 'parq' then 0 when 'anamnese' then 1 else 2 end, r.enviado_em desc;
end
$$;

revoke all on function public.criar_formularios_padrao(uuid)                      from public, anon, authenticated;
revoke all on function public.estudios_formularios_padrao()                       from public, anon, authenticated;
revoke all on function public.estudio_alunos_formularios_iniciais()               from public, anon, authenticated;
revoke all on function public.salvar_formulario_estudio(uuid, uuid, text, jsonb)  from public, anon;
revoke all on function public.arquivar_formulario_estudio(uuid)                   from public, anon;
revoke all on function public.enviar_formulario_estudio(uuid, uuid)               from public, anon;
revoke all on function public.responder_formulario_estudio(uuid, jsonb)           from public, anon;
revoke all on function public.meus_formularios_pendentes()                        from public, anon;
revoke all on function public.formularios_do_aluno_estudio(uuid)                  from public, anon;
grant execute on function public.salvar_formulario_estudio(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.arquivar_formulario_estudio(uuid)                  to authenticated;
grant execute on function public.enviar_formulario_estudio(uuid, uuid)              to authenticated;
grant execute on function public.responder_formulario_estudio(uuid, jsonb)          to authenticated;
grant execute on function public.meus_formularios_pendentes()                       to authenticated;
grant execute on function public.formularios_do_aluno_estudio(uuid)                 to authenticated;

commit;
