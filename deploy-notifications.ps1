# Deploy notification Edge Functions to Supabase
# Run from project root: .\deploy-notifications.ps1

Write-Host "Deploying daily-summary function..." -ForegroundColor Cyan
supabase functions deploy daily-summary --no-verify-jwt

Write-Host "Deploying funnel-alert function..." -ForegroundColor Cyan
supabase functions deploy funnel-alert --no-verify-jwt

Write-Host ""
Write-Host "Done. Remember to:" -ForegroundColor Green
Write-Host "  1. Enable pg_cron and pg_net extensions in the Supabase dashboard."
Write-Host "  2. Set app.supabase_url and app.service_role_key in postgres settings,"
Write-Host "     OR replace current_setting() in cron_notifications.sql with hardcoded values."
Write-Host "  3. Run supabase/migrations/cron_notifications.sql via the SQL editor."
