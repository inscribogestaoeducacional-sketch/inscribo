import React from 'react'
import {
  House, Funnel, CalendarCheck, AddressBook, WhatsappLogo, Megaphone, Storefront, PaperPlaneTilt, Flag, GraduationCap,
  ArrowsLeftRight, ChartLineUp, ClipboardText, UsersThree, GearSix, DeviceMobile, BookOpenText,
} from '@phosphor-icons/react'

const MAP: Record<string, React.ComponentType<any>> = {
  House, Funnel, CalendarCheck, AddressBook, WhatsappLogo, Megaphone, Storefront, PaperPlaneTilt, Flag, GraduationCap,
  ArrowsLeftRight, ChartLineUp, ClipboardText, UsersThree, GearSix, DeviceMobile,
}

export default function AcademyIcon({ name, size = 22, color = '#05907B', weight = 'duotone' }: { name: string; size?: number; color?: string; weight?: 'duotone' | 'fill' | 'regular' }) {
  const I = MAP[name] || BookOpenText
  return <I size={size} color={color} weight={weight} />
}
