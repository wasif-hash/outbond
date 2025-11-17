// src/lib/gemini.ts
import { generateLeadSummary } from './utils'
import { GoogleGenAI } from '@google/genai'
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai'

interface GeminiSummaryInput {
  firstName?: string | null
  lastName?: string | null
  title?: string | null
  company?: string | null
  domain?: string | null
  email?: string | null
  linkedinUrl?: string | null
  rawPayload?: Record<string, unknown> | null
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
  customInstructions?: string | null
}

export interface OutreachEmailDraft {
  subject: string
  body: string
}

function buildFallbackOutreachEmail(input: OutreachEmailInput): OutreachEmailDraft {
  const greeting = input.leadFirstName ? `Hi ${input.leadFirstName},` : 'Hello,'
  const company = input.leadCompany || 'your team'
  const summaryLine = input.leadSummary
    ? `I noticed ${input.leadSummary}`
    : `I've been following the work happening at ${company}.`
  const valueProp = input.senderValueProp || 'We help operators scale outbound while staying personal.'
  const callToAction =
    input.callToAction || 'Would you be open to a quick 15-minute chat next week to see if this could help?'
  const sender = input.senderName || 'Our team'
  const customAngle = input.customInstructions
    ? `<p>${input.customInstructions}</p>`
    : undefined

  const subjectTarget = input.leadCompany || input.leadFirstName || 'you'

  return {
    subject: `Quick idea for ${subjectTarget}`,
    body: [
      `<p>${greeting}</p>`,
      `<p>${summaryLine}</p>`,
      `<p>${valueProp}</p>`,
      ...(customAngle ? [customAngle] : []),
      `<p>${callToAction}</p>`,
      `<p>Best,<br />${sender}</p>`,
    ].join('\n'),
  }
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

const DEFAULT_MODEL_ORDER = ['gemini-2.5-flash', 'gemini-2.5-flash'] as const
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

type GeminiRequest = Pick<GenerateContentParameters, 'contents' | 'config'>

async function generateContentWithFallback(
  client: GoogleGenAI,
  baseRequest: GeminiRequest,
  models: readonly string[] = DEFAULT_MODEL_ORDER,
) {
  let lastError: unknown = null

  for (const model of models) {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const request: GenerateContentParameters = {
          model,
          contents: baseRequest.contents,
          ...(baseRequest.config ? { config: baseRequest.config } : {}),
        }

        return await client.models.generateContent(request)
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
        systemInstruction: {
          role: 'system',
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
      },
    })

    const text = extractResponseText(response)

    if (!text) {
      return null
    }

    const normalizedJson = normaliseJsonBlock(text)

    if (normalizedJson) {
      try {
        const parsed = JSON.parse(normalizedJson)
        if (parsed && typeof parsed === 'object') {
          const summaryField = (parsed as { summary?: unknown }).summary
          const summary = typeof summaryField === 'string' ? summaryField.trim() : ''
          if (summary) {
            return summary
          }
        }
      } catch {
        // Swallow parse errors and fall through to fallback logic
      }

      return null
    }

    return text.trim()
  } catch (error) {
    console.error('Gemini summary generation error:', error)
    return null
  }
}

function buildPrompt(input: GeminiSummaryInput): string {
  const payload: Record<string, unknown> = {
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

  if (input.rawPayload) {
    payload.raw_apollo_payload = input.rawPayload
  }

  return JSON.stringify(payload, null, 2)
}

function extractResponseText(response: GenerateContentResponse | null | undefined): string | null {
  if (!response) {
    return null
  }

  const maybeTextMember = (response as unknown as { text?: unknown }).text

  if (typeof maybeTextMember === 'function') {
    try {
      const value = maybeTextMember.call(response)
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    } catch (error) {
      console.warn('Failed to read Gemini response via text() helper:', error)
    }
  } else if (typeof maybeTextMember === 'string' && maybeTextMember.trim()) {
    return maybeTextMember.trim()
  }

  const candidatesText = pickTextFromCandidates(
    (response as unknown as { candidates?: unknown }).candidates as Array<{
      content?: { parts?: Array<{ text?: string }> }
      text?: unknown
    }> | undefined
  )
  if (candidatesText) {
    return candidatesText
  }

  const nestedResponse = (response as unknown as { response?: { candidates?: unknown } }).response
  const nestedText = pickTextFromCandidates(
    nestedResponse?.candidates as Array<{
      content?: { parts?: Array<{ text?: string }> }
      text?: unknown
    }> | undefined
  )
  if (nestedText) {
    return nestedText
  }

  const outputText = (response as unknown as { output_text?: unknown }).output_text
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText.trim()
  }

  return null
}

function pickTextFromCandidates(
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; text?: unknown }>,
): string | null {
  if (!Array.isArray(candidates)) {
    return null
  }

  for (const candidate of candidates) {
    if (!candidate) continue

    const candidateText = candidate.text
    if (typeof candidateText === 'string' && candidateText.trim()) {
      return candidateText.trim()
    }

    const parts = candidate.content?.parts
    if (!Array.isArray(parts)) {
      continue
    }

    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text.trim()
      }
    }
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

