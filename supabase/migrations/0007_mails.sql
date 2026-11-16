-- Confirmation d'e-mail à l'inscription et mails automatiques. Rejouable sans risque.

-- 1. Fiche auteur créée dès l'inscription, avant la confirmation de l'adresse :
--    le pseudonyme choisi est réservé tout de suite (authors.nickname est unique).
--    Si le pseudonyme vient d'être pris, l'inscription échoue et rien n'est créé.
--    Les comptes repris de Notion (legacy_import) ont déjà leur fiche : on ne fait rien.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nick text := nullif(trim(new.raw_user_meta_data ->> 'nickname'), '');
begin
  if nick is null or new.raw_user_meta_data ? 'legacy_import' then
    return new;
  end if;
  if exists (select 1 from public.authors where user_id = new.id) then
    return new;
  end if;
  insert into public.authors (nickname, user_id) values (nick, new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Journal des mails envoyés par l'app (à toi d'écrire, relances, demandes, publication).
--    Sert à ne jamais envoyer deux fois le même mail, à piloter les relances et, plus tard,
--    à l'administration. Aucune adresse ici : le destinataire est un auteur, son e-mail reste
--    dans auth.users. Table réservée au serveur (clé service_role), invisible par l'API publique.
create table if not exists public.mail_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'your_turn', 'turn_reminder_1', 'turn_reminder_2',
    'join_request', 'join_accepted', 'join_rejected', 'book_published')),
  author_id uuid references public.authors (id) on delete set null,
  book_id uuid references public.books (id) on delete cascade,
  turn_number integer, -- tour concerné (à toi d'écrire et relances)
  dedupe_key text not null, -- un seul mail par (type, auteur, clé)
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (kind, author_id, dedupe_key)
);
create index if not exists mail_log_book_idx on public.mail_log (book_id, kind);

alter table public.mail_log enable row level security;
revoke all on public.mail_log from anon, authenticated;
grant all on public.mail_log to service_role;
