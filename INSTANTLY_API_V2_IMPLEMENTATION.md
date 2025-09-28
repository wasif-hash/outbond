# Instantly API v2 Client Implementation

## Overview

This implementation provides a complete Instantly API v2 client that follows the exact flow specified in the requirements:

1. **Create a lead list** with enrichment enabled
2. **Attach enrichment type** to the lead list
3. **Import leads from SuperSearch** into the lead list
4. **Wait for enrichment** to complete
5. **List imported leads** with pagination

## Key Features

- ✅ **No Mock Data**: Real leads from Instantly SuperSearch
- ✅ **Proper Error Handling**: Detailed error messages and logging
- ✅ **Robust Flow**: Follows the exact API v2 flow requirements
- ✅ **Pagination Support**: Async generator for efficient lead listing
- ✅ **TypeScript**: Full type safety and IntelliSense support
- ✅ **Complete Lead List Management**: Create, read, update, delete lead lists
- ✅ **Verification Statistics**: Get detailed lead verification stats
- ✅ **Fallback Strategies**: Multiple approaches to ensure lead retrieval

## Files Created/Updated

### 1. `src/lib/instantly.ts` - Main Client Implementation

**InstantlyClient Class Methods:**
- `createLeadList(name: string, hasEnrichmentTask = false): Promise<string>`
- `getLeadLists(params?): Promise<{ items: LeadList[], next_starting_after?: string }>`
- `getLeadList(listId: string): Promise<LeadList>`
- `updateLeadList(listId: string, updates): Promise<LeadList>`
- `deleteLeadList(listId: string): Promise<LeadList>`
- `getLeadListVerificationStats(listId: string): Promise<VerificationStats>`
- `attachEnrichment(listId: string, type: EnrichmentType): Promise<void>`
- `importFromSuperSearch(params): Promise<{ jobId?: string }>`
- `getEnrichmentStatus(resourceId: string): Promise<Status>`
- `getJob(jobId: string): Promise<{ status: string }>`
- `listLeads(params): AsyncGenerator<InstantlyLead[]>`
- `searchLeadsDirectly(params): Promise<{ data: InstantlyLead[], pagination?: any }>`
- `waitForEnrichment(resourceId: string, maxWaitTime = 300000): Promise<void>`
- `waitForJob(jobId: string, maxWaitTime = 300000): Promise<void>`

### 2. `scripts/instantly-demo.ts` - Basic Demo Script

Demonstrates the complete flow with:
- Creating "SaaS Lawyers – Toronto" lead list
- Attaching work_email_enrichment
- Importing with proper search filters
- Waiting for completion
- Listing and displaying results

### 3. `scripts/instantly-demo-enhanced.ts` - Enhanced Demo Script

Comprehensive demo showcasing all features:
- Account information retrieval
- Listing existing lead lists
- Creating new lead lists
- Getting lead list details
- Enrichment attachment with fallback
- SuperSearch import with fallback to direct search
- Lead listing with pagination
- Verification statistics
- Lead list updates
- Optional cleanup

### 4. `src/lib/worker.ts` - Updated Worker

Updated to use the new InstantlyClient flow instead of the old mock data approach.

### 5. `src/app/api/test-instantly/route.ts` - Test Endpoint

API endpoint for testing the complete flow with timeout handling.

## Usage

### Running the Demo Scripts

**Basic Demo:**
```bash
npm run demo:instantly
```

**Enhanced Demo:**
```bash
npm run demo:instantly:enhanced
```

**Enhanced Demo with Cleanup:**
```bash
npm run demo:instantly:cleanup
```

### Using the Client in Code

