-- Tests de la migration 0013 (rejoindre seulement s'il reste une place). Rien ne reste en base :
-- tout tourne dans une transaction annulée. Lancer depuis un poste qui a l'accès SSH :
--   (echo "begin;"; cat supabase/tests/0013_rejoindre_places_libres.sql; echo "rollback;") \
--     | ssh -J ubuntu@54.38.69.101 turing@192.168.200.10 'docker exec -i coaut-db psql -U postgres -q -A -F "|"'
-- Dernière table affichée : chaque test, le résultat attendu et le résultat obtenu.
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000013a1','lanceur13@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000013a2','coauteur13@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000013a3','candidat13@test.invalid','authenticated','authenticated');
insert into authors (id, nickname, user_id, kind) values
 ('10000000-0000-0000-0000-0000000013a1','zzlanceur13','00000000-0000-0000-0000-0000000013a1','adult'),
 ('10000000-0000-0000-0000-0000000013a2','zzcoauteur13','00000000-0000-0000-0000-0000000013a2','adult'),
 ('10000000-0000-0000-0000-0000000013a3','zzcandidat13','00000000-0000-0000-0000-0000000013a3','adult');
-- b1 : nouveau livre à 2, lanceur seul (ouvert). b2 : livre « Commencé » repris, 2/2 (fermé).
-- b3 : livre « Lancé » repris (max_players null, ouvert). b4 : publié.
insert into books (id, title, status, launcher_id, max_players) values
 ('30000000-0000-0000-0000-0000000013b1','Ouvert test','launched','10000000-0000-0000-0000-0000000013a1',2),
 ('30000000-0000-0000-0000-0000000013b2','Commence test','launched','10000000-0000-0000-0000-0000000013a1',2),
 ('30000000-0000-0000-0000-0000000013b3','Lance test','launched','10000000-0000-0000-0000-0000000013a1',null),
 ('30000000-0000-0000-0000-0000000013b4','Publie test','published','10000000-0000-0000-0000-0000000013a1',null);
insert into book_players (book_id, author_id, position) values
 ('30000000-0000-0000-0000-0000000013b1','10000000-0000-0000-0000-0000000013a1',0),
 ('30000000-0000-0000-0000-0000000013b2','10000000-0000-0000-0000-0000000013a1',0),
 ('30000000-0000-0000-0000-0000000013b2','10000000-0000-0000-0000-0000000013a2',1),
 ('30000000-0000-0000-0000-0000000013b3','10000000-0000-0000-0000-0000000013a1',0);

create temp table res (n serial, test text, attendu text, got text);
grant all on res to authenticated;
grant all on sequence res_n_seq to authenticated;

create function pg_temp.essai(uid text, test text, attendu text, q text) returns void language plpgsql as $$
declare n int; msg text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', uid, true);
    set local role authenticated;
    execute q;
    get diagnostics n = row_count;
    raise exception 'FAIT:%', n;
  exception when others then
    msg := sqlerrm;
  end;
  reset role;
  insert into res (test, attendu, got) values (test, attendu,
    case when msg like 'FAIT:%' then replace(msg, 'FAIT:', 'permis, lignes : ') else 'refusé (' || left(msg, 50) || ')' end);
end $$;

create function pg_temp.vrai(test text, attendu text, v text) returns void language sql as $$
  insert into res (test, attendu, got) values (test, attendu, coalesce(v, '(null)'));
$$;

\set la '00000000-0000-0000-0000-0000000013a1'
\set ca '00000000-0000-0000-0000-0000000013a3'

select pg_temp.vrai('b1 1/2 : ouvert ?', 'true', public.book_open_to_join('30000000-0000-0000-0000-0000000013b1')::text);
select pg_temp.vrai('b2 Commencé 2/2 : ouvert ?', 'false', public.book_open_to_join('30000000-0000-0000-0000-0000000013b2')::text);
select pg_temp.vrai('b3 Lancé repris : ouvert ?', 'true', public.book_open_to_join('30000000-0000-0000-0000-0000000013b3')::text);
select pg_temp.vrai('b4 publié : ouvert ?', 'false', public.book_open_to_join('30000000-0000-0000-0000-0000000013b4')::text);
select pg_temp.essai(:'ca', 'demande sur b1 (place libre)', 'permis, lignes : 1',
  $q$insert into join_requests (book_id, author_id, message) values ('30000000-0000-0000-0000-0000000013b1','10000000-0000-0000-0000-0000000013a3','bonjour je veux venir')$q$);
select pg_temp.essai(:'ca', 'demande sur b2 (équipe au complet)', 'refusé',
  $q$insert into join_requests (book_id, author_id, message) values ('30000000-0000-0000-0000-0000000013b2','10000000-0000-0000-0000-0000000013a3','bonjour je veux venir')$q$);
select pg_temp.essai(:'ca', 'demande sur b3 (Lancé repris)', 'permis, lignes : 1',
  $q$insert into join_requests (book_id, author_id, message) values ('30000000-0000-0000-0000-0000000013b3','10000000-0000-0000-0000-0000000013a3','bonjour je veux venir')$q$);
select pg_temp.essai(:'ca', 'demande sur b4 (publié)', 'refusé',
  $q$insert into join_requests (book_id, author_id, message) values ('30000000-0000-0000-0000-0000000013b4','10000000-0000-0000-0000-0000000013a3','bonjour je veux venir')$q$);
select pg_temp.essai(:'la', 'lanceur ajoute un 2e sur b1 (1/2)', 'permis, lignes : 1',
  $q$insert into book_players (book_id, author_id, position) values ('30000000-0000-0000-0000-0000000013b1','10000000-0000-0000-0000-0000000013a3',1)$q$);
select pg_temp.essai(:'la', 'lanceur ajoute un 3e sur b2 (2/2)', 'refusé',
  $q$insert into book_players (book_id, author_id, position) values ('30000000-0000-0000-0000-0000000013b2','10000000-0000-0000-0000-0000000013a3',2)$q$);

select test, attendu, got from res order by n;
