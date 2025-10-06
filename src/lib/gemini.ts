// src/lib/gemini.ts
import { generateLeadSummary } from './utils'
import { GoogleGenAI } from '@google/genai'

interface GeminiSummaryInput {
  firstName?: string | null
  lastName?: string | null
  title?: string | null
  company?: string | null
  domain?: string | null
  email?: string | null
  linkedinUrl?: string | null
}

interface OutreachEmailCandidate {
  subject: string
  body: string
}

export interface OutreachEmailInput {
  leadFirstName?: string | null
  leadLastName?: string | null
  leadCompany?: string | null
  leadSummary?: string | null
  leadRole?: string | null
  senderName?: string | null
  senderCompany?: string | null
  senderValueProp?: string | null
  callToAction?: string | null
}

export interface OutreachEmailDraft {
  subject: string
  body: string
}

const SYSTEM_INSTRUCTION = `You are a sophisticated AI data processing engine. Your main role is to take raw JSON data (which may be messy, incomplete, or contain extra fields) and perform critical structured data extraction and synthesis.

Core Tasks
1. Parse Input JSON
   Always read the raw JSON input. Do not ignore fields — search carefully across nested keys, arrays, and objects.
2. Extract the Following Data Points
   Full Name → derive from input; if only first/last name provided, combine.
   First Name
   Last Name
   LinkedIn → direct LinkedIn profile URL of the person (if present).
   Email → extract valid email address.
   Title → person’s job title.
   Organization Name → company/organization the person is linked with.
   Organization Website → company website URL.
   Organization LinkedIn → company LinkedIn page (if available).
   City → city of the person.
   Country → country of the person.
3. Synthesize a Professional Summary
   After extraction, generate a 2–3 sentence summary of the person and organization. The summary should be concise, professional, and neutral. If some data points are missing, synthesize the summary only from available information.

Output Rules
- Always return output in JSON format only.
- Do not include extra text, comments, or greetings.
- If a field is missing, return it as an empty string "".
- Ensure valid JSON syntax (double quotes, no trailing commas).

Output Schema
{ "full_name": "string", "first_name": "string", "last_name": "string", "linkedin_url": "string", "email": "string", "title": "string", "company_name": "string", "company_website": "string", "company_linkedin": "string", "city": "string", "country": "string", "summary": "string" }`

let genAI: GoogleGenAI | null = null

const DEFAULT_MODEL_ORDER = ['gemini-2.5-flash', 'gemini-1.5-flash'] as const
const MAX_RETRY_ATTEMPTS = 3
const BASE_RETRY_DELAY_MS = 750

function getGeminiClient(): GoogleGenAI | null {
  if (genAI) {
    return genAI
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return null
  }

  genAI = new GoogleGenAI({ apiKey })
  return genAI
}

function isRetryableGeminiError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const maybeError = error as { code?: number; status?: string; error?: { code?: number; status?: string; message?: string }; message?: string }
  const code = maybeError.code ?? maybeError.error?.code
  if (typeof code === 'number' && [408, 429, 500, 502, 503, 504].includes(code)) {
    return true
  }

  const status = maybeError.status ?? maybeError.error?.status
  if (typeof status === 'string' && ['UNAVAILABLE', 'RESOURCE_EXHAUSTED'].includes(status.toUpperCase())) {
    return true
  }

  const message = maybeError.message ?? maybeError.error?.message
  if (typeof message === 'string' && /(overloaded|unavailable|timeout|exhausted)/i.test(message)) {
    return true
  }

  return false
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function generateContentWithFallback(
  client: GoogleGenAI,
  baseRequest: { contents: unknown; config?: unknown },
  models: readonly string[] = DEFAULT_MODEL_ORDER,
) {
  let lastError: unknown = null

  for (const model of models) {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await client.models.generateContent({
          ...(baseRequest as Record<string, unknown>),
          model,
          contents: ''
        })
      } catch (error) {
        lastError = error
        if (!isRetryableGeminiError(error)) {
          throw error
        }

        const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1
        if (isLastAttempt) {
          break
        }

        const delayMs = BASE_RETRY_DELAY_MS * (attempt + 1)
        await wait(delayMs)
      }
    }
  }

  throw lastError ?? new Error('Gemini request failed without an explicit error payload')
}

