create trigger trg_notify_exit_survey after update of survey_completed_at on public.student_transfers
  for each row when (old.survey_completed_at is null and new.survey_completed_at is not null)
  execute function public.trg_notify_exit_survey();
