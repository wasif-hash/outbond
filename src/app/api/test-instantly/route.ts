import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { InstantlyClient } from '@/lib/instantly'

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { niche_or_job_title, location, keywords } = body

    console.log('🧪 Testing Instantly API v2 with params:', { niche_or_job_title, location, keywords })

    const client = new InstantlyClient()

    // Test account info first
    try {
      const accountInfo = await client.getAccountInfo()
      console.log('✅ Account info retrieved:', accountInfo)
    } catch (error) {
      console.error('❌ Account info failed:', error)
    }

    // Test lead lists
    try {
      const leadLists = await client.getLeadLists({ limit: 10 })
      console.log('✅ Lead lists retrieved:', leadLists.items.length, 'lists found')
    } catch (error) {
      console.error('❌ Lead lists failed:', error)
    }

    // Test the complete flow
    console.log('🚀 Testing complete Instantly API v2 flow...')
    
    // Step 1: Create lead list
    const listName = `Test List - ${niche_or_job_title || 'CEO'} - ${location || 'Toronto'}`
    const listId = await client.createLeadList(listName, true)
    console.log(`✅ Created test lead list: ${listId}`)
    
    // Step 2: Try to attach enrichment (with fallback)
    try {
      await client.attachEnrichment(listId, 'work_email_enrichment')
      console.log('✅ Attached enrichment')
    } catch (error) {
      console.log('⚠️ Enrichment attachment failed, continuing without enrichment...')
    }
    
    // Step 3: Try SuperSearch import first, then fallback
    let importResult: any = null
    let leads: any[] = []
    let pageCount = 0
    
    try {
      // Try SuperSearch import
      const searchFilters = {
        locations: location ? [{ value: location, type: "city" }] : [{ value: "Toronto", type: "city" }],
        department: [niche_or_job_title || 'CEO'],
        level: ["Owner", "Director", "VP"],
        employee_count: ["25 - 100", "100 - 250"],
        keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) : ['SaaS', 'technology']
      }
      
      importResult = await client.importFromSuperSearch({
        listId,
        limit: 10,
        skipNoEmail: true,
        searchFilters
      })
      
      console.log('✅ SuperSearch import job started:', importResult)
      
      // Wait for completion (with timeout)
      try {
        if (importResult.jobId) {
          await client.waitForJob(importResult.jobId, 60000) // 1 minute timeout
        } else {
          await client.waitForEnrichment(listId, 60000) // 1 minute timeout
        }
        console.log('✅ SuperSearch completed')
      } catch (timeoutError) {
        console.log('⏰ SuperSearch timeout, but continuing to test listing...')
      }
      
      // List SuperSearch results
      for await (const page of client.listLeads({ listId, limit: 5 })) {
        pageCount++
        leads.push(...page)
        console.log(`📄 Page ${pageCount}: ${page.length} leads`)
        
        if (page.length === 0 || pageCount >= 2) break // Limit to 2 pages for testing
      }
      
    } catch (superSearchError) {
      console.log('⚠️ SuperSearch failed, trying direct search as fallback...')
      
      // Fallback: Direct lead search
      const searchQuery = `${niche_or_job_title || 'CEO'} ${location || 'Toronto'} ${keywords || 'SaaS'}`.trim()
      
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

    return NextResponse.json({
      success: true,
      testFlow: {
        listId,
        listName,
        importResult,
        totalLeads: leads.length,
        leads: leads.slice(0, 3), // Return first 3 leads for testing
        pageCount
      }
    })

  } catch (error) {
    console.error('Test Instantly API error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
