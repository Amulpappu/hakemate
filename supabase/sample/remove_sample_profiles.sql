-- Removes every sample profile (and their sample teams, posts, chats) in one go.
delete from auth.users where email like '%@sample.hakemate.test';
