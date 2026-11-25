-- Tests de la migration 0017 (changer le lanceur, places et annulation par le lanceur, début du
-- tour en cours). Rien ne reste en base : tout tourne dans une transaction annulée. Lancer
-- depuis un poste qui a l'accès SSH :
--   (echo "begin;"; cat supabase/tests/0017_lanceur_places_tours_en_retard.sql; echo "rollback;") \
--     | ssh -J ubuntu@54.38.69.101 turing@192.168.200.10 'docker exec -i coaut-db psql -U postgres -q -A -F "|"'
-- Dernière table affichée : chaque test, le résultat attendu et le résultat obtenu.
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000017a1','lanceur17@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000017a2','coauteur17@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000017a3','autre17@test.invalid','authenticated','authenticated');
insert into authors (id, nickname, user_id, kind) values
 ('10000000-0000-0000-0000-0000000017a1','zzlanceur17','00000000-0000-0000-0000-0000000017a1','adult'),
 ('10000000-0000-0000-0000-0000000017a2','zzcoauteur17','00000000-0000-0000-0000-0000000017a2','adult'),
 ('10000000-0000-0000-0000-0000000017a3','zzautre17','00000000-0000-0000-0000-0000000017a3','adult');
insert into classes (id, owner_id, name) values
 ('20000000-0000-0000-0000-0000000017c1','10000000-0000-0000-0000-0000000017a1','Classe test 17');
-- b1 : public à 3, lanceur + co-auteur, tour 1 écrit (attend son équipe), main donnée en 2020.
-- b2 : public, rien d'écrit, lanceur + co-auteur. b3 : public, brouillon du lanceur seulement.
-- b4 : public, brouillon d'un co-auteur (tour passé par l'admin). b5 : livre de classe.
insert into books (id, title, status, launcher_id, max_players, class_id, turn_started_at) values
 ('30000000-0000-0000-0000-0000000017b1','Livre 17 un','launched','10000000-0000-0000-0000-0000000017a1',3,null,'2020-01-01'),
 ('30000000-0000-0000-0000-0000000017b2','Livre 17 deux','launched','10000000-0000-0000-0000-0000000017a1',3,null,null),
 ('30000000-0000-0000-0000-0000000017b3','Livre 17 trois','launched','10000000-0000-0000-0000-0000000017a1',3,null,null),
 ('30000000-0000-0000-0000-0000000017b4','Livre 17 quatre','launched','10000000-0000-0000-0000-0000000017a1',3,null,null),
 ('30000000-0000-0000-0000-0000000017b5','Livre 17 classe','launched','10000000-0000-0000-0000-0000000017a1',2,'20000000-0000-0000-0000-0000000017c1',null);
insert into book_players (book_id, author_id, position) values
 ('30000000-0000-0000-0000-0000000017b1','10000000-0000-0000-0000-0000000017a1',0),
 ('30000000-0000-0000-0000-0000000017b1','10000000-0000-0000-0000-0000000017a2',1),
 ('30000000-0000-0000-0000-0000000017b2','10000000-0000-0000-0000-0000000017a1',0),
 ('30000000-0000-0000-0000-0000000017b2','10000000-0000-0000-0000-0000000017a2',1),
 ('30000000-0000-0000-0000-0000000017b3','10000000-0000-0000-0000-0000000017a1',0),
 ('30000000-0000-0000-0000-0000000017b4','10000000-0000-0000-0000-0000000017a1',0),
 ('30000000-0000-0000-0000-0000000017b4','10000000-0000-0000-0000-0000000017a2',1);
insert into turns (book_id, number, author_id, content, is_ended, is_validated, created_at) values
 ('30000000-0000-0000-0000-0000000017b1',1,'10000000-0000-0000-0000-0000000017a1','tour un',true,true,'2020-01-01'),
 ('30000000-0000-0000-0000-0000000017b3',1,'10000000-0000-0000-0000-0000000017a1','brouillon',false,false,now()),
 ('30000000-0000-0000-0000-0000000017b4',1,'10000000-0000-0000-0000-0000000017a2','brouillon',false,false,now());

create temp table res (n serial, test text, attendu text, got text);
grant all on res to authenticated, service_role;
grant all on sequence res_n_seq to authenticated, service_role;

