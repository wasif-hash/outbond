import axios, { AxiosInstance, AxiosRequestConfig, CancelTokenSource } from 'axios'

type ClientOptions = {
  baseURL?: string
  withCredentials?: boolean
}

let cachedClient: AxiosInstance | null = null

function resolveBaseUrl(): string | undefined {
  if (typeof window !== 'undefined') {
    return undefined
  }
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTJS_URL || process.env.VERCEL_URL
}

export function getApiClient(options: ClientOptions = {}): AxiosInstance {
  if (!cachedClient) {
    const defaultConfig: AxiosRequestConfig = {
      baseURL: resolveBaseUrl(),
      withCredentials: true,
    }

    cachedClient = axios.create(defaultConfig)
  }

  if (options.baseURL || options.withCredentials !== undefined) {
    return axios.create({
      baseURL: options.baseURL ?? cachedClient.defaults.baseURL,
      withCredentials: options.withCredentials ?? cachedClient.defaults.withCredentials,
    })
  }

  return cachedClient
}

export function createCancelSource(): CancelTokenSource {
  return axios.CancelToken.source()
}

export type { CancelTokenSource }
