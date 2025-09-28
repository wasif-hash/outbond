// src/scripts/start-worker.ts
import { startWorker } from '@/lib/worker'

console.log('Starting lead fetch worker...')

// Start the worker
const worker = startWorker()

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down worker gracefully...')
  await worker.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down worker gracefully...')
  await worker.close()
  process.exit(0)
})

console.log('Worker started successfully. Waiting for jobs...')

// package.json scripts section to add:
/*
{
  "scripts": {
    "worker": "tsx src/scripts/start-worker.ts",
    "worker:dev": "tsx watch src/scripts/start-worker.ts"
  }
}
*/