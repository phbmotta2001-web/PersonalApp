-- 56 · Link de cadastro de alunos do estúdio (decisão 95).
--
-- Além da lista de nomes e WhatsApp, a coordenação gera um link único do estúdio. Quem abre
-- o link cria a conta de aluno (ou entra) e passa a ser aluno do estúdio. Se a coordenação já
-- tinha cadastrado a pessoa pela lista (mesmo WhatsApp, ainda sem app), liga a esse cadastro.
-- A coordenação é avisada para escolher as turmas. "Gerar outro link" invalida o anterior.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

alter table public.estudios add column if not exists link_alunos_codigo text unique;

-- Devolve o código do link (cria na primeira vez; p_novo = true troca por outro).
create or replace function public.link_alunos_estudio(p_estudio uuid, p_novo boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text;
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação gera o link de alunos.';
  end if;
  select link_alunos_codigo into v from public.estudios where id = p_estudio for update;
  if v is null or p_novo then
    v := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.estudios set link_alunos_codigo = v where id = p_estudio;
  end if;
  return v;
end
$$;

create or replace function public.ver_link_alunos_estudio(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('estudio', e.nome, 'situacao', 'valido')
       from public.estudios e where e.link_alunos_codigo = p_codigo),
    jsonb_build_object('situacao', 'inexistente'));
$$;

-- O aluno logado entra no estúdio pelo link. Devolve o id do estúdio.
create or replace function public.entrar_pelo_link_alunos(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e   public.estudios;
  u   public.alunos;
  v_id uuid;
begin
  select * into u from public.alunos where id = auth.uid();
  if not found then
    raise exception 'Entre com uma conta de aluno para entrar no estúdio.';
  end if;
  select * into e from public.estudios where link_alunos_codigo = p_codigo;
  if not found or p_codigo is null then
    raise exception 'Este link não vale mais. Peça um novo ao estúdio.';
  end if;
  -- Já é aluno deste estúdio: nada a fazer.
  if exists (select 1 from public.estudio_alunos
              where estudio_id = e.id and aluno_id = u.id and situacao in ('ativo', 'experimental')) then
    return e.id;
  end if;
  -- Cadastrado pela lista com o mesmo WhatsApp e ainda sem app: liga a esse cadastro.
  if u.whatsapp is not null then
    select id into v_id from public.estudio_alunos
     where estudio_id = e.id and aluno_id is null and whatsapp = u.whatsapp and situacao in ('ativo', 'experimental')
     order by criado_em limit 1
     for update;
  end if;
  if v_id is not null then
    update public.estudio_alunos
       set aluno_id = u.id, situacao = 'ativo', convite_codigo = null, convite_expira_em = null
     where id = v_id;
  else
    insert into public.estudio_alunos (estudio_id, nome, whatsapp, aluno_id)
    values (e.id, left(btrim(u.nome_completo), 80), u.whatsapp, u.id)
    returning id into v_id;
  end if;
  perform public.notificar(m.personal_id, 'aluno_estudio_link',
            'Aluno novo no estúdio',
            btrim(u.nome_completo) || ' entrou pelo link de alunos. Escolha as turmas.',
            '/estudio/' || e.id || '?aba=alunos')
     from public.estudio_membros m
    where m.estudio_id = e.id and m.papel = 'coordenacao';
  return e.id;
end
$$;

revoke all on function public.link_alunos_estudio(uuid, boolean) from public, anon;
revoke all on function public.ver_link_alunos_estudio(text)      from public;
revoke all on function public.entrar_pelo_link_alunos(text)      from public, anon;
grant execute on function public.link_alunos_estudio(uuid, boolean) to authenticated;
grant execute on function public.ver_link_alunos_estudio(text)      to anon, authenticated;
grant execute on function public.entrar_pelo_link_alunos(text)      to authenticated;

commit;
