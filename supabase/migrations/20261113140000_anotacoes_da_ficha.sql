-- Migração 43 (decisão 74): anotações do estúdio na ficha do aluno.
-- A equipe do estúdio escreve limitações e objetivos do aluno (ex.: aluno sem app, ou que relatou
-- uma dor numa aula). Fica só no estúdio: o perfil do aluno no P-Bell não muda.

alter table public.estudio_alunos
  add column limitacoes_estudio text not null default '' check (char_length(limitacoes_estudio) <= 500),
  add column objetivos_estudio  text not null default '' check (char_length(objetivos_estudio) <= 500);

create or replace function public.ficha_aluno_estudio(p_estudio_aluno uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ea          public.estudio_alunos;
  a           public.alunos;
  s           public.alunos_saude;
  v_consentiu boolean := false;
begin
  select * into ea from public.estudio_alunos where id = p_estudio_aluno;
  if not found or public.papel_no_estudio(ea.estudio_id) is null then
    raise exception 'Só a equipe do estúdio vê a ficha do aluno.';
  end if;
  if ea.aluno_id is not null then
    select * into a from public.alunos where id = ea.aluno_id;
    v_consentiu := public.tem_consentimento_saude(ea.aluno_id);
    if v_consentiu then
      select * into s from public.alunos_saude where aluno_id = ea.aluno_id;
    end if;
  end if;
  return jsonb_build_object(
    'com_app',             ea.aluno_id is not null,
    'objetivo',            nullif(btrim(coalesce(a.objetivo, '')), ''),
    'nivel',               a.nivel,
    'restricoes',          case when v_consentiu then nullif(btrim(s.restricoes), '') end,
    'sem_restricoes',      case when v_consentiu then s.restricoes_declaradas_em is not null and btrim(s.restricoes) = '' else false end,
    'limitacoes_estudio',  ea.limitacoes_estudio,
    'objetivos_estudio',   ea.objetivos_estudio,
    'dias',                coalesce((select jsonb_agg(distinct t.dia_semana)
                                       from public.turma_alunos ta join public.turmas t on t.id = ta.turma_id
                                      where ta.estudio_aluno_id = ea.id and t.ativa), '[]'::jsonb),
    'treino',              coalesce((select jsonb_agg(jsonb_build_object('dia', dia_semana, 'texto', texto) order by dia_semana)
                                       from public.estudio_treinos where estudio_aluno_id = ea.id), '[]'::jsonb)
  );
end
$$;

-- A equipe do estúdio grava as anotações (null mantém o que está).
create or replace function public.salvar_anotacoes_aluno_estudio(p_estudio_aluno uuid, p_limitacoes text, p_objetivos text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ea public.estudio_alunos;
begin
  select * into ea from public.estudio_alunos where id = p_estudio_aluno;
  if not found or public.papel_no_estudio(ea.estudio_id) is null then
    raise exception 'Só a equipe do estúdio escreve na ficha.';
  end if;
  if char_length(coalesce(p_limitacoes, '')) > 500 or char_length(coalesce(p_objetivos, '')) > 500 then
    raise exception 'Até 500 letras em cada caixa.';
  end if;
  update public.estudio_alunos
     set limitacoes_estudio = coalesce(btrim(p_limitacoes), limitacoes_estudio),
         objetivos_estudio  = coalesce(btrim(p_objetivos), objetivos_estudio)
   where id = ea.id;
end
$$;

revoke all on function public.salvar_anotacoes_aluno_estudio(uuid, text, text) from public, anon;
grant execute on function public.salvar_anotacoes_aluno_estudio(uuid, text, text) to authenticated;
