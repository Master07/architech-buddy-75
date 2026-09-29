import * as React from 'react'
import { render } from '@react-email/render'
import { TEMPLATES } from './registry'

// Server-only: reads LOVABLE_API_KEY and RESEND_API_KEY. Never import from client components.

// Configuration baked in at scaffold time
const SITE_NAME = "System Design Architect"
// Sending domain verified in Resend (Resend dashboard -> Domains).
const FROM_DOMAIN = "send.sda.corbetai.com"

// Connector gateway: auth is handled with these two headers; never call
// Resend's API directly with the connection key.
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  /** Kept for call-site compatibility; Resend dedupes are managed on its side. */
  idempotencyKey?: string
  replyTo?: string
}

/**
 * Renders a registered template and sends it through Resend via the connector
 * gateway. Any provider failure throws with the provider's status and body so
 * callers can log the real cause.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  const lovableApiKey = process.env['LOVABLE_API_KEY']
  const resendApiKey = process.env['RESEND_API_KEY']
  if (!lovableApiKey || !resendApiKey) {
    throw new Error('Email sending is not configured (missing gateway or Resend credentials)')
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to
  if (!recipient) {
    throw new Error('Recipient is required (the template defines no fixed recipient)')
  }

  const templateData = options.templateData ?? {}
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  const response = await fetch(`${GATEWAY_URL}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lovableApiKey}`,
      'X-Connection-Api-Key': resendApiKey,
    },
    body: JSON.stringify({
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      to: [recipient],
      subject,
      html,
      text,
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error(`Resend send failed [${response.status}]: ${errorBody}`)
    throw new Error(`Email send failed [${response.status}]: ${errorBody}`)
  }

  return { sent: true }
}
