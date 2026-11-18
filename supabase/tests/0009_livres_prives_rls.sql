-- Tests RLS de la migration 0009 (livres de classe). Rien ne reste en base : tout tourne dans une
-- transaction annulée. Lancer depuis un poste qui a l'accès SSH :
--   (echo begin; cat supabase/tests/0009_livres_prives_rls.sql; echo rollback) \
--     | ssh -J ubuntu@54.38.69.101 turing@192.168.200.10 'docker exec -i coaut-db psql -U postgres -q -A -F "|"'
-- Dernière table affichée : chaque test, le résultat attendu et le résultat obtenu.
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','prof1@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a2','prof2@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a3','adulte@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e1','e1@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e2','e2@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e3','e3@test.invalid','authenticated','authenticated');
insert into authors (id, nickname, user_id, kind) values
 ('10000000-0000-0000-0000-0000000000a1','zzprof1','00000000-0000-0000-0000-0000000000a1','adult'),
 ('10000000-0000-0000-0000-0000000000a2','zzprof2','00000000-0000-0000-0000-0000000000a2','adult'),
 ('10000000-0000-0000-0000-0000000000a3','zzadulte','00000000-0000-0000-0000-0000000000a3','adult'),
 ('10000000-0000-0000-0000-0000000000e1','André','00000000-0000-0000-0000-0000000000e1','student'),
 ('10000000-0000-0000-0000-0000000000e2','André','00000000-0000-0000-0000-0000000000e2','student'),
 ('10000000-0000-0000-0000-0000000000e3','Zoé','00000000-0000-0000-0000-0000000000e3','student');
insert into author_profiles (author_id, is_professional) values ('10000000-0000-0000-0000-0000000000a1', true), ('10000000-0000-0000-0000-0000000000a2', true);
insert into classes (id, owner_id, name) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-0000000000a1','CM1'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-0000000000a2','Atelier');
insert into class_students (class_id, author_id, first_name, code, code_key) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-0000000000e1','André','LOUTRE-1111','LOUTRE1111'),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-0000000000e3','Zoé','COMETE-2222','COMETE2222'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-0000000000e2','André','RENARD-3333','RENARD3333');
insert into books (id, title, status, launcher_id, class_id) values
 ('30000000-0000-0000-0000-000000000001','Livre CM1','launched','10000000-0000-0000-0000-0000000000a1','20000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','Livre Atelier','launched','10000000-0000-0000-0000-0000000000a2','20000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003','Livre CM1 publie','published','10000000-0000-0000-0000-0000000000a1','20000000-0000-0000-0000-000000000001');
insert into book_players (book_id, author_id, position) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-0000000000e1',0),
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-0000000000e3',1),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-0000000000e2',0);
insert into turns (book_id, number, author_id, content, is_ended, is_validated) values
 ('30000000-0000-0000-0000-000000000002',1,'10000000-0000-0000-0000-0000000000e2','secret atelier',true,true);

create temp table res (n serial, who text, test text, attendu text, got text);
grant all on res to authenticated, anon;
grant all on sequence res_n_seq to authenticated, anon;

