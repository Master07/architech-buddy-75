import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  email?: string
  name?: string
  useCase?: string
  note?: string
}

function WaitlistSignupEmail({ email = 'someone@example.com', name, useCase, note }: Props) {
  return (
    <Html>
      <Head />
      <Preview>New waitlist sign-up: {email}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'monospace', color: '#111111' }}>
        <Container style={{ padding: '24px', border: '2px solid #111111', maxWidth: '520px' }}>
          <Heading style={{ fontSize: '18px' }}>New waitlist sign-up</Heading>
          <Text><strong>Email:</strong> {email}</Text>
          <Text><strong>Name:</strong> {name || '—'}</Text>
          <Text><strong>Use case:</strong> {useCase || '—'}</Text>
          <Text><strong>Note:</strong> {note || '—'}</Text>
          <Text style={{ color: '#666666', fontSize: '12px' }}>
            See everyone on the Waitlist page at sda.corbetai.com/app/waitlist.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WaitlistSignupEmail,
  subject: (d: Record<string, any>) => `New waitlist sign-up: ${d.email ?? ''}`,
  displayName: 'Waitlist sign-up (to admin)',
  to: 'navneet.jha07@gmail.com',
  previewData: { email: 'jane@example.com', name: 'Jane', useCase: 'Design docs at work', note: 'Excited!' },
} satisfies TemplateEntry
