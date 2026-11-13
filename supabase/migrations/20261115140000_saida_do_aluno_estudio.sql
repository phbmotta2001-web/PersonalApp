-- 47 · Data em que o aluno saiu do estúdio (decisão 84), para o gráfico de crescimento do
-- Financeiro (alunos que entraram e saíram em cada mês).

begin;

alter table public.estudio_alunos add column encerrado_em timestamptz;

-- Quem já tinha saído antes desta migração fica com a data de hoje (não sabemos a verdadeira).
update public.estudio_alunos set encerrado_em = now() where situacao = 'encerrado';

create or replace function public.estudio_aluno_data_de_saida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.situacao = 'encerrado' and old.situacao is distinct from 'encerrado' then
    new.encerrado_em := now();
  elsif new.situacao = 'ativo' then
    new.encerrado_em := null;
  end if;
  return new;
end
$$;

create trigger estudio_alunos_data_de_saida
  before update of situacao on public.estudio_alunos
  for each row execute function public.estudio_aluno_data_de_saida();

revoke all on function public.estudio_aluno_data_de_saida() from public, anon, authenticated;

commit;
