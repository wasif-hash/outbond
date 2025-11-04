// src/lib/rate-limit.ts
import { redis } from './queue'
import { prisma } from './prisma'

export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private maxTokens: number
  private refillRate: number
  private refillTime: number

  constructor(tokensPerSecond: number, refillTime: number = 1000, maxBurst: number = tokensPerSecond) {
    this.tokens = maxBurst
    this.lastRefill = Date.now()
    this.maxTokens = maxBurst
    this.refillRate = tokensPerSecond
    this.refillTime = refillTime
  }

  async acquire(tokens: number = 1): Promise<void> {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    
    if (timePassed >= this.refillTime) {
      // Calculate how many tokens to add based on time passed
      const refills = Math.floor(timePassed / this.refillTime)
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + (refills * this.refillRate)
      )
      this.lastRefill = now
    }

    if (this.tokens < tokens) {
      // Calculate wait time needed for enough tokens
      const tokensNeeded = tokens - this.tokens
      const waitTime = Math.ceil(
        (tokensNeeded / this.refillRate) * this.refillTime
      )
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return this.acquire(tokens)
    }

    this.tokens -= tokens
  }

  async check(): Promise<boolean> {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    
    if (timePassed >= this.refillTime) {
      const refills = Math.floor(timePassed / this.refillTime)
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + (refills * this.refillRate)
      )
      this.lastRefill = now
    }

    return this.tokens >= 1
  }
}

export interface RateLimitConfig {
  maxTokens: number
  refillRate: number // tokens per second
  key: string
}

export class TokenBucketRateLimit {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  async checkAndConsume(tokens: number = 1): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const key = `rate_limit:${this.config.key}`

    // Use Redis Lua script for atomic operations
    const luaScript = `
      local key = KEYS[1]
      local max_tokens = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local tokens_requested = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local current_tokens = tonumber(bucket[1]) or max_tokens
      local last_refill = tonumber(bucket[2]) or now
      
      -- Calculate tokens to add based on time elapsed
      local time_elapsed = (now - last_refill) / 1000
      local tokens_to_add = time_elapsed * refill_rate
      current_tokens = math.min(max_tokens, current_tokens + tokens_to_add)
      
      local allowed = current_tokens >= tokens_requested
      if allowed then
        current_tokens = current_tokens - tokens_requested
      end
      
      -- Update bucket
      redis.call('HMSET', key, 'tokens', current_tokens, 'last_refill', now)
      redis.call('EXPIRE', key, 3600) -- Expire after 1 hour of inactivity
      
      local reset_time = 0
      if not allowed then
        reset_time = now + ((tokens_requested - current_tokens) / refill_rate * 1000)
      end
      
      return {allowed and 1 or 0, math.floor(current_tokens), reset_time}
    `

    const result = await redis.eval(
      luaScript,
      1,
      key,
      this.config.maxTokens,
      this.config.refillRate,
      tokens,
      now
    ) as [number, number, number]

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      resetTime: result[2],
    }
  }

  async getRemainingTokens(): Promise<number> {
    const key = `rate_limit:${this.config.key}`
    const bucket = await redis.hmget(key, 'tokens', 'last_refill')
    
    if (!bucket[0] || !bucket[1]) {
      return this.config.maxTokens
    }

    const currentTokens = parseFloat(bucket[0])
    const lastRefill = parseFloat(bucket[1])
    const now = Date.now()
    const timeElapsed = (now - lastRefill) / 1000
    const tokensToAdd = timeElapsed * this.config.refillRate
    
    return Math.min(this.config.maxTokens, currentTokens + tokensToAdd)
  }
}

const sanitizeKey = (raw: string): string => {
  const trimmed = raw.trim().toLowerCase()
  const sanitized = trimmed.replace(/[^a-z0-9:_-]/g, '')
  return sanitized.length > 0 ? sanitized : 'unknown'
}

export const createUserRateLimit = (userId: string) => new TokenBucketRateLimit({
  key: `user:${sanitizeKey(userId)}`,
  maxTokens: 50, // 50 requests per user
  refillRate: 2, // 2 requests per second per user
})

export const createCampaignRateLimit = (campaignId: string) => new TokenBucketRateLimit({
  key: `campaign:${sanitizeKey(campaignId)}`,
  maxTokens: 20, // 20 requests per campaign
  refillRate: 1, // 1 request per second per campaign
})

export const createEmailSendRateLimit = (userId: string) => new TokenBucketRateLimit({
  key: `email-send:${sanitizeKey(userId)}`,
  maxTokens: 5,
  refillRate: 1,
})

export const createLoginRateLimit = (identifier: string) =>
  new TokenBucketRateLimit({
    key: `login:${sanitizeKey(identifier)}`,
    maxTokens: 5, // allow short bursts of login attempts
    refillRate: 5 / 60, // refill bucket roughly once per minute
  })

export const createAdminActionRateLimit = (identifier: string) =>
  new TokenBucketRateLimit({
    key: `admin-action:${sanitizeKey(identifier)}`,
    maxTokens: 20, // limit privileged operations
    refillRate: 20 / (30 * 60), // ~20 actions per 30 minutes
  })

export const createAccountActionRateLimit = (identifier: string) =>
  new TokenBucketRateLimit({
    key: `account-action:${sanitizeKey(identifier)}`,
    maxTokens: 10, // allow reasonable account updates
    refillRate: 10 / (15 * 60), // ~10 actions per 15 minutes
  })

// Distributed locking for preventing concurrent job execution
export class RedisLock {
  private key: string
  private ttl: number
  private ownerId: string

  constructor(key: string, ttl: number = 300000) { // 5 minutes default
    this.key = `lock:${key}`
    this.ttl = ttl
    this.ownerId = `${process.pid}-${Date.now()}-${Math.random()}`
  }

  async acquire(): Promise<boolean> {
    const result = await redis.set(this.key, this.ownerId, 'PX', this.ttl, 'NX')
    return result === 'OK'
  }

  async release(): Promise<boolean> {
    const luaScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `
    
    const result = await redis.eval(luaScript, 1, this.key, this.ownerId)
    return result === 1
  }

  async extend(additionalTtl: number = 300000): Promise<boolean> {
    const luaScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('PEXPIRE', KEYS[1], ARGV[2])
      else
        return 0
      end
    `
    
    const result = await redis.eval(luaScript, 1, this.key, this.ownerId, additionalTtl)
    return result === 1
  }
}

// Database-based rate limit tracking (for persistent limits)
export async function updateDatabaseRateLimit(key: string, config: RateLimitConfig) {
  const now = new Date()
  
  return prisma.rateLimit.upsert({
    where: { key },
    update: {
      lastRefill: now,
    },
    create: {
      key,
      tokens: config.maxTokens,
      lastRefill: now,
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
    },
  })
}
