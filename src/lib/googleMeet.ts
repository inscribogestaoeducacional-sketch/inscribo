import { supabase } from './supabase'

export interface GoogleMeetResult {
  meet_link: string | null
  calendar_link: string | null
  event_id: string | null
  error?: string
}

export function buildEndDatetime(startIso: string, durationMin: number): string {
  const start = new Date(startIso)
  start.setMinutes(start.getMinutes() + durationMin)
  return start.toISOString()
}

export async function createGoogleMeet(params: {
  title: string
  description?: string
  start_datetime: string
  end_datetime: string
  attendees?: string[]
}): Promise<GoogleMeetResult> {
  try {
    const { data, error } = await supabase.functions.invoke('create-google-meet', {
      body: params,
    })
    if (error) return { meet_link: null, calendar_link: null, event_id: null, error: error.message }
    return data as GoogleMeetResult
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { meet_link: null, calendar_link: null, event_id: null, error: message }
  }
}
