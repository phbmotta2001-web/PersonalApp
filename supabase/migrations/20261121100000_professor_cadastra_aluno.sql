-- 60 · O professor também cadastra alunos (decisão 98).
--
-- Na página do estúdio, o professor cadastra um aluno com nome e WhatsApp e, se quiser, o põe
-- nas turmas dele (com vaga). Recebe o link do app para mandar ao aluno (vale 14 dias) e a
-- coordenação é avisada. Não repete aluno ativo com o mesmo nome ou o mesmo WhatsApp.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

create or replace function public.cadastrar_aluno_pela_equipe(p_estudio uuid, p_nome text, p_whatsapp text, p_turmas uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome  text := btrim(coalesce(p_nome, ''));
  v_zap   text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_cod   text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_coord boolean := public.coordena_estudio(p_estudio);
  v_al    uuid;
  v_quem  text;
  v_turma uuid;
  v_txt   text;
begin
  if public.papel_no_estudio(p_estudio) is null then
    raise exception 'Só a equipe do estúdio cadastra alunos.';
  end if;
  if char_length(v_nome) not between 2 and 80 then
    raise exception 'Escreva o nome do aluno.';
  end if;
  if v_zap is null or v_zap !~ '^\d{10,13}$' then
    raise exception 'Confira o WhatsApp (com DDD).';
  end if;
  if exists (select 1 from public.estudio_alunos
              where estudio_id = p_estudio and situacao in ('ativo', 'experimental')
                and (lower(nome) = lower(v_nome) or whatsapp = v_zap)) then
    raise exception 'Este aluno já está no estúdio (mesmo nome ou WhatsApp).';
  end if;
  foreach v_turma in array coalesce(p_turmas, '{}') loop
    if not exists (select 1 from public.turmas t
                    where t.id = v_turma and t.estudio_id = p_estudio and t.ativa and t.tipo = 'turma' and t.avulsa is null
                      and (v_coord or t.professor_id = auth.uid())) then
      raise exception 'Escolha só turmas suas.';
    end if;
    if coalesce(public.vagas_livres_turma(v_turma), 0) <= 0 then
      raise exception 'A turma de % está cheia.', public.texto_turma(v_turma);
    end if;
  end loop;

  insert into public.estudio_alunos (estudio_id, nome, whatsapp, convite_codigo, convite_expira_em)
  values (p_estudio, v_nome, v_zap, v_cod, now() + interval '14 days')
  returning id into v_al;
  insert into public.turma_alunos (turma_id, estudio_aluno_id)
  select distinct t, v_al from unnest(coalesce(p_turmas, '{}')) t;

  select string_agg(public.texto_turma(t), ', ') into v_txt from (select distinct unnest(coalesce(p_turmas, '{}')) t) x;
  select split_part(btrim(nome_completo), ' ', 1) into v_quem from public.personais where id = auth.uid();
  perform public.notificar(m.personal_id, 'aluno_cadastrado_equipe', 'Aluno novo no estúdio',
            coalesce(v_quem, 'A equipe') || ' cadastrou ' || v_nome
              || coalesce(' na turma de ' || v_txt, '. Escolha as turmas') || '.',
            '/estudio/' || p_estudio || '?aba=alunos', p_chave => 'aluno-equipe:' || v_al || ':' || m.personal_id)
     from public.estudio_membros m
    where m.estudio_id = p_estudio and m.papel = 'coordenacao' and m.personal_id <> auth.uid();

  return jsonb_build_object('aluno', v_al, 'codigo', v_cod);
end
$$;

revoke all on function public.cadastrar_aluno_pela_equipe(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.cadastrar_aluno_pela_equipe(uuid, text, text, uuid[]) to authenticated;

commit;
