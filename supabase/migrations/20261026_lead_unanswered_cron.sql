select cron.schedule('lead-unanswered-tick', '*/15 * * * *', $$select public.lead_unanswered_tick()$$);
