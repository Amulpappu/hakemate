\set ON_ERROR_STOP 1
insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','lohithgamer12@gmail.com','{"provider":"google"}','{"full_name":"Lohith K"}'),
 ('22222222-2222-2222-2222-222222222222','out@x.com','{"provider":"google"}','{"full_name":"Outsider Person"}');
update profiles set college='RTC', year_of_study='1st year', city='Coimbatore', state='Tamil Nadu', interests=array['AI','Security'], availability=array['weekends'] where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
insert into profile_skills select '11111111-1111-1111-1111-111111111111', id from skills where name in ('Web Security','Node.js');
insert into profile_skills select '22222222-2222-2222-2222-222222222222', id from skills where name in ('Excel');
update app_users set onboarded=true;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo -- event matching (online event)
select handle, score, s_mode, reasons[1:3], is_sample from match_candidates(null, 4, 'international-hackathon-5');
\echo -- create team, capped at event max 4
select create_team('Hakemate','international-hackathon-5','x',array['AI/ML'],9) as tid \gset
select max_size from teams where id = :'tid';
insert into team_messages (team_id, body) values (:'tid','Hello team');
insert into team_tasks (team_id, title, assignee_id) values (:'tid','Make PPT','11111111-1111-1111-1111-111111111111');
update team_tasks set status='done' where team_id=:'tid';
select title,status from team_tasks;
\echo -- sample members taken for this event are excluded
select count(*) as excluded_karthi from match_candidates(null,100,'international-hackathon-5') where handle in ('s_karthi','s_rahul');
select rate_match((select id from profiles where handle='s_arjun'), true);
select rate_match((select id from profiles where handle='s_arjun'), false);
insert into feedback (kind, rating, comment) values ('general', 4, 'Matching is fast');
select admin_feedback()->>'match_total' mt, admin_feedback()->>'match_helpful' mh, admin_feedback()->>'general_avg' ga;
\echo -- outsider cannot see chat or tasks or post
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select count(*) as outsider_msgs from team_messages;
select count(*) as outsider_tasks from team_tasks;
\set ON_ERROR_STOP 0
insert into team_messages (team_id, body) values (:'tid','spam');
update team_tasks set team_id = gen_random_uuid();
select admin_feedback();
select count(*) as outsider_sees_feedback from feedback;
reset role;
\echo -- anon blocked
set role anon;
select match_candidates();
