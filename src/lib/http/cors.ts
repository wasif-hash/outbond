import Cors from "cors"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

type HeaderEntry = { name: string; value: string }
type SimpleCorsRequest = {
  method?: string
  headers: Record<string, string>
}
type CorsMiddleware = (req: SimpleCorsRequest, res: MockResponse, next: (err?: unknown) => void) => void

const DEFAULT_METHODS = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]
const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Authorization", "Accept", "X-Requested-With"]

const parseOrigins = () => {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }
  const fallbacks = [process.env.NEXTJS_URL, process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"].filter(
    Boolean,
  ) as string[]
  return fallbacks.length > 0 ? fallbacks : ["*"]
}

const allowedOrigins = parseOrigins()
const allowAnyOrigin = allowedOrigins.includes("*")

const corsInstance = Cors({
  origin: allowAnyOrigin ? true : allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  credentials: true,
  methods: DEFAULT_METHODS,
  allowedHeaders: DEFAULT_ALLOWED_HEADERS,
}) as unknown as CorsMiddleware

class MockResponse {
  private headers = new Map<string, HeaderEntry>()
  public statusCode = 200
  public ended = false
  public body: BodyInit | null = null

  setHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), { name, value })
  }

  getHeader(name: string) {
    return this.headers.get(name.toLowerCase())?.value ?? undefined
  }

  headerEntries(): HeaderEntry[] {
    return Array.from(this.headers.values())
  }

  end(body?: BodyInit | null) {
    this.ended = true
    this.body = body ?? null
  }
}

const toCorsRequest = (request: NextRequest): SimpleCorsRequest => {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })
  return {
    method: request.method,
    headers,
  }
}

const runCors = (request: NextRequest) => {
  const req = toCorsRequest(request)
  const res = new MockResponse()

  return new Promise<{ response: MockResponse }>((resolve, reject) => {
    corsInstance(req, res, (result: unknown) => {
      if (result instanceof Error) {
        reject(result)
      } else {
        resolve({ response: res })
      }
    })
  })
}

export type CorsContext = {
  isPreflight: boolean
  statusCode: number
  apply: (response: Response) => Response
  respond: (body?: BodyInit | null, init?: ResponseInit) => Response
}

export async function ensureCors(request: NextRequest): Promise<CorsContext> {
  const { response } = await runCors(request)
  const headers = response.headerEntries()
  const applyHeaders = (target: Headers) => {
    headers.forEach(({ name, value }) => {
      target.set(name, value)
    })
  }

  return {
    isPreflight: response.ended && request.method.toUpperCase() === "OPTIONS",
    statusCode: response.statusCode ?? 204,
    apply: (res: Response) => {
      const next = new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      })
      applyHeaders(next.headers)
      return next
    },
    respond: (body?: BodyInit | null, init?: ResponseInit) => {
      const next = new NextResponse(body ?? response.body, {
        status: init?.status ?? response.statusCode ?? 204,
        statusText: init?.statusText,
        headers: init?.headers,
      })
      applyHeaders(next.headers)
      return next
    },
  }
}
