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

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>
  }
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
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

export async function generateGeminiLeadSummary(input: GeminiSummaryInput): Promise<string | null> {
  const client = getGeminiClient()
  if (!client) {
    return null
  }

  const prompt = buildPrompt(input)
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
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

function extractSummaryText(response: any): string | null {
  const candidate = response?.response?.candidates?.find(Boolean)
  if (candidate?.content?.parts?.length) {
    const textPart = candidate.content.parts.find((part: any) => typeof part.text === 'string')
    if (textPart?.text) {
      return textPart.text
    }
  }

  if (typeof response?.output_text === 'string') {
    return response.output_text
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