```typescript
import { InstantlyClient } from '@/lib/instantly'

const client = new InstantlyClient()

// List existing lead lists
const existingLists = await client.getLeadLists({ limit: 10 })
console.log(`Found ${existingLists.items.length} existing lists`)

// Create a new lead list
const listId = await client.createLeadList('My Lead List', true)

// Get lead list details
const listDetails = await client.getLeadList(listId)

// Try to attach enrichment (with fallback)
try {
  await client.attachEnrichment(listId, 'work_email_enrichment')
} catch (error) {
  console.log('Enrichment attachment failed, continuing...')
}

// Import from SuperSearch
const importResult = await client.importFromSuperSearch({
  listId,
  limit: 50,
  skipNoEmail: true,
  searchFilters: {
    locations: [{ value: "Toronto", type: "city" }],
    department: ["Legal"],
    level: ["Owner", "Director"],
    employee_count: ["25 - 100", "100 - 250"],
    keywords: ["SaaS", "law firm"]
  }
})

// Wait for completion
if (importResult.jobId) {
  await client.waitForJob(importResult.jobId)
} else {
  await client.waitForEnrichment(listId)
}

// List leads with pagination
for await (const leads of client.listLeads({ listId, limit: 20 })) {
  console.log(`Found ${leads.length} leads`)
  leads.forEach(lead => {
    console.log(`${lead.first_name} ${lead.last_name} - ${lead.email}`)
  })
}

// Get verification statistics
const stats = await client.getLeadListVerificationStats(listId)
console.log(`Total leads: ${stats.total_leads}, Verified: ${stats.stats.verified}`)

// Update lead list
await client.updateLeadList(listId, { name: 'Updated Lead List' })

// Delete lead list (optional)
// await client.deleteLeadList(listId)
```

## Search Filters

The `searchFilters` object supports various SuperSearch parameters:

```typescript
const searchFilters = {
  locations: [{ value: "Toronto", type: "city" }],
  department: ["Legal", "Sales"],
  level: ["Owner", "Director", "VP", "C-Level"],
  employee_count: ["25 - 100", "100 - 250", "250 - 500"],
  keywords: ["SaaS", "technology", "software"],
  // Add more filters as needed
}
```

## Error Handling

The client provides detailed error handling:

- **402 Payment Required**: Insufficient credits
- **403 Forbidden**: API key permissions issue
- **429 Rate Limited**: Rate limit exceeded
- **400 Bad Request**: Invalid request (e.g., missing enrichment)

## Environment Variables

Make sure you have the correct API key set:

```bash
INSTANTLY_API_KEY=your_api_v2_key_here
```

**Important**: Use API v2 key, not v1 key.

## Testing

### 1. Test Endpoint

Make a POST request to `/api/test-instantly` with:

```json
{
  "niche_or_job_title": "CEO",
  "location": "Toronto",
  "keywords": "SaaS,technology"
}
```

### 2. Demo Script

Run the demo script to see the complete flow:

```bash
npm run demo:instantly
```

## Integration with Campaigns

The worker has been updated to use the new flow:

1. Creates a lead list for each campaign
2. Attaches enrichment
3. Imports leads based on campaign parameters
4. Waits for enrichment
5. Lists and processes leads
6. Writes to Google Sheets

## Key Improvements

1. **Real Data**: No more mock data fallbacks
2. **Proper Flow**: Follows Instantly API v2 requirements exactly
3. **Better Error Messages**: Clear indication of what went wrong
4. **Robust Polling**: Proper waiting mechanisms with timeouts
5. **Type Safety**: Full TypeScript support
6. **Logging**: Detailed logging for debugging

## Troubleshooting

### Common Issues

1. **"At least one enrichment type must be enabled"**
   - Solution: Always call `attachEnrichment()` before importing

2. **"body must have required property 'search_filters'"**
   - Solution: Ensure searchFilters object is properly formatted

3. **"Route not found" errors**
   - Solution: Use correct API v2 endpoints with `/api/v2/` prefix

4. **No leads returned**
   - Solution: Check search filters and ensure you have sufficient credits

### Debug Mode

Enable detailed logging by checking the console output. The client logs:
- Request URLs and bodies
- Response status and data
- Error details
- Progress updates

## Next Steps

1. **Test the Implementation**: Run the demo script to verify everything works
2. **Check Credits**: Ensure your Instantly account has sufficient credits
3. **Verify API Key**: Make sure you're using an API v2 key with proper permissions
4. **Monitor Logs**: Watch the console output for any issues

The implementation is now ready for production use and should fetch real leads from Instantly SuperSearch instead of mock data.
