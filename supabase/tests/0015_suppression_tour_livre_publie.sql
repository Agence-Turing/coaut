-- Tests de la migration 0015 (suppression d'un tour d'un livre publié sans recalage de l'équipe).
-- Rien ne reste en base : lancer dans une transaction annulée, comme les tests 0013 :
--   (echo "begin;"; cat supabase/tests/0015_suppression_tour_livre_publie.sql; echo "rollback;") \
--     | ssh -J ubuntu@54.38.69.101 turing@192.168.200.10 'docker exec -i coaut-db psql -U postgres -q -A -F "|"'
insert into authors (id, nickname, kind) values
 ('10000000-0000-0000-0000-0000000015a1','zzlanceur15','adult'),
 ('10000000-0000-0000-0000-0000000015a2','zzcoauteur15','adult'),
 ('10000000-0000-0000-0000-0000000015a3','zztroisieme15','adult');
insert into books (id, title, status, launcher_id, max_players) values
 ('30000000-0000-0000-0000-0000000015b1','Publie test 15','published','10000000-0000-0000-0000-0000000015a1',3);
insert into book_players (book_id, author_id, position) values
 ('30000000-0000-0000-0000-0000000015b1','10000000-0000-0000-0000-0000000015a1',0),
 ('30000000-0000-0000-0000-0000000015b1','10000000-0000-0000-0000-0000000015a2',1),
 ('30000000-0000-0000-0000-0000000015b1','10000000-0000-0000-0000-0000000015a3',2);
insert into turns (id, book_id, number, author_id, content, is_ended, is_validated) values
 ('40000000-0000-0000-0000-0000000015c1','30000000-0000-0000-0000-0000000015b1',1,'10000000-0000-0000-0000-0000000015a1','un',true,true),
 ('40000000-0000-0000-0000-0000000015c2','30000000-0000-0000-0000-0000000015b1',2,'10000000-0000-0000-0000-0000000015a2','deux',true,true),
 ('40000000-0000-0000-0000-0000000015c3','30000000-0000-0000-0000-0000000015b1',3,'10000000-0000-0000-0000-0000000015a3','trois',true,true),
 ('40000000-0000-0000-0000-0000000015c4','30000000-0000-0000-0000-0000000015b1',4,'10000000-0000-0000-0000-0000000015a1','quatre',true,true);
select public.admin_delete_turn('40000000-0000-0000-0000-0000000015c2');
select 'positions inchangées' as test, '0,1,2' as attendu,
       string_agg(position::text, ',' order by author_id) as obtenu
from book_players where book_id = '30000000-0000-0000-0000-0000000015b1'
union all
select 'tours renumérotés', '1,2,3', string_agg(number::text, ',' order by number)
from turns where book_id = '30000000-0000-0000-0000-0000000015b1';