const OUTREACH_EMAIL_SYSTEM_PROMPT = [
  'You are an expert SDR who writes tailored cold outreach.',
  'Respond ONLY with minified JSON that matches this schema: { "subject": "string", "body": "string" }.',
  '',
  'Formatting requirements for "body":',
  '  - Compose 2–3 short paragraphs wrapped in semantic <p> tags.',
  '  - Use <br /> only when you need a deliberate line break inside a paragraph.',
  '  - Keep the entire email under 170 words.',
  '',
  'Content requirements:',
  '  - Greet the lead by name and reference their role/company.',
  '  - Connect the provided lead summary to the sender value proposition.',
  '  - Close with one clear CTA (e.g. proposing a quick intro call).',
  '  - Maintain a confident, respectful tone suitable for senior operators.',
  '  - Do not fabricate information beyond the supplied payload.',
  '  - If payload.instructions is provided, treat it as the highest priority guidance for tone, structure, and content choices.',
].join('\n')

export async function generateOutreachEmailDraft(
  input: OutreachEmailInput,
): Promise<OutreachEmailDraft | null> {
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
    instructions: input.customInstructions || '',
  }

  try {
    const client = getGeminiClient()
    if (!client) {
      console.warn('Gemini client unavailable, falling back to deterministic outreach email')
      return buildFallbackOutreachEmail(input)
    }

    const response = await generateContentWithFallback(client, {
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(payload, null, 2) }],
        },
      ],
      config: {
        systemInstruction: {
          role: 'system',
          parts: [{ text: OUTREACH_EMAIL_SYSTEM_PROMPT }],
        },
        responseMimeType: 'application/json',
      },
    })

    const text = extractResponseText(response)
    if (!text) {
      console.warn('Gemini returned empty response, using fallback outreach email')
      return buildFallbackOutreachEmail(input)
    }

    const normalisedJson = normaliseJsonBlock(text)

    if (normalisedJson) {
      try {
        const parsed = JSON.parse(normalisedJson) as OutreachEmailCandidate
        if (parsed.subject && parsed.body) {
          return {
            subject: parsed.subject.trim(),
            body: enhanceEmailBody(parsed.body, input),
          }
        }
      } catch (error) {
        console.warn('Gemini outreach email response unparsable, returning raw text body', error)
      }
    }

    return {
      subject: `Quick intro?`,
      body: enhanceEmailBody(text, input),
    }
  } catch (error) {
    console.error('Gemini outreach email generation error:', error)
    return buildFallbackOutreachEmail(input)
  }
}

function normaliseJsonBlock(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  if (fenced) {
    return fenced[1].trim()
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

function enhanceEmailBody(raw: string | null | undefined, context: Pick<OutreachEmailInput, 'callToAction' | 'senderName'>): string {
  const defaultCTA =
    (context.callToAction && context.callToAction.trim()) ||
    'Would love 15 minutes later this week to share more if it resonates.'
  const senderName = context.senderName?.trim() || 'Our team'

  const working = stripHtml(raw ?? '')
  if (!working) {
    return `${defaultCTA}\n\nBest,\n${senderName}`
  }

  const paragraphs = working.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
  let structuredParagraphs = paragraphs.length > 1 ? paragraphs : chunkSentences(working)

  if (!structuredParagraphs.length) {
    structuredParagraphs = [working]
  }

  const lower = working.toLowerCase()
  const ctaKeywords = ['call', 'chat', 'meet', 'meeting', 'schedule', 'time', 'connect', 'discussion', 'discuss', 'conversation']
  const hasCTA =
    lower.includes(defaultCTA.toLowerCase()) || ctaKeywords.some((keyword) => lower.includes(keyword))

  const signoffRegex = /(best|thanks|regards|cheers|sincerely)[\s,]/i
  let existingSignoff: string | null = null

  if (structuredParagraphs.length) {
    const lastParagraph = structuredParagraphs[structuredParagraphs.length - 1]
    if (signoffRegex.test(lastParagraph.toLowerCase())) {
      existingSignoff = lastParagraph
      structuredParagraphs = structuredParagraphs.slice(0, -1)
    }
  }

  if (!hasCTA) {
    structuredParagraphs = [...structuredParagraphs, defaultCTA]
  }

  if (existingSignoff) {
    structuredParagraphs = [...structuredParagraphs, existingSignoff]
  } else if (!signoffRegex.test(lower)) {
    structuredParagraphs = [...structuredParagraphs, `Best,\n${senderName}`]
  }

  return structuredParagraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

function stripHtml(value: string): string {
  return value
    .replace(/```(?:json)?/gi, '')
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]{2,}/g, ' ')
    .trim()
}

function chunkSentences(value: string): string[] {
  const sentences = value.split(/(?<=[.?!])\s+(?=[A-Z0-9])/).map((sentence) => sentence.trim()).filter(Boolean)
  if (!sentences.length) {
    return []
  }

  const paragraphs: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (!current) {
      current = sentence
      continue
    }

    const next = `${current} ${sentence}`.trim()
    if (next.length <= 200) {
      current = next
    } else {
      paragraphs.push(current)
      current = sentence
    }
  }

  if (current) {
    paragraphs.push(current)
  }

  return paragraphs
}
