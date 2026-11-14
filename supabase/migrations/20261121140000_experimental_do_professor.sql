-- 61 · Experimental: o professor só agenda nas aulas dele, e o ParQ e a anamnese vão junto (decisão 99).
--
-- • O professor agenda aula experimental só nas aulas que ele dá. A coordenação, em qualquer aula.
-- • Ao agendar, "Enviar ParQ e anamnese" (ligado por padrão): os dois já ficam esperando o aluno
--   (ele responde ao entrar no app). Desligado, o aluno não recebe os dois automaticamente.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

alter table public.estudio_alunos add column if not exists formularios_iniciais boolean not null default true;
comment on column public.estudio_alunos.formularios_iniciais is 'Falso quando a equipe escolheu não enviar o ParQ e a anamnese automaticamente.';

-- O aluno entrou no app: ParQ e anamnese para preencher (se não foi desligado).
create or replace function public.estudio_alunos_formularios_iniciais()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.aluno_id is null or new.situacao not in ('ativo', 'experimental') or not new.formularios_iniciais then
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
revoke all on function public.estudio_alunos_formularios_iniciais() from public, anon, authenticated;

drop function if exists public.agendar_aula_experimental(uuid, text, text);

-- Agenda a experimental. Devolve {aluno, codigo} (o código do link de cadastro, vale 14 dias).
create or replace function public.agendar_aula_experimental(p_aula uuid, p_nome text, p_whatsapp text, p_formularios boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      public.aulas_turma;
  t      public.turmas;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_zap  text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_cod  text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_al   uuid;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  if public.papel_no_estudio(a.estudio_id) is null then
    raise exception 'Só a equipe do estúdio agenda aula experimental.';
  end if;
  if not public.coordena_estudio(a.estudio_id) and a.professor_id is distinct from auth.uid() then
    raise exception 'Agende a experimental só nas suas aulas.';
  end if;
  select * into t from public.turmas where id = a.turma_id;
  if t.tipo <> 'turma' or a.situacao = 'cancelada' then
    raise exception 'Esta aula não recebe alunos.';
  end if;
  if a.inicio <= now() then
    raise exception 'Escolha uma aula que ainda vai acontecer.';
  end if;
  if char_length(v_nome) not between 2 and 80 then
    raise exception 'Escreva o nome do aluno.';
  end if;
  if v_zap is not null and v_zap !~ '^\d{10,13}$' then
    raise exception 'Confira o WhatsApp (com DDD).';
  end if;
  if public.ocupacao_aula_turma(a.id) >= t.vagas then
    raise exception 'Esta aula está lotada.';
  end if;

  insert into public.estudio_alunos (estudio_id, nome, whatsapp, situacao, convite_codigo, convite_expira_em, formularios_iniciais)
  values (a.estudio_id, v_nome, v_zap, 'experimental', v_cod, now() + interval '14 days', coalesce(p_formularios, true))
  returning id into v_al;
  insert into public.estudio_experimentais (estudio_id, estudio_aluno_id, aula_turma_id, data, professor_id, agendado_por)
  values (a.estudio_id, v_al, a.id, (a.inicio at time zone 'America/Sao_Paulo')::date, a.professor_id, auth.uid());
  insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao, origem)
  values (a.id, v_al, 'presente', 'experimental');

  -- ParQ e anamnese já ficam esperando o aluno (ele responde ao entrar no app).
  if coalesce(p_formularios, true) then
    insert into public.estudio_respostas (estudio_id, formulario_id, estudio_aluno_id, tipo, titulo, perguntas, enviado_por)
    select f.estudio_id, f.id, v_al, f.tipo, f.nome, f.perguntas, auth.uid()
      from public.estudio_formularios f
     where f.estudio_id = a.estudio_id and f.tipo in ('parq', 'anamnese');
  end if;

  if a.professor_id is not null and a.professor_id is distinct from auth.uid() then
    perform public.notificar(a.professor_id, 'experimental_estudio', 'Aula experimental',
      split_part(v_nome, ' ', 1) || ' vem fazer aula experimental na sua turma de ' || public.texto_aula_turma(a.id) || '.',
      '/agenda/turma/' || a.id, now(), null, null, null, null, null, true);
  end if;
  return jsonb_build_object('aluno', v_al, 'codigo', v_cod);
end
$$;

revoke all on function public.agendar_aula_experimental(uuid, text, text, boolean) from public, anon;
grant execute on function public.agendar_aula_experimental(uuid, text, text, boolean) to authenticated;

commit;
