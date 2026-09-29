import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  email?: string
  name?: string
  useCase?: string
}

const NAVY = '#1e3a8a'
const INK = '#111827'
const ORANGE = '#ea580c'
const MUTED = '#6b7280'
const GRID = 'rgba(30,58,138,0.10)'

const paper = {
  backgroundColor: '#ffffff',
  backgroundImage: `repeating-linear-gradient(0deg, ${GRID} 0px, ${GRID} 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, ${GRID} 0px, ${GRID} 1px, transparent 1px, transparent 24px)`,
  fontFamily: "'Courier New', Courier, monospace",
  color: INK,
}

function WaitlistConfirmationEmail({ email = 'you@example.com', name, useCase }: Props) {
  const firstName = (name || '').trim().split(/\s+/)[0]
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your spot is reserved — we'll email you the moment access opens.</Preview>
      <Body style={{ ...paper, margin: 0, padding: '32px 16px' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', border: `2px solid ${NAVY}`, backgroundColor: '#ffffff', boxShadow: '6px 6px 0 rgba(30,58,138,0.25)' }}>
          {/* Header band */}
          <Section style={{ backgroundColor: NAVY, padding: '24px 28px', backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 1px, transparent 1px, transparent 24px)` }}>
            <Text style={{ margin: 0, color: '#fdba74', fontSize: '11px', letterSpacing: '3px', fontWeight: 700 }}>
              [ SIGNAL RECEIVED ]
            </Text>
            <Heading style={{ margin: '10px 0 0', color: '#ffffff', fontSize: '22px', letterSpacing: '1px', fontWeight: 700 }}>
              YOU'RE ON THE LIST
            </Heading>
            <Text style={{ margin: '8px 0 0', color: '#c7d2fe', fontSize: '13px' }}>
              System Design Architect · free during beta
            </Text>
          </Section>
          <div style={{ height: '6px', backgroundColor: ORANGE }} />

          <Section style={{ padding: '28px' }}>
            <Text style={{ margin: 0, fontSize: '15px', lineHeight: '24px' }}>
              {firstName ? `Hi ${firstName},` : 'Hi there,'}
            </Text>
            <Text style={{ margin: '12px 0 0', fontSize: '15px', lineHeight: '24px' }}>
              Your spot on the waitlist is reserved
              {useCase ? (
                <> — logged as <strong style={{ color: NAVY }}>{useCase}</strong></>
              ) : null}
              . We review new requests every few days, and you'll get an email at <strong style={{ color: NAVY }}>{email}</strong> the moment yours is approved.
            </Text>

            {/* Next steps */}
            <Section style={{ marginTop: '24px', border: `2px solid ${INK}`, padding: '18px 20px' }}>
              <Text style={{ margin: 0, fontSize: '12px', letterSpacing: '2px', fontWeight: 700, color: ORANGE }}>
                WHAT HAPPENS NEXT
              </Text>
              <Text style={{ margin: '12px 0 0', fontSize: '14px', lineHeight: '22px' }}>
                <strong>01.</strong> We review your request within a few days.
              </Text>
              <Text style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: '22px' }}>
                <strong>02.</strong> Approval lands in your inbox — no spam, just the go signal.
              </Text>
              <Text style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: '22px' }}>
                <strong>03.</strong> Sign in, describe your system, and get a reviewable design backed by the classic system design books.
              </Text>
            </Section>

            {/* While you wait */}
            <Section style={{ marginTop: '20px', padding: '16px 20px', backgroundColor: '#f8fafc', borderLeft: `4px solid ${ORANGE}` }}>
              <Text style={{ margin: 0, fontSize: '12px', letterSpacing: '2px', fontWeight: 700, color: MUTED }}>
                WHILE YOU WAIT
              </Text>
              <Text style={{ margin: '10px 0 0', fontSize: '14px', lineHeight: '22px' }}>
                See a real design the tool produced, unedited:{' '}
                <Link href="https://sda.corbetai.com/samples" style={{ color: NAVY, fontWeight: 700 }}>
                  sda.corbetai.com/samples
                </Link>
              </Text>
            </Section>

            <Hr style={{ borderColor: '#e5e7eb', margin: '28px 0 16px' }} />
            <Text style={{ margin: 0, fontSize: '12px', color: MUTED, lineHeight: '18px' }}>
              You're receiving this because someone (hopefully you) joined the waitlist with this address. If it wasn't you, you can ignore this email — nothing else will be sent to this address until your spot is approved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WaitlistConfirmationEmail,
  subject: (d: Record<string, any>) =>
    d['name'] ? `You're on the list, ${String(d['name']).trim().split(/\s+/)[0]}` : "You're on the list — System Design Architect",
  displayName: 'Waitlist confirmation (to the person who signed up)',
  previewData: { email: 'jane@example.com', name: 'Jane', useCase: 'Design docs at work' },
} satisfies TemplateEntry