create function pg_temp.claims(uid text) returns void language plpgsql as $$
begin
  if uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('request.jwt.claim.sub', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', uid, true);
  end if;
end $$;

-- Lecture : q renvoie un texte.
create function pg_temp.voir(who text, uid text, test text, attendu text, q text) returns void language plpgsql as $$
declare v text;
begin
  perform pg_temp.claims(uid);
  if uid is null then set local role anon; else set local role authenticated; end if;
  execute q into v;
  reset role;
  insert into res (who, test, attendu, got) values (who, test, attendu, coalesce(v, '(vide)'));
end $$;

-- Écriture : toujours annulée ; on note le nombre de lignes touchées ou le refus.
create function pg_temp.essai(who text, uid text, test text, attendu text, q text) returns void language plpgsql as $$
declare n int; msg text;
begin
  begin
    perform pg_temp.claims(uid);
    set local role authenticated;
    execute q;
    get diagnostics n = row_count;
    raise exception 'FAIT:%', n;
  exception when others then
    msg := sqlerrm;
  end;
  reset role;
  insert into res (who, test, attendu, got) values (who, test, attendu,
    case when msg like 'FAIT:%' then replace(msg, 'FAIT:', 'permis, lignes : ') else 'refusé (' || left(msg, 60) || ')' end);
end $$;

\set e1 '00000000-0000-0000-0000-0000000000e1'
\set p1 '00000000-0000-0000-0000-0000000000a1'
\set ad '00000000-0000-0000-0000-0000000000a3'

select pg_temp.voir('élève e1', :'e1', 'livres visibles', 'Livre CM1, Livre CM1 publie', $q$select string_agg(title, ', ' order by title) from books$q$);
select pg_temp.voir('élève e1', :'e1', 'tours visibles', '0', $q$select count(*)::text from turns$q$);
select pg_temp.voir('élève e1', :'e1', 'classes visibles', 'CM1', $q$select string_agg(name, ',') from classes$q$);
select pg_temp.voir('élève e1', :'e1', 'élèves visibles', 'André (lui)', $q$select string_agg(first_name, ',') from class_students$q$);
select pg_temp.voir('élève e1', :'e1', 'auteurs élèves visibles', 'André, Zoé', $q$select string_agg(nickname, ',' order by nickname) from authors where kind='student'$q$);
select pg_temp.voir('élève e1', :'e1', 'is_student / ma classe', 't / 2000..01', $q$select is_student()::text || ' / ' || my_student_class()::text$q$);
select pg_temp.essai('élève e1', :'e1', 'écrire dans son livre', 'permis 1', $q$insert into turns (book_id, number, author_id, content, is_ended) values ('30000000-0000-0000-0000-000000000001',1,'10000000-0000-0000-0000-0000000000e1','mon tour',true)$q$);
select pg_temp.essai('élève e1', :'e1', 'écrire dans le livre d''une autre classe', 'refusé', $q$insert into turns (book_id, number, author_id, content, is_ended) values ('30000000-0000-0000-0000-000000000002',2,'10000000-0000-0000-0000-0000000000e1','intrus',true)$q$);
select pg_temp.essai('élève e1', :'e1', 'écrire dans un livre public', 'refusé', $q$insert into turns (book_id, number, author_id, content, is_ended) select id, 999, '10000000-0000-0000-0000-0000000000e1','intrus',true from (select id from books where class_id is null and status='launched' limit 1) x$q$);
select pg_temp.essai('élève e1', :'e1', 'écrire dans un livre public (id connu)', 'refusé', format($q$insert into turns (book_id, number, author_id, content, is_ended) values ('%s', 999, '10000000-0000-0000-0000-0000000000e1','intrus',true)$q$, (select id from books where class_id is null and status='launched' limit 1)));
select pg_temp.essai('élève e1', :'e1', 'écrire dans le livre publié de sa classe', 'refusé', $q$insert into turns (book_id, number, author_id, content, is_ended) values ('30000000-0000-0000-0000-000000000003',1,'10000000-0000-0000-0000-0000000000e1','apres',true)$q$);
select pg_temp.essai('élève e1', :'e1', 'se passer en adulte', 'refusé', $q$update authors set kind='adult' where user_id = auth.uid()$q$);
select pg_temp.essai('élève e1', :'e1', 'changer son prénom', 'permis 0', $q$update authors set nickname='Le prof' where user_id = auth.uid()$q$);
select pg_temp.essai('élève e1', :'e1', 'lancer un livre', 'refusé', $q$insert into books (title, launcher_id) values ('x','10000000-0000-0000-0000-0000000000e1')$q$);
select pg_temp.essai('élève e1', :'e1', 'se déclarer pro et créer une classe', 'refusé', $q$insert into author_profiles (author_id, is_professional) values ('10000000-0000-0000-0000-0000000000e1', true); insert into classes (owner_id, name) values ('10000000-0000-0000-0000-0000000000e1','pirate')$q$);
select pg_temp.essai('élève e1', :'e1', 'demander à rejoindre un livre public', 'refusé', format($q$insert into join_requests (book_id, author_id, message) values ('%s','10000000-0000-0000-0000-0000000000e1','hello hello')$q$, (select id from books where class_id is null and status='launched' limit 1)));
select pg_temp.essai('élève e1', :'e1', 'lire les tentatives de connexion', 'refusé', $q$select * from class_login_attempts$q$);

select pg_temp.voir('prof1', :'p1', 'livres de classe visibles', 'Livre CM1, Livre CM1 publie', $q$select string_agg(title, ', ' order by title) from books where class_id is not null$q$);
select pg_temp.voir('prof1', :'p1', 'élèves visibles (avec code)', 'André:LOUTRE-1111, Zoé:COMETE-2222', $q$select string_agg(first_name||':'||code, ', ' order by first_name) from class_students$q$);
select pg_temp.voir('prof1', :'p1', 'tours de l''atelier', '0', $q$select count(*)::text from turns where book_id='30000000-0000-0000-0000-000000000002'$q$);
select pg_temp.essai('prof1', :'p1', 'lancer un livre pour la classe d''un autre', 'refusé', $q$insert into books (title, launcher_id, class_id) values ('vol','10000000-0000-0000-0000-0000000000a1','20000000-0000-0000-0000-000000000002')$q$);
select pg_temp.essai('prof1', :'p1', 'lancer un livre pour sa classe', 'permis 1', $q$insert into books (title, launcher_id, class_id) values ('ok','10000000-0000-0000-0000-0000000000a1','20000000-0000-0000-0000-000000000001')$q$);
select pg_temp.essai('prof1', :'p1', 'écrire un code d''élève', 'refusé', $q$update class_students set code_key='RENARD3333'$q$);
select pg_temp.essai('prof1', :'p1', 'ajouter l''élève d''une autre classe', 'refusé', $q$insert into book_players (book_id, author_id, position) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-0000000000e2',5)$q$);
select pg_temp.essai('prof1', :'p1', 'passer le tour d''un élève', 'permis 1', $q$insert into turns (book_id, number, author_id, content, is_ended, is_validated) values ('30000000-0000-0000-0000-000000000001',1,'10000000-0000-0000-0000-0000000000e1',null,true,true)$q$);
select pg_temp.essai('prof1', :'p1', 'écrire à la place d''un élève', 'refusé', $q$insert into turns (book_id, number, author_id, content, is_ended, is_validated) values ('30000000-0000-0000-0000-000000000001',1,'10000000-0000-0000-0000-0000000000e1','faux',true,true)$q$);
select pg_temp.essai('prof1', :'p1', 'réordonner son équipe', 'permis 1', $q$update book_players set position = 7 where book_id='30000000-0000-0000-0000-000000000001' and author_id='10000000-0000-0000-0000-0000000000e1'$q$);
select pg_temp.essai('prof1', :'p1', 'réordonner l''équipe d''un autre', 'permis 0', $q$update book_players set position = 7 where book_id='30000000-0000-0000-0000-000000000002'$q$);

select pg_temp.voir('adulte', :'ad', 'livres de classe visibles', 'Livre CM1 publie', $q$select string_agg(title, ', ') from books where class_id is not null$q$);
select pg_temp.voir('adulte', :'ad', 'tours de l''atelier', '0', $q$select count(*)::text from turns where book_id='30000000-0000-0000-0000-000000000002'$q$);
select pg_temp.voir('adulte', :'ad', 'équipe de l''atelier', '0', $q$select count(*)::text from book_players where book_id='30000000-0000-0000-0000-000000000002'$q$);
select pg_temp.voir('adulte', :'ad', 'auteurs élèves visibles', '(vide)', $q$select string_agg(nickname, ',') from authors where kind='student'$q$);
select pg_temp.voir('adulte', :'ad', 'classes / élèves visibles', '0 / 0', $q$select (select count(*) from classes)::text || ' / ' || (select count(*) from class_students)::text$q$);
select pg_temp.essai('adulte', :'ad', 'créer une classe sans être pro', 'refusé', $q$insert into classes (owner_id, name) values ('10000000-0000-0000-0000-0000000000a3','pas pro')$q$);
select pg_temp.essai('adulte', :'ad', 'écrire dans un livre de classe', 'refusé', $q$insert into turns (book_id, number, author_id, content, is_ended) values ('30000000-0000-0000-0000-000000000001',1,'10000000-0000-0000-0000-0000000000a3','intrus',true)$q$);
select pg_temp.essai('adulte', :'ad', 'demander à rejoindre un livre de classe', 'refusé', $q$insert into join_requests (book_id, author_id, message) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-0000000000a3','hello hello')$q$);
select pg_temp.essai('adulte', :'ad', 'écrire dans un livre public', 'permis 1', format($q$insert into turns (book_id, number, author_id, content, is_ended) values ('%s', 999, '10000000-0000-0000-0000-0000000000a3','test',false)$q$, (select id from books where class_id is null and status='launched' limit 1)));
select pg_temp.essai('adulte', :'ad', 'se déclarer pro', 'permis 1', $q$insert into author_profiles (author_id, is_professional, organization) values ('10000000-0000-0000-0000-0000000000a3', true, 'Ecole')$q$);

select pg_temp.voir('anonyme', null, 'livres de classe visibles', 'Livre CM1 publie', $q$select string_agg(title, ', ') from books where class_id is not null$q$);
select pg_temp.voir('anonyme', null, 'livres visibles (total)', '123 + 1', $q$select count(*)::text from books$q$);
select pg_temp.voir('anonyme', null, 'tours visibles (total)', 'tous sauf atelier', $q$select count(*)::text from turns$q$);

select who, test, attendu, got from res order by n;
