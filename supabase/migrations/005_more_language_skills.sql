-- More programming languages, so GitHub language detection can map every common language to a skill
insert into public.skills (name, category) values
 ('Vue', 'Frontend'), ('Angular', 'Frontend'),
 ('C/C++', 'Backend'), ('C#/.NET', 'Backend'), ('Go', 'Backend'), ('Rust', 'Backend'), ('PHP', 'Backend'), ('Ruby', 'Backend'), ('Solidity', 'Backend'),
 ('Swift (iOS)', 'Mobile'),
 ('R', 'Data'), ('MATLAB', 'Data'),
 ('Bash/Shell', 'Cloud/DevOps')
on conflict (name) do nothing;
