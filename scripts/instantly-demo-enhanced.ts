// scripts/instantly-demo-enhanced.ts

import { InstantlyClient } from '../src/lib/instantly'

async function main() {
  console.log('🚀 Starting Enhanced Instantly API v2 Demo')
  console.log('==========================================')
  
  const client = new InstantlyClient()
  
  try {
    // Step 1: Get account info
    console.log('\n📋 Step 1: Getting account information')
    const accountInfo = await client.getAccountInfo()
    console.log('✅ Account info:', accountInfo)
    
    // Step 2: List existing lead lists
    console.log('\n📋 Step 2: Listing existing lead lists')
    const existingLists = await client.getLeadLists({ limit: 5 })
    console.log(`✅ Found ${existingLists.items.length} existing lead lists`)
    
    if (existingLists.items.length > 0) {
      console.log('📄 Existing lists:')
      existingLists.items.forEach((list, index) => {
        console.log(`  ${index + 1}. ${list.name} (ID: ${list.id})`)
        console.log(`     Created: ${new Date(list.timestamp_created).toLocaleString()}`)
        console.log(`     Has enrichment: ${list.has_enrichment_task}`)
        console.log('')
      })
    }
    
    // Step 3: Create a new lead list
    console.log('\n📝 Step 3: Creating a new lead list')
    const listName = `Enhanced Demo - SaaS Lawyers – Toronto - ${new Date().toISOString().split('T')[0]}`
    const listId = await client.createLeadList(listName, true)
    console.log(`✅ Created lead list with ID: ${listId}`)
    
    // Step 4: Get the created lead list details
    console.log('\n📋 Step 4: Getting lead list details')
    const leadListDetails = await client.getLeadList(listId)
    console.log('✅ Lead list details:', {
      name: leadListDetails.name,
      id: leadListDetails.id,
      organization_id: leadListDetails.organization_id,
      has_enrichment_task: leadListDetails.has_enrichment_task,
      created: new Date(leadListDetails.timestamp_created).toLocaleString()
    })
    
    // Step 5: Try to attach enrichment (with fallback)
    console.log('\n🔗 Step 5: Attaching enrichment')
    try {
      await client.attachEnrichment(listId, 'work_email_enrichment')
      console.log('✅ Enrichment attached successfully')
    } catch (error) {
      console.log('⚠️ Enrichment attachment failed, continuing without enrichment...')
    }
    
    // Step 6: Try SuperSearch import
    console.log('\n🔍 Step 6: Importing leads from SuperSearch')
    const searchFilters = {
      locations: [{ value: "Toronto", type: "city" }],
      department: ["Legal"],
      level: ["Owner", "Director"],
      employee_count: ["25 - 100", "100 - 250"],
      keywords: ["SaaS", "law firm"]
    }
    
    let importResult: any = null
    let leads: any[] = []
    let pageCount = 0
    
    try {
      importResult = await client.importFromSuperSearch({
        listId,
        limit: 20,
        skipNoEmail: true,
        searchFilters
      })
      
      console.log('✅ SuperSearch import job started:', importResult)
      
      // Wait for completion (with timeout)
      try {
        if (importResult.jobId) {
          await client.waitForJob(importResult.jobId, 120000) // 2 minute timeout
        } else {
          await client.waitForEnrichment(listId, 120000) // 2 minute timeout
        }
        console.log('✅ SuperSearch completed')
      } catch (timeoutError) {
        console.log('⏰ SuperSearch timeout, but continuing to test listing...')
      }
      
      // List SuperSearch results
      console.log('\n📋 Step 7: Listing SuperSearch imported leads')
      for await (const page of client.listLeads({ listId, limit: 10 })) {
        pageCount++
        leads.push(...page)
        console.log(`📄 Page ${pageCount}: ${page.length} leads`)
        
        if (page.length === 0 || pageCount >= 3) break // Limit to 3 pages for demo
      }
      
    } catch (superSearchError) {
      console.log('⚠️ SuperSearch failed, trying direct search as fallback...')
      
      // Fallback: Direct lead search
      const searchQuery = `CEO Toronto SaaS`
      
      try {
        const directSearchResult = await client.searchLeadsDirectly({
          search: searchQuery,
          filter: "FILTER_VAL_UNCONTACTED",
          limit: 10
        })
        
        console.log(`✅ Direct search found ${directSearchResult.data.length} leads`)
        leads = directSearchResult.data
        pageCount = 1
        
      } catch (directSearchError) {
        console.error('❌ Direct search also failed:', directSearchError)
        throw directSearchError
      }
    }
    
    // Step 8: Display results
    console.log('\n📊 Step 8: Results Summary')
    console.log(`📈 Total leads found: ${leads.length}`)
    console.log(`📄 Total pages processed: ${pageCount}`)
    
    if (leads.length > 0) {
      console.log('\n📋 Sample leads:')
      leads.slice(0, 3).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.first_name} ${lead.last_name}`)
        console.log(`     Email: ${lead.email}`)
        console.log(`     Company: ${lead.company}`)
        console.log(`     Job Title: ${lead.job_title}`)
        console.log(`     Location: ${lead.location}`)
        console.log(`     Created: ${new Date(lead.timestamp_created).toLocaleString()}`)
        console.log('')
      })
    }
    
    // Step 9: Get verification stats (if available)
    console.log('\n📊 Step 9: Getting verification statistics')
    try {
      const verificationStats = await client.getLeadListVerificationStats(listId)
      console.log('✅ Verification stats:', {
        total_leads: verificationStats.total_leads,
        verified: verificationStats.stats.verified,
        invalid: verificationStats.stats.invalid,
        risky: verificationStats.stats.risky
      })
    } catch (error) {
      console.log('⚠️ Could not get verification stats (may not be available yet)')
    }
    
    // Step 10: Update lead list
    console.log('\n📝 Step 10: Updating lead list')
    const updatedList = await client.updateLeadList(listId, {
      name: `${listName} - Updated`,
      has_enrichment_task: true
    })
    console.log('✅ Lead list updated:', updatedList.name)
    
    // Step 11: List all lead lists again
    console.log('\n📋 Step 11: Listing all lead lists after operations')
    const finalLists = await client.getLeadLists({ limit: 10 })
    console.log(`✅ Total lead lists: ${finalLists.items.length}`)
    
    console.log('\n🎉 Enhanced demo completed successfully!')
    console.log(`📊 Summary:`)
    console.log(`  - Lead lists created: 1`)
    console.log(`  - Leads found: ${leads.length}`)
    console.log(`  - Pages processed: ${pageCount}`)
    console.log(`  - Total lead lists in account: ${finalLists.items.length}`)
    
    // Optional: Clean up the demo list
    console.log('\n🗑️ Optional: Clean up demo list')
    const shouldCleanup = process.argv.includes('--cleanup')
    if (shouldCleanup) {
      try {
        await client.deleteLeadList(listId)
        console.log('✅ Demo lead list deleted')
      } catch (error) {
        console.log('⚠️ Could not delete demo list:', error)
      }
    } else {
      console.log('ℹ️ Demo lead list kept (use --cleanup flag to delete)')
    }
    
  } catch (error) {
    console.error('\n❌ Enhanced demo failed:', error)
    
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      if (error.stack) {
        console.error('Stack trace:', error.stack)
      }
    }
    
    process.exit(1)
  }
}

// Run the enhanced demo
if (require.main === module) {
  main().catch(console.error)
}

export { main as runEnhancedInstantlyDemo }
