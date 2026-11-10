@echo off
title Deploy Hakemate to Vercel
cd /d "%~dp0web"
echo.
echo  Deploying Hakemate to Vercel (production)...
echo  If asked to log in, finish the login in your browser, then come back here.
echo.
call npx --yes vercel@latest deploy --prod --yes --build-env VITE_SUPABASE_URL=https://vgotoybpbxpimmhbibit.supabase.co --build-env VITE_SUPABASE_ANON_KEY=sb_publishable_MOojr9YGAVrszjidSmox-w_wWlxFHQI
echo.
echo  Done. Copy the Production URL above and send it to Claude.
pause
