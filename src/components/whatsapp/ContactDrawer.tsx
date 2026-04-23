import React from 'react'
import ContactCard from '../contacts/ContactCard'

interface DrawerConversation {
  id: string
  name: string
  phone: string
  avatarColor?: string
  contact_type?: string
  lead_id?: string
  profile_picture_url?: string
  tags?: string[]
  status?: string
  lastTime?: Date
  lastMessage?: string
  assigned_user_name?: string
  assigned_user_id?: string
}

export interface ContactDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversation: DrawerConversation | null
  allConversations: DrawerConversation[]
  institutionId: string
  onUpdate: (jid: string, updates: Record<string, any>) => void
}

export default function ContactDrawer({
  isOpen,
  onClose,
  conversation,
  allConversations,
  institutionId,
  onUpdate,
}: ContactDrawerProps) {
  return (
    <ContactCard
      mode="drawer"
      isOpen={isOpen}
      onClose={onClose}
      institutionId={institutionId}
      initialData={conversation ? {
        lead_id:              conversation.lead_id,
        remote_jid:           conversation.id,
        name:                 conversation.name,
        phone:                conversation.phone,
        contact_type:         conversation.contact_type,
        tags:                 conversation.tags,
        profile_picture_url:  conversation.profile_picture_url,
        assigned_user_name:   conversation.assigned_user_name,
        assigned_user_id:     conversation.assigned_user_id,
        status:               conversation.status,
      } : {}}
      allConversations={allConversations}
      onUpdate={updates => {
        if (conversation) onUpdate(conversation.id, updates)
      }}
    />
  )
}
