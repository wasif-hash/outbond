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

type DraftPayload = {
  email: string
  subject: string
  bodyHtml: string
  bodyText: string
}

type StatusEvent =
  | { type: "status"; phase: "working" | "generating" | "finalizing"; total: number; completed: number }
  | { type: "done"; drafts: DraftPayload[] }
  | { type: "error"; message: string }

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    leads?: LeadDraftInput[]
    sender?: SenderContext
  } | null

  if (!body || !Array.isArray(body.leads) || body.leads.length === 0) {
    return NextResponse.json({ error: "No leads provided" }, { status: 400 })
  }

  if (body.leads.length > MAX_LEADS_PER_REQUEST) {
    return NextResponse.json({ error: `Too many leads; max ${MAX_LEADS_PER_REQUEST} per request` }, { status: 400 })
  }

  const gmailAccount = await prisma.gmailAccount.findUnique({ where: { userId: authResult.user.userId } })
  if (!gmailAccount) {
    return NextResponse.json({ error: "Gmail account not connected" }, { status: 409 })
  }

  const leads = body.leads
  const total = leads.length
  const concurrency = Math.min(4, total)
  const senderDefaults = {
    name: body.sender?.name || gmailAccount.emailAddress.split("@")[0],
    company: body.sender?.company || undefined,
    valueProp: body.sender?.valueProp || undefined,
    callToAction: body.sender?.callToAction || undefined,
    prompt: body.sender?.prompt || undefined,
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (payload: StatusEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }

      const sendError = (message: string) => {
        enqueue({ type: "error", message })
      }

      enqueue({ type: "status", phase: "working", total, completed: 0 })

      ;(async () => {
        const drafts: DraftPayload[] = []
        let completed = 0
        let index = 0

        const incrementProgress = () => {
          completed += 1
          enqueue({ type: "status", phase: "generating", total, completed })
        }

        const worker = async () => {
          while (true) {
            const currentIndex = index
            index += 1
            if (currentIndex >= total) {
              break
            }

            const lead = leads[currentIndex]
            if (!lead?.email) {
              incrementProgress()
              continue
            }

            try {
              const draft = await generateOutreachEmailDraft({
                leadFirstName: lead.firstName,
                leadLastName: lead.lastName,
                leadCompany: lead.company,
                leadRole: lead.role,
                leadSummary: lead.summary,
                senderName: senderDefaults.name,
                senderCompany: senderDefaults.company,
                senderValueProp: senderDefaults.valueProp,
                callToAction: senderDefaults.callToAction,
                customInstructions: senderDefaults.prompt,
              })

              if (!draft?.body) {
                console.warn("Gemini returned no structured draft for", lead.email)
                incrementProgress()
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
            } catch (error) {
              console.error("Draft generation failed for lead:", lead.email, error)
            } finally {
              incrementProgress()
            }
          }
        }

        try {
          await Promise.all(Array.from({ length: concurrency }, () => worker()))
          enqueue({ type: "status", phase: "finalizing", total, completed })
          enqueue({ type: "done", drafts })
        } catch (error) {
          console.error("Draft generation stream failed:", error)
          sendError(error instanceof Error ? error.message : "Failed to generate drafts")
        } finally {
          controller.close()
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  })
}

function defaultSubject(lead: LeadDraftInput): string {
  const target = lead.company || lead.firstName || 'there'
  return `Quick idea for ${target}`
}
