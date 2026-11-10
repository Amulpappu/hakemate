\set ON_ERROR_STOP 1
-- 4 Google users + 1 email user (must be rejected)
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-000000000001','lohithgamer12@gmail.com','{"full_name":"Lohith K"}','{"provider":"google"}'),
 ('00000000-0000-0000-0000-000000000002','priya@x.com','{"full_name":"Priya R"}','{"provider":"google"}'),
 ('00000000-0000-0000-0000-000000000003','arun@x.com','{"full_name":"Arun M"}','{"provider":"google"}'),
 ('00000000-0000-0000-0000-000000000004','sana@x.com','{"full_name":"Sana T"}','{"provider":"google"}');

do $$ begin
  insert into auth.users (email, raw_app_meta_data) values ('e@x.com','{"provider":"email"}');
  raise exception 'email signup should have failed';
exception when others then
  if sqlerrm like '%Google sign-in only%' then raise notice 'OK: email sign-up blocked'; else raise; end if;
end $$;

select email, role from public.app_users order by email;
select handle, display_name from public.profiles order by handle;

-- act as each user to fill profiles
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.profiles set college='Rathinam Technical Campus', year_of_study='1st year', city='Coimbatore', state='Tamil Nadu',
  bio='Cyber security and backend builder, love Supabase', interests='{AI,Security,Web}', availability='{weekends,weekday_evenings}',
  experience_level='some', github_url='https://github.com/Amulpappu' where id = auth.uid();
insert into public.profile_skills (profile_id, skill_id) select auth.uid(), id from public.skills where name in ('Ethical Hacking','Node.js','Supabase');
select public.complete_onboarding();
select public.finish_tour();

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
update public.profiles set college='PSG Tech', year_of_study='3rd year', city='Coimbatore', state='Tamil Nadu',
  bio='ML engineer who loves AI for good', interests='{AI,Health}', availability='{weekends}', experience_level='veteran' where id = auth.uid();
insert into public.profile_skills (profile_id, skill_id) select auth.uid(), id from public.skills where name in ('Machine Learning','Python','UI/UX Design');
select public.complete_onboarding();

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
update public.profiles set college='Anna Univ', year_of_study='2nd year', city='Chennai', state='Tamil Nadu',
  bio='Frontend dev', interests='{Web}', availability='{weekday_evenings}', experience_level='first_timer', event_mode='online' where id = auth.uid();
insert into public.profile_skills (profile_id, skill_id) select auth.uid(), id from public.skills where name in ('React','JavaScript');
select public.complete_onboarding();

-- user 4 never onboards -> must not appear in matches

-- engine as Lohith
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select handle, score, s_skill, s_meaning, s_avail, s_mode, s_exp, reasons from public.match_candidates(null, 10);

-- team flow
select public.create_team('Hakemate','international-hackathon-5','AI team finder', '{AI/ML,Design,Frontend}', 4) as team_id \gset
select category, members, needed from public.team_gap(:'team_id') where needed or members > 0;
select public.send_team_request(:'team_id', '00000000-0000-0000-0000-000000000002', 'Join us!') as req \gset

-- contacts locked before joining
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select count(*) as lohith_contacts_visible_before from public.profile_contacts where profile_id = '00000000-0000-0000-0000-000000000001';
select public.respond_team_request(:'req', true);
select count(*) as lohith_contacts_visible_after from public.profile_contacts where profile_id = '00000000-0000-0000-0000-000000000001';

-- community
insert into public.posts (author_id, kind, body, hub_slug) values (auth.uid(), 'showcase', 'Built a model!', 'ai-ml') returning id as post \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.post_kudos (post_id, user_id) values (:'post', auth.uid());
insert into public.post_comments (post_id, author_id, body) values (:'post', auth.uid(), 'Great work');
insert into public.follows (follower_id, followee_id) values (auth.uid(), '00000000-0000-0000-0000-000000000002');
insert into public.endorsements (endorser_id, profile_id, skill_id)
  select auth.uid(), '00000000-0000-0000-0000-000000000002', id from public.skills where name = 'Machine Learning';
insert into public.hub_members (hub_slug, user_id) values ('ai-ml', auth.uid()),('cyber', auth.uid()),('web-dev', auth.uid());
select kudos_count, comment_count from public.posts where id = :'post';

-- security checks
do $$ begin
  update public.profiles set xp = 99999 where id = auth.uid();
  raise exception 'xp update should be blocked';
exception when insufficient_privilege then raise notice 'OK: cannot edit own XP';
end $$;
do $$ begin
  perform public.award_xp(auth.uid(), 1000, 'cheat');
  raise exception 'award_xp should not be callable';
exception when insufficient_privilege then raise notice 'OK: cannot call award_xp';
end $$;
do $$ declare n int; begin
  update public.profiles set bio = 'hacked' where id = '00000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK: cannot edit other profile'; else raise exception 'edited other profile'; end if;
end $$;
select count(*) as app_users_rows_visible_to_admin from public.app_users;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select count(*) as app_users_rows_visible_to_member from public.app_users;
do $$ begin
  perform public.admin_list_users(null);
  raise exception 'member should not list users';
exception when others then if sqlerrm = 'Admins only' then raise notice 'OK: admin list blocked'; else raise; end if;
end $$;
select count(*) as priya_contacts_visible_to_stranger from public.profile_contacts where profile_id = '00000000-0000-0000-0000-000000000002';

-- admin
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.admin_stats();
select public.admin_update_user('00000000-0000-0000-0000-000000000003', 'member', 'suspended');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  insert into public.posts (author_id, body) values (auth.uid(), 'spam');
  raise exception 'suspended user posted';
exception when insufficient_privilege then raise notice 'OK: suspended user cannot post';
end $$;

-- badges + xp + leaderboard
reset role;
select p.handle, p.xp, p.level, array_agg(ub.badge_code order by ub.badge_code) badges
from public.profiles p left join public.user_badges ub on ub.user_id = p.id group by p.id order by p.xp desc;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select handle, xp_gained from public.leaderboard(7, 5);
select count(*) as my_notifications from public.notifications;
select count(*) as heatmap_days from public.activity_heatmap(auth.uid());
