// src/scripts/start-worker.ts
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables first, before any other imports
console.log('🔧 Loading environment variables...')

// Load .env file from project root
const envPath = path.resolve(process.cwd(), '.env')
console.log(`📄 Looking for .env file at: ${envPath}`)

const result = dotenv.config({ path: envPath })

if (result.error) {
  console.warn('⚠️ Could not load .env file:', result.error.message)
  console.log('ℹ️ Make sure .env file exists in project root')
} else {
  console.log('✅ Environment variables loaded successfully')
}

// Validate critical environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL'
]

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:')
  missingEnvVars.forEach(envVar => {
    console.error(`   - ${envVar}`)
  })
  console.error('\nPlease add these variables to your .env file:')
  console.error('DATABASE_URL="postgresql://username:password@localhost:5432/database_name"')
  console.error('REDIS_URL="redis://localhost:6379"')
  process.exit(1)
}

console.log('✅ All required environment variables are present')
console.log(`📊 Environment check:`)
console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`)
console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`)
console.log(`   - REDIS_URL: ${process.env.REDIS_URL ? 'set' : 'not set'}`)

// Now import and start the worker
import { startWorker } from '@/lib/worker'
import { startEmailWorker } from '@/lib/email/email-worker'

console.log('\n🚀 Starting lead fetch worker...')

// Test database connection before starting worker
async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...')
    const { prisma } = await import('@/lib/prisma')
    
    // Simple connection test
    await prisma.$connect()
    console.log('✅ Database connection successful')
    
    // Test a simple query
    await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Database query test successful')
    
    await prisma.$disconnect()
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    console.error('\n🔧 Troubleshooting steps:')
    console.error('1. Check if PostgreSQL is running')
    console.error('2. Verify DATABASE_URL is correct in .env file')
    console.error('3. Run: npm run db:push to sync database schema')
    console.error('4. Check database credentials and permissions')
    return false
  }
}

// Test Redis connection
async function testRedisConnection() {
  try {
    console.log('🔍 Testing Redis connection...')
    const { redis } = await import('@/lib/queue')
    
    await redis.ping()
    console.log('✅ Redis connection successful')
    
    return true
  } catch (error) {
    console.error('❌ Redis connection failed:', error)
    console.error('\n🔧 Troubleshooting steps:')
    console.error('1. Check if Redis server is running')
    console.error('2. Verify REDIS_URL is correct in .env file')
    console.error('3. Install Redis: brew install redis (Mac) or apt install redis (Linux)')
    console.error('4. Start Redis: redis-server')
    return false
  }
}

async function main() {
  try {
    // Test connections before starting worker
    const dbOk = await testDatabaseConnection()
    const redisOk = await testRedisConnection()
    
    if (!dbOk || !redisOk) {
      console.error('❌ Connection tests failed. Worker cannot start.')
      process.exit(1)
    }
    
    console.log('✅ All connections verified')
    
    // Start the worker
    const leadWorker = startWorker()
    const emailWorker = startEmailWorker()
    console.log('✅ Lead fetch worker started successfully')
    console.log('✅ Email send worker started successfully')
    console.log('📊 Workers are now listening for jobs...')
    console.log('📋 Press Ctrl+C to stop the worker')

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📋 Received ${signal}, shutting down worker gracefully...`)
      
      try {
        await leadWorker.close()
        await emailWorker.close()
        console.log('✅ Workers shut down successfully')
        
        // Close Redis connection
        const { redis } = await import('@/lib/queue')
        await redis.quit()
        console.log('✅ Redis connection closed')
        
        process.exit(0)
      } catch (error) {
        console.error('❌ Error during shutdown:', error)
        process.exit(1)
      }
    }

    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error)
      gracefulShutdown('uncaughtException')
    })
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
      gracefulShutdown('unhandledRejection')
    })

  } catch (error) {
    console.error('❌ Failed to start worker:', error)
    process.exit(1)
  }
}

// Start the main function
main().catch((error) => {
  console.error('❌ Critical error in worker startup:', error)
  process.exit(1)
})
