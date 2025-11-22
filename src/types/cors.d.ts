declare module "cors" {
  import type { IncomingMessage, ServerResponse } from "http"

  type StaticOrigin = boolean | string | RegExp | Array<string | RegExp>
  type CustomOrigin = (requestOrigin: string | undefined, callback: (error: Error | null, origin?: StaticOrigin) => void) => void

  interface CorsOptions {
    origin?: StaticOrigin | CustomOrigin
    methods?: string | string[]
    allowedHeaders?: string | string[]
    exposedHeaders?: string | string[]
    credentials?: boolean
    maxAge?: number
    preflightContinue?: boolean
    optionsSuccessStatus?: number
  }

  type CorsMiddleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void

  function cors(options?: CorsOptions): CorsMiddleware

  export = cors
}
