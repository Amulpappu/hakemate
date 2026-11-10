-- =====================================================================
-- Hakemate 3.0 — SAMPLE student profiles for testing and the demo
-- The problem statement asks to "demonstrate the feature using sample
-- student profiles". These are made-up people: every one is marked
-- is_sample = true and shows a "Sample" tag in the app. They cannot sign in.
-- Remove them all with: supabase/sample/remove_sample_profiles.sql
-- =====================================================================
do $$
declare
  r record;
  v_id uuid;
  v_owner uuid;
  v_team uuid;
begin
  for r in select * from (values
    -- handle, name, year, dept, city, state, mode, experience, availability, interests, headline, bio, skills
    ('s_arjun','Arjun Kumar','3rd year','CSE','Coimbatore','Tamil Nadu','any','some',
      array['weekends','weekday_evenings'], array['AI','Health','Education'],
      'ML builder who likes health tech', 'Trained small vision models for crop and skin images. Wants a team that ships a real demo.',
      array['Python','Machine Learning','Computer Vision','TensorFlow/PyTorch']),
    ('s_divya','Divya Ramesh','2nd year','IT','Coimbatore','Tamil Nadu','offline','first_timer',
      array['weekends','holidays'], array['Web','Education','Social Good'],
      'Frontend dev, loves clean UI', 'Builds React pages and small Tailwind sites. First hackathon this year.',
      array['React','JavaScript','HTML/CSS','Tailwind CSS']),
    ('s_karthi','Karthikeyan M','4th year','ECE','Madurai','Tamil Nadu','any','veteran',
      array['weekends','late_nights'], array['Robotics','Smart Cities','Climate'],
      'IoT and hardware, 6 hackathons', 'ESP32 and Arduino projects for smart farming and energy meters. Can lead a hardware track.',
      array['Arduino','ESP32','Embedded C','PCB/Circuit Design']),
    ('s_meena','Meena Sundar','3rd year','B.Des','Chennai','Tamil Nadu','online','some',
      array['weekday_evenings','weekends'], array['Accessibility','Education','Health'],
      'UI/UX designer, Figma first', 'Designs simple, accessible apps. Makes the pitch deck look good too.',
      array['UI/UX Design','Figma','Graphic Design','PPT Design']),
    ('s_rahul','Rahul Varma','2nd year','CSE','Bengaluru','Karnataka','online','some',
      array['late_nights','weekends'], array['FinTech','Web','Open Source'],
      'Backend and APIs', 'Node and Postgres APIs, likes Supabase and clean database design.',
      array['Node.js','Express','SQL/PostgreSQL','Supabase']),
    ('s_sneha','Sneha Iyer','1st year','B.Com (CA)','Coimbatore','Tamil Nadu','any','first_timer',
      array['weekday_evenings','weekends'], array['Social Good','Education','FinTech'],
      'Research, pitching and docs', 'Good at user research, documentation and presenting. Looking for a tech team.',
      array['Pitching','Research','Documentation','Excel']),
    ('s_vignesh','Vignesh R','3rd year','CSE (Cyber Security)','Coimbatore','Tamil Nadu','any','some',
      array['late_nights','weekends'], array['Security','Web','Open Source'],
      'Security and CTF player', 'Web security testing and CTFs. Can make your project safe by design.',
      array['Ethical Hacking','Web Security','CTF','Python']),
    ('s_ananya','Ananya Prakash','2nd year','AI & DS','Hyderabad','Telangana','online','some',
      array['weekday_evenings','late_nights'], array['AI','Education','Gaming'],
      'LLM apps and prompts', 'Builds chatbots with LLM APIs and simple RAG. Wants an online team.',
      array['NLP/LLMs','Prompt Engineering','Python','Flask/FastAPI']),
    ('s_harish','Harish Babu','4th year','Mechanical','Tiruppur','Tamil Nadu','offline','veteran',
      array['weekends','holidays'], array['Robotics','Climate','Agriculture'],
      'Robotics and 3D design', 'CAD, 3D printing and robot arms. Has won two college hackathons.',
      array['3D/Blender','Arduino','Raspberry Pi','Research']),
    ('s_fathima','Fathima Noor','3rd year','IT','Chennai','Tamil Nadu','any','some',
      array['weekday_evenings','weekends'], array['Health','Accessibility','Web'],
      'Flutter apps', 'Ships Android and iOS apps with Flutter and Firebase.',
      array['Flutter','Firebase','Android (Kotlin)','UI/UX Design']),
    ('s_naveen','Naveen Kumar','1st year','CSE','Erode','Tamil Nadu','any','first_timer',
      array['weekends'], array['Gaming','Web','AI'],
      'Learning web dev', 'Knows HTML, CSS and some JavaScript. Wants to learn by building.',
      array['HTML/CSS','JavaScript','Git/GitHub']),
    ('s_priya','Priya Raman','3rd year','AI & ML','Coimbatore','Tamil Nadu','any','some',
      array['weekends','weekday_evenings'], array['AI','Agriculture','Health'],
      'ML engineer, data to model', 'Data cleaning to deployed model. Likes agriculture and health problems.',
      array['Machine Learning','Deep Learning','Data Analysis','Python']),
    ('s_sanjay','Sanjay D','2nd year','CSE','Pune','Maharashtra','online','some',
      array['late_nights','weekday_evenings'], array['Open Source','Web','Blockchain'],
      'Cloud and DevOps', 'Docker, CI and deployments on Vercel and AWS free tier.',
      array['Docker','AWS/GCP/Azure','Vercel/Netlify','Git/GitHub']),
    ('s_keerthana','Keerthana V','2nd year','ECE','Salem','Tamil Nadu','any','first_timer',
      array['weekends','holidays'], array['Smart Cities','Health','Climate'],
      'Sensors and data', 'Sensor projects and Power BI dashboards. First big hackathon.',
      array['Arduino','Power BI/Tableau','Data Analysis']),
    ('s_rohit','Rohit Sharma','PG','MCA','Delhi','Delhi','online','veteran',
      array['weekday_evenings','late_nights'], array['FinTech','AI','Web'],
      'Full-stack, Next.js', 'Next.js and Postgres. Has mentored first-year teams.',
      array['Next.js','TypeScript','React','SQL/PostgreSQL']),
    ('s_lakshmi','Lakshmi Narayanan','3rd year','B.Sc CS','Coimbatore','Tamil Nadu','offline','some',
      array['weekends','weekday_mornings'], array['Education','Social Good','Accessibility'],
      'Video and content', 'Edits demo videos and writes clear pitch scripts.',
      array['Video Editing','Pitching','Graphic Design']),
    ('s_ajay','Ajay Krishnan','4th year','CSE','Kochi','Kerala','any','veteran',
      array['weekends','late_nights'], array['AI','Security','Smart Cities'],
      'Computer vision and edge AI', 'Runs vision models on Raspberry Pi for smart city ideas.',
      array['Computer Vision','Raspberry Pi','Python','Docker']),
    ('s_nisha','Nisha George','1st year','AI & DS','Coimbatore','Tamil Nadu','any','first_timer',
      array['weekday_evenings','weekends'], array['AI','Education','Health'],
      'Beginner in AI, quick learner', 'Finished an ML course, wants a friendly team for a first hackathon.',
      array['Python','Excel','Research'])
  ) as t(handle, name, yr, dept, city, st, mode, exp, avail, interests, headline, bio, skills)
  loop
    -- skip if this sample already exists
    if exists (select 1 from public.profiles where handle = r.handle) then continue; end if;

    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
            r.handle || '@sample.hakemate.test', '', now(),
            '{"provider":"google","providers":["google"]}'::jsonb,
            jsonb_build_object('full_name', r.name), now(), now(), '', '', '', '');
    -- handle_new_user() has now created app_users + profiles + contacts

    update public.profiles set
      handle = r.handle, display_name = r.name, is_sample = true,
      headline = r.headline, bio = r.bio,
      college = 'Sample College of Engineering', department = r.dept, year_of_study = r.yr,
      city = r.city, state = r.st, event_mode = r.mode, experience_level = r.exp,
      hackathons_count = case r.exp when 'veteran' then 5 when 'some' then 2 else 0 end,
      availability = r.avail, interests = r.interests, looking_for_team = true
    where id = v_id;

    insert into public.profile_skills (profile_id, skill_id, level)
    select v_id, s.id, 2 from public.skills s where s.name = any(r.skills);

    update public.app_users set onboarded = true, tour_done = true where id = v_id;
  end loop;

  -- two sample open teams for International Hackathon 5.0, so the event page has teams to join
  select id into v_owner from public.profiles where handle = 's_karthi';
  if v_owner is not null and not exists (select 1 from public.teams where name = 'Sample: Green Grid') then
    insert into public.teams (name, hackathon_id, owner_id, description, needed_categories, max_size)
    values ('Sample: Green Grid', 'international-hackathon-5', v_owner,
            'Sample team. Smart energy meter with an app that shows waste in real time.',
            array['Frontend','Design','Presentation'], 4)
    returning id into v_team;
    insert into public.team_members (team_id, user_id, role_title) values (v_team, v_owner, 'Captain');
  end if;

  select id into v_owner from public.profiles where handle = 's_rahul';
  if v_owner is not null and not exists (select 1 from public.teams where name = 'Sample: StudyBuddy AI') then
    insert into public.teams (name, hackathon_id, owner_id, description, needed_categories, max_size)
    values ('Sample: StudyBuddy AI', 'international-hackathon-5', v_owner,
            'Sample team. AI study planner for first-year students.',
            array['AI/ML','Design'], 4)
    returning id into v_team;
    insert into public.team_members (team_id, user_id, role_title) values (v_team, v_owner, 'Captain');
  end if;
end $$;
