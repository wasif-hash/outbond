// scripts/instantly-demo.ts

import { InstantlyClient } from '../src/lib/instantly'

async function main() {
  console.log('🚀 Starting Instantly API v2 Demo')
  console.log('=====================================')
  
  const client = new InstantlyClient()
  
  try {
    // Step 1: Get account info
    console.log('\n📋 Step 1: Getting account information')
    const accountInfo = await client.getAccountInfo()
    console.log('✅ Account info:', accountInfo)
    
    // Step 2: Create lead list
    console.log('\n📝 Step 2: Creating lead list')
    const listId = await client.createLeadList('SaaS Lawyers – Toronto', true)
    console.log(`✅ Created lead list with ID: ${listId}`)
    
    // Step 3: Attach enrichment
    console.log('\n🔗 Step 3: Attaching work_email_enrichment')
    await client.attachEnrichment(listId, 'work_email_enrichment')
    console.log('✅ Enrichment attached successfully')
    
    // Step 4: Import from SuperSearch
    console.log('\n🔍 Step 4: Importing leads from SuperSearch')
    const searchFilters = {
      locations: [{ value: "Toronto", type: "city" }],
      department: ["Legal"],
      level: ["Owner", "Director"],
      employee_count: ["25 - 100", "100 - 250"],
      keywords: ["SaaS", "law firm"]
    }
    
    const importResult = await client.importFromSuperSearch({
      listId,
      limit: 50,
      skipNoEmail: true,
      searchFilters
    })
    
    console.log('✅ Import job started:', importResult)
    
    // Step 5: Wait for enrichment to complete
    console.log('\n⏳ Step 5: Waiting for enrichment to complete')
    if (importResult.jobId) {
      await client.waitForJob(importResult.jobId)
    } else {
      await client.waitForEnrichment(listId)
    }
    console.log('✅ Enrichment completed')
    
    // Step 6: List imported leads
    console.log('\n📋 Step 6: Listing imported leads')
    let totalLeads = 0
    let pageCount = 0
    
    for await (const leads of client.listLeads({ 
      listId, 
      limit: 20 
    })) {
      pageCount++
      totalLeads += leads.length
      
      console.log(`\n📄 Page ${pageCount}: ${leads.length} leads`)
      
      // Print first few leads as examples
      leads.slice(0, 3).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.first_name} ${lead.last_name}`)
        console.log(`     Email: ${lead.email}`)
        console.log(`     Company: ${lead.company}`)
        console.log(`     Job Title: ${lead.job_title}`)
        console.log(`     Location: ${lead.location}`)
        console.log(`     Created: ${new Date(lead.timestamp_created).toLocaleString()}`)
        console.log('')
      })
      
      if (leads.length < 20) {
        console.log('📋 No more pages available')
        break
      }
    }
    
    console.log(`\n🎉 Demo completed successfully!`)
    console.log(`📊 Total leads imported: ${totalLeads}`)
    console.log(`📄 Total pages: ${pageCount}`)
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error)
    
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      if (error.stack) {
        console.error('Stack trace:', error.stack)
      }
    }
    
    process.exit(1)
  }
}

// Run the demo
if (require.main === module) {
  main().catch(console.error)
}

export { main as runInstantlyDemo }