-- Essai sans effet (annulé) : permis ou refusé.
create function pg_temp.essai(uid text, test text, attendu text, q text) returns void language plpgsql as $$
declare n int; msg text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', uid, true);
    if uid = 'service' then set local role service_role; else set local role authenticated; end if;
    execute q;
    get diagnostics n = row_count;
    raise exception 'FAIT:%', n;
  exception when others then
    msg := sqlerrm;
  end;
  reset role;
  insert into res (test, attendu, got) values (test, attendu,
    case when msg like 'FAIT:%' then replace(msg, 'FAIT:', 'permis, lignes : ') else 'refusé (' || left(msg, 60) || ')' end);
end $$;

-- Action gardée (comme l'app : rôle authenticated ou service_role).
create function pg_temp.faire(uid text, q text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid, true);
  if uid = 'service' then set local role service_role; else set local role authenticated; end if;
  execute q;
  reset role;
end $$;

create function pg_temp.vrai(test text, attendu text, v text) returns void language sql as $$
  insert into res (test, attendu, got) values (test, attendu, coalesce(v, '(null)'));
$$;

\set la '00000000-0000-0000-0000-0000000017a1'
\set c1 '00000000-0000-0000-0000-0000000017a2'

-- Nombre de places par le lanceur.
select pg_temp.essai(:'c1', 'co-auteur change les places', 'permis, lignes : 0',
  $q$update books set max_players = 2 where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.essai(:'la', 'lanceur : 1 place', 'refusé',
  $q$update books set max_players = 1 where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.essai(:'la', 'lanceur : 11 places', 'refusé',
  $q$update books set max_players = 11 where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.essai(:'la', 'lanceur : 5 places', 'permis, lignes : 1',
  $q$update books set max_players = 5 where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.essai(:'la', 'lanceur : livre de classe', 'refusé',
  $q$update books set max_players = 3 where id = '30000000-0000-0000-0000-0000000017b5'$q$);
select pg_temp.essai('service', 'admin : moins que l''équipe', 'refusé',
  $q$update books set max_players = 1 where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.essai(:'la', 'lanceur : changer le titre (trigger muet)', 'permis, lignes : 1',
  $q$update books set title = 'Livre 17 un bis' where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.vrai('b1 à 2/3 : attend ?', 'true', public.book_waiting_for_team('30000000-0000-0000-0000-0000000017b1')::text);
select pg_temp.faire(:'la', $q$update books set max_players = 2 where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.vrai('lanceur baisse à 2 = équipe : attend ?', 'false', public.book_waiting_for_team('30000000-0000-0000-0000-0000000017b1')::text);
select pg_temp.vrai('… à qui le tour', 'zzcoauteur17',
  (select nickname from authors where id = public.admin_current_writer('30000000-0000-0000-0000-0000000017b1')));
select pg_temp.vrai('… début du tour en cours = maintenant', 'true',
  (select (turn_started_at = now())::text from books where id = '30000000-0000-0000-0000-0000000017b1'));

-- Début du tour en cours : tour terminé par l'app, tour passé par l'admin.
update books set turn_started_at = '2020-01-01', created_at = '2020-01-01' where id = '30000000-0000-0000-0000-0000000017b1';
select pg_temp.vrai('vue : en attente depuis (2020)', '2020-01-01',
  (select waiting_since::date::text from admin_books where id = '30000000-0000-0000-0000-0000000017b1'));
select pg_temp.vrai('vue : tour attendu', '2',
  (select current_turn_number::text from admin_books where id = '30000000-0000-0000-0000-0000000017b1'));
select pg_temp.faire(:'c1', $q$insert into turns (book_id, number, author_id, content, is_ended, is_validated) values ('30000000-0000-0000-0000-0000000017b1',2,'10000000-0000-0000-0000-0000000017a2','tour deux',true,true)$q$);
select pg_temp.vrai('tour 2 terminé : début du tour = maintenant', 'true',
  (select (turn_started_at = now())::text from books where id = '30000000-0000-0000-0000-0000000017b1'));
update books set turn_started_at = '2020-01-01', created_at = '2020-01-01' where id = '30000000-0000-0000-0000-0000000017b1';
update turns set created_at = '2020-01-01' where book_id = '30000000-0000-0000-0000-0000000017b1';
select pg_temp.faire('service', $q$select public.admin_pass_turn('30000000-0000-0000-0000-0000000017b1')$q$);
select pg_temp.vrai('tour passé : début du tour = maintenant', 'true',
  (select (turn_started_at = now())::text from books where id = '30000000-0000-0000-0000-0000000017b1'));
update books set turn_started_at = '2020-01-01', created_at = '2020-01-01' where id = '30000000-0000-0000-0000-0000000017b1';
update turns set is_ended = false where book_id = '30000000-0000-0000-0000-0000000017b1' and number = 2;
update turns set is_ended = true where book_id = '30000000-0000-0000-0000-0000000017b1' and number = 2;
select pg_temp.vrai('psql (reprise) : date gardée', '2020-01-01',
  (select turn_started_at::date::text from books where id = '30000000-0000-0000-0000-0000000017b1'));

-- Changer le lanceur.
select pg_temp.essai(:'la', 'lanceur appelle admin_set_launcher', 'refusé',
  $q$select public.admin_set_launcher('30000000-0000-0000-0000-0000000017b1','10000000-0000-0000-0000-0000000017a2')$q$);
select pg_temp.essai(:'la', 'lanceur se donne un autre lanceur (update)', 'refusé',
  $q$update books set launcher_id = '10000000-0000-0000-0000-0000000017a2' where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.essai('service', 'admin : lanceur hors équipe', 'refusé',
  $q$select public.admin_set_launcher('30000000-0000-0000-0000-0000000017b1','10000000-0000-0000-0000-0000000017a3')$q$);
select pg_temp.essai('service', 'admin : livre de classe', 'refusé',
  $q$select public.admin_set_launcher('30000000-0000-0000-0000-0000000017b5','10000000-0000-0000-0000-0000000017a2')$q$);
select pg_temp.vrai('b1 avant : à qui le tour', 'zzcoauteur17',
  (select nickname from authors where id = public.admin_current_writer('30000000-0000-0000-0000-0000000017b1')));
select pg_temp.faire('service', $q$select public.admin_set_launcher('30000000-0000-0000-0000-0000000017b1','10000000-0000-0000-0000-0000000017a2')$q$);
select pg_temp.vrai('b1 : nouveau lanceur', 'zzcoauteur17',
  (select nickname from authors a join books b on b.launcher_id = a.id where b.id = '30000000-0000-0000-0000-0000000017b1'));
select pg_temp.vrai('b1 commencé : à qui le tour inchangé', 'zzcoauteur17',
  (select nickname from authors where id = public.admin_current_writer('30000000-0000-0000-0000-0000000017b1')));
select pg_temp.essai(:'c1', 'nouveau lanceur change les places', 'permis, lignes : 1',
  $q$update books set max_players = 4 where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.essai(:'la', 'ancien lanceur change les places', 'permis, lignes : 0',
  $q$update books set max_players = 4 where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.faire('service', $q$select public.admin_set_launcher('30000000-0000-0000-0000-0000000017b2','10000000-0000-0000-0000-0000000017a2')$q$);
select pg_temp.vrai('b2 vide : le nouveau lanceur écrit le tour 1', 'zzcoauteur17',
  (select nickname from authors where id = public.admin_current_writer('30000000-0000-0000-0000-0000000017b2')));

-- Annuler son livre.
select pg_temp.essai(:'la', 'lanceur annule un livre commencé', 'permis, lignes : 0',
  $q$delete from books where id = '30000000-0000-0000-0000-0000000017b1'$q$);
select pg_temp.essai(:'la', 'ancien lanceur annule b2', 'permis, lignes : 0',
  $q$delete from books where id = '30000000-0000-0000-0000-0000000017b2'$q$);
select pg_temp.essai(:'c1', 'nouveau lanceur annule b2 (rien d''écrit)', 'permis, lignes : 1',
  $q$delete from books where id = '30000000-0000-0000-0000-0000000017b2'$q$);
select pg_temp.essai(:'la', 'lanceur annule avec son seul brouillon', 'permis, lignes : 1',
  $q$delete from books where id = '30000000-0000-0000-0000-0000000017b3'$q$);
select pg_temp.essai(:'la', 'lanceur annule avec le brouillon d''un autre', 'permis, lignes : 0',
  $q$delete from books where id = '30000000-0000-0000-0000-0000000017b4'$q$);
select pg_temp.essai(:'la', 'prof annule son livre de classe vide', 'permis, lignes : 1',
  $q$delete from books where id = '30000000-0000-0000-0000-0000000017b5'$q$);
select pg_temp.faire(:'la', $q$delete from books where id = '30000000-0000-0000-0000-0000000017b3'$q$);
select pg_temp.vrai('b3 annulé : tours et équipe partis', '0',
  ((select count(*) from turns where book_id = '30000000-0000-0000-0000-0000000017b3')
   + (select count(*) from book_players where book_id = '30000000-0000-0000-0000-0000000017b3'))::text);

select test, attendu, got from res order by n;