export async function generateGeminiLeadSummary(input: GeminiSummaryInput): Promise<string | null> {
  const client = getGeminiClient()
  if (!client) {
    return null
  }

  const prompt = buildPrompt(input)
  try {
    const response = await generateContentWithFallback(client, {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    })

    const text = extractSummaryText(response)

    if (!text) {
      return null
    }

    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
        if (summary) {
          return summary
        }
      }
    } catch {
      // Fall through to returning raw text
    }

    return text.trim()
  } catch (error) {
    console.error('Gemini summary generation error:', error)
    return null
  }
}

function buildPrompt(input: GeminiSummaryInput): string {
  const payload = {
    person: {
      first_name: input.firstName || '',
      last_name: input.lastName || '',
      title: input.title || '',
      company: input.company || '',
      domain: input.domain || '',
      email: input.email || '',
      linkedin_url: input.linkedinUrl || ''
    }
  }

  return JSON.stringify(payload, null, 2)
}

type GeminiContentPart = { text?: string }
type GeminiCandidate = { content?: { parts?: GeminiContentPart[] } }
type GeminiSummaryPayload = {
  response?: { candidates?: GeminiCandidate[] }
  output_text?: unknown
}

function extractSummaryText(response: unknown): string | null {
  const typedResponse = response as GeminiSummaryPayload
  const candidate = typedResponse.response?.candidates?.find(Boolean)
  const parts = candidate?.content?.parts
  if (parts?.length) {
    const textPart = parts.find((part) => typeof part.text === 'string')
    if (textPart?.text) {
      return textPart.text
    }
  }

  if (typeof typedResponse.output_text === 'string') {
    return typedResponse.output_text
  }

  return null
}

export async function generateSmartLeadSummary(input: GeminiSummaryInput): Promise<string> {
  const geminiSummary = await generateGeminiLeadSummary(input)
  if (geminiSummary) {
    return geminiSummary
  }

  return generateLeadSummary({
    id: '',
    first_name: input.firstName || '',
    last_name: input.lastName || '',
    title: input.title || '',
    company_name: input.company || '',
    domain: input.domain || '',
    email: input.email || '',
    linkedin_url: input.linkedinUrl || '',
  })
}

const EMAIL_INSTRUCTION = `You are a senior SDR crafting hyper-personalised cold outreach emails. Respond ONLY with valid JSON matching this schema: { "subject": "string", "body": "string" }.

Rules:
- Keep the email under 170 words; use crisp paragraphs.
- Address the lead by name, reference their company and role, and connect their summary to the pitch.
- Use a single clear CTA (e.g. quick intro call) in the closing line.
- Keep tone confident, respectful, and professional American-style English.
- Never invent facts; rely only on provided input.
- Body must be HTML-safe without <html>/<body> tags.`

export async function generateOutreachEmailDraft(
  input: OutreachEmailInput,
): Promise<OutreachEmailDraft | null> {
  const client = getGeminiClient()
  if (!client) {
    return null
  }

  const payload = {
    lead: {
      first_name: input.leadFirstName || '',
      last_name: input.leadLastName || '',
      company: input.leadCompany || '',
      role: input.leadRole || '',
      summary: input.leadSummary || '',
    },
    sender: {
      name: input.senderName || '',
      company: input.senderCompany || '',
      value_prop: input.senderValueProp || '',
      call_to_action: input.callToAction || 'Would love 15 minutes later this week to share more if it resonates.',
    },
  }

  try {
    const response = await generateContentWithFallback(client, {
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(payload, null, 2) }],
        },
      ],
      config: {
        systemInstruction: EMAIL_INSTRUCTION,
      },
    })

    const text = extractSummaryText(response)
    if (!text) {
      return null
    }

    try {
      const parsed = JSON.parse(text) as OutreachEmailCandidate
      if (parsed.subject && parsed.body) {
        return {
          subject: parsed.subject.trim(),
          body: parsed.body.trim(),
        }
      }
    } catch (error) {
      console.warn('Gemini outreach email response unparsable, returning raw text body', error)
    }

    return {
      subject: `Quick intro?`,
      body: text.trim(),
    }
  } catch (error) {
    console.error('Gemini outreach email generation error:', error)
    return null
  }
}
