-- 59 · Enviar formulário para alunos escolhidos (decisão 97, ajuste).
--
-- Em vez de "uma turma", a coordenação escolhe os alunos pelo nome (lista em ordem
-- alfabética). Sem escolha: todos os alunos ativos.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

drop function if exists public.enviar_formulario_estudio(uuid, uuid);
create function public.enviar_formulario_estudio(p_formulario uuid, p_alunos uuid[] default null)
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
  if p_alunos is not null and cardinality(p_alunos) = 0 then
    raise exception 'Escolha pelo menos um aluno.';
  end if;
  for r in
    insert into public.estudio_respostas (estudio_id, formulario_id, estudio_aluno_id, tipo, titulo, perguntas, enviado_por)
    select f.estudio_id, f.id, al.id, f.tipo, f.nome, f.perguntas, auth.uid()
      from public.estudio_alunos al
     where al.estudio_id = f.estudio_id and al.situacao = 'ativo'
       and (p_alunos is null or al.id = any (p_alunos))
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

revoke all on function public.enviar_formulario_estudio(uuid, uuid[]) from public, anon;
grant execute on function public.enviar_formulario_estudio(uuid, uuid[]) to authenticated;

commit;
