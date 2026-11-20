-- Tests de la migration 0012 (équipe au complet avant la suite). Rien ne reste en base : tout
-- tourne dans une transaction annulée. Lancer depuis un poste qui a l'accès SSH :
--   (echo "begin;"; cat supabase/tests/0012_equipe_au_complet.sql; echo "rollback;") \
--     | ssh -J ubuntu@54.38.69.101 turing@192.168.200.10 'docker exec -i coaut-db psql -U postgres -q -A -F "|"'
-- Dernière table affichée : chaque test, le résultat attendu et le résultat obtenu.
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000012a1','lanceur@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000012a2','coauteur1@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000012a3','coauteur2@test.invalid','authenticated','authenticated');
insert into authors (id, nickname, user_id, kind) values
 ('10000000-0000-0000-0000-0000000012a1','zzlanceur','00000000-0000-0000-0000-0000000012a1','adult'),
 ('10000000-0000-0000-0000-0000000012a2','zzcoauteur1','00000000-0000-0000-0000-0000000012a2','adult'),
 ('10000000-0000-0000-0000-0000000012a3','zzcoauteur2','00000000-0000-0000-0000-0000000012a3','adult');
-- b1 : nouveau livre à 3, lanceur seul. b2 : livre repris (max_players null), lanceur seul, 3 tours.
insert into books (id, title, status, launcher_id, max_players) values
 ('30000000-0000-0000-0000-0000000012b1','Equipe test','launched','10000000-0000-0000-0000-0000000012a1',3),
 ('30000000-0000-0000-0000-0000000012b2','Repris test','launched','10000000-0000-0000-0000-0000000012a1',null);
insert into book_players (book_id, author_id, position) values
 ('30000000-0000-0000-0000-0000000012b1','10000000-0000-0000-0000-0000000012a1',0),
 ('30000000-0000-0000-0000-0000000012b2','10000000-0000-0000-0000-0000000012a1',0);
insert into turns (book_id, number, author_id, content, is_ended, is_validated) values
 ('30000000-0000-0000-0000-0000000012b2',1,'10000000-0000-0000-0000-0000000012a1','un',true,true),
 ('30000000-0000-0000-0000-0000000012b2',2,'10000000-0000-0000-0000-0000000012a1','deux',true,true),
 ('30000000-0000-0000-0000-0000000012b2',3,'10000000-0000-0000-0000-0000000012a1','trois',true,true);

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

\set la '00000000-0000-0000-0000-0000000012a1'
\set c1 '00000000-0000-0000-0000-0000000012a2'

select pg_temp.vrai('b1 vide : attend son équipe ?', 'false', public.book_waiting_for_team('30000000-0000-0000-0000-0000000012b1')::text);
select pg_temp.essai(:'la', 'lanceur seul écrit le tour 1', 'permis, lignes : 1',
  $q$insert into turns (book_id, number, author_id, content, is_ended, is_validated) values ('30000000-0000-0000-0000-0000000012b1',1,'10000000-0000-0000-0000-0000000012a1','tour un',false,false)$q$);
-- Le tour 1 est réellement écrit (hors essai) pour la suite des tests.
insert into turns (book_id, number, author_id, content, is_ended, is_validated) values
 ('30000000-0000-0000-0000-0000000012b1',1,'10000000-0000-0000-0000-0000000012a1','tour un',false,false);
select pg_temp.essai(:'la', 'lanceur termine son tour 1', 'permis, lignes : 1',
  $q$update turns set is_ended = true, is_validated = true where book_id = '30000000-0000-0000-0000-0000000012b1' and number = 1$q$);
update turns set is_ended = true, is_validated = true where book_id = '30000000-0000-0000-0000-0000000012b1' and number = 1;
select pg_temp.vrai('b1 après tour 1, 1/3 : attend ?', 'true', public.book_waiting_for_team('30000000-0000-0000-0000-0000000012b1')::text);
select pg_temp.essai(:'la', 'lanceur seul écrit le tour 2', 'refusé',
  $q$insert into turns (book_id, number, author_id, content, is_ended, is_validated) values ('30000000-0000-0000-0000-0000000012b1',2,'10000000-0000-0000-0000-0000000012a1','tour deux',false,false)$q$);
select pg_temp.essai(:'la', 'lanceur corrige son tour 1', 'permis, lignes : 1',
  $q$update turns set content = 'tour un bis' where book_id = '30000000-0000-0000-0000-0000000012b1' and number = 1$q$);
insert into book_players (book_id, author_id, position) values
 ('30000000-0000-0000-0000-0000000012b1','10000000-0000-0000-0000-0000000012a2',1);
select pg_temp.vrai('2/3 : attend ?', 'true', public.book_waiting_for_team('30000000-0000-0000-0000-0000000012b1')::text);
select pg_temp.essai(:'c1', 'co-auteur 1 écrit le tour 2 à 2/3', 'refusé',
  $q$insert into turns (book_id, number, author_id, content, is_ended, is_validated) values ('30000000-0000-0000-0000-0000000012b1',2,'10000000-0000-0000-0000-0000000012a2','tour deux',false,false)$q$);
select pg_temp.vrai('admin : à qui le tour à 2/3', '(null)', public.admin_current_writer('30000000-0000-0000-0000-0000000012b1')::text);
insert into book_players (book_id, author_id, position) values
 ('30000000-0000-0000-0000-0000000012b1','10000000-0000-0000-0000-0000000012a3',2);
select pg_temp.vrai('3/3 : attend ?', 'false', public.book_waiting_for_team('30000000-0000-0000-0000-0000000012b1')::text);
select pg_temp.vrai('admin : à qui le tour à 3/3', 'zzcoauteur1',
  (select nickname from authors where id = public.admin_current_writer('30000000-0000-0000-0000-0000000012b1')));
select pg_temp.essai(:'c1', 'co-auteur 1 écrit le tour 2 à 3/3', 'permis, lignes : 1',
  $q$insert into turns (book_id, number, author_id, content, is_ended, is_validated) values ('30000000-0000-0000-0000-0000000012b1',2,'10000000-0000-0000-0000-0000000012a2','tour deux',false,false)$q$);
select pg_temp.vrai('livre repris, seul, 3 tours : attend ?', 'false', public.book_waiting_for_team('30000000-0000-0000-0000-0000000012b2')::text);
select pg_temp.essai(:'la', 'livre repris : tour 4 du lanceur', 'permis, lignes : 1',
  $q$insert into turns (book_id, number, author_id, content, is_ended, is_validated) values ('30000000-0000-0000-0000-0000000012b2',4,'10000000-0000-0000-0000-0000000012a1','quatre',false,false)$q$);

select test, attendu, got from res order by n;
