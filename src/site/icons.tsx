import {
  Funnel, WhatsappLogo, Robot, PaperPlaneTilt, CalendarCheck, AddressBook, Megaphone, Storefront, Flag,
  GraduationCap, ArrowsClockwise, ArrowsLeftRight, ChartLineUp, ClipboardText, ListChecks, BookOpenText, UsersThree,
  ArrowRight, Plugs, MapPin, CheckCircle, Sparkle, ShieldCheck, Lightning,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

const MAP: Record<string, Icon> = {
  Funnel, WhatsappLogo, Robot, PaperPlaneTilt, CalendarCheck, AddressBook, Megaphone, Storefront, Flag,
  GraduationCap, ArrowsClockwise, ArrowsLeftRight, ChartLineUp, ClipboardText, ListChecks, BookOpenText, UsersThree,
  ArrowRight, Plugs, MapPin, CheckCircle, Sparkle, ShieldCheck, Lightning,
}
export function ModIcon({ name, size = 24, color, weight = 'duotone' }: { name: string; size?: number; color?: string; weight?: 'duotone' | 'bold' | 'fill' | 'regular' }) {
  const I = MAP[name] ?? Sparkle
  return <I size={size} color={color} weight={weight} />
}
