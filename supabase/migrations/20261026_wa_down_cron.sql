select cron.schedule('wa-down-tick', '*/10 * * * *', $$select public.wa_down_tick()$$);
