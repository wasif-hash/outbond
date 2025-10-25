import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOutreachEmailDraft } from '@/lib/gemini'
import { formatEmailBody } from '@/lib/email/format'

const MAX_LEADS_PER_REQUEST = 50

interface LeadDraftInput {
  email: string
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  summary?: string | null
  role?: string | null
}

interface SenderContext {
  name?: string | null
  company?: string | null
  valueProp?: string | null
  callToAction?: string | null
  prompt?: string | null
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as {
    leads?: LeadDraftInput[]
    sender?: SenderContext
  } | null

  if (!body || !Array.isArray(body.leads) || body.leads.length === 0) {
    return NextResponse.json({ error: 'No leads provided' }, { status: 400 })
  }

  if (body.leads.length > MAX_LEADS_PER_REQUEST) {
    return NextResponse.json({ error: `Too many leads; max ${MAX_LEADS_PER_REQUEST} per request` }, { status: 400 })
  }

  const gmailAccount = await prisma.gmailAccount.findUnique({ where: { userId: authResult.user.userId } })
  if (!gmailAccount) {
    return NextResponse.json({ error: 'Gmail account not connected' }, { status: 409 })
  }

  const drafts = [] as Array<{
    email: string
    subject: string
    bodyHtml: string
    bodyText: string
  }>

  for (const lead of body.leads) {
    if (!lead?.email) {
      continue
    }

    const draft = await generateOutreachEmailDraft({
      leadFirstName: lead.firstName,
      leadLastName: lead.lastName,
      leadCompany: lead.company,
      leadRole: lead.role,
      leadSummary: lead.summary,
      senderName: body.sender?.name || gmailAccount.emailAddress.split('@')[0],
      senderCompany: body.sender?.company || undefined,
      senderValueProp: body.sender?.valueProp || undefined,
      callToAction: body.sender?.callToAction || undefined,
      customInstructions: body.sender?.prompt || undefined,
    })

    if (!draft?.body) {
      console.warn('Gemini returned no structured draft for', lead.email)
      continue
    }

    const subject = draft.subject?.trim() || defaultSubject(lead)
    const { html, text } = formatEmailBody(draft.body)

    drafts.push({
      email: lead.email,
      subject,
      bodyHtml: html,
      bodyText: text,
    })
  }

  return NextResponse.json({ drafts })
}

function defaultSubject(lead: LeadDraftInput): string {
  const target = lead.company || lead.firstName || 'there'
  return `Quick idea for ${target}`
}
