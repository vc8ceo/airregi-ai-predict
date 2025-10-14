import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get distinct sales dates from journal_data using raw SQL for better performance
    const { data: dates, error: datesError } = await supabase.rpc('get_distinct_journal_dates', {
      p_user_id: user.id,
    })

    // Fallback to regular query if RPC doesn't exist
    let uniqueDates: string[] = []

    if (datesError && datesError.code === 'PGRST202') {
      // RPC function doesn't exist, use raw SQL query to get distinct dates efficiently
      console.log('[JOURNAL-DATES] RPC not found, using SQL query with DISTINCT')

      const { data: distinctDates, error: queryError } = await supabase.rpc('exec_sql', {
        query: `
          SELECT DISTINCT sales_date
          FROM journal_data
          WHERE user_id = $1
            AND sales_date IS NOT NULL
          ORDER BY sales_date ASC
        `,
        params: [user.id]
      })

      // If exec_sql RPC also doesn't exist, fall back to fetching all records with pagination
      if (queryError && queryError.code === 'PGRST202') {
        console.log('[JOURNAL-DATES] exec_sql RPC not found, fetching all records with pagination')

        let allDates: Array<{ sales_date: string | null }> = []
        let rangeStart = 0
        const rangeSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data: batch, error: batchError } = await supabase
            .from('journal_data')
            .select('sales_date')
            .eq('user_id', user.id)
            .not('sales_date', 'is', null)
            .order('sales_date', { ascending: true })
            .range(rangeStart, rangeStart + rangeSize - 1)

          if (batchError) {
            console.error('Error fetching journal dates batch:', batchError)
            return NextResponse.json(
              { error: 'Failed to fetch journal dates: ' + batchError.message },
              { status: 500 }
            )
          }

          if (!batch || batch.length === 0) {
            hasMore = false
          } else {
            allDates = allDates.concat(batch)
            hasMore = batch.length === rangeSize
            rangeStart += rangeSize
          }
        }

        // Extract unique dates
        uniqueDates = [...new Set(allDates.map((d) => d.sales_date) || [])].filter(
          (date): date is string => date !== null
        )

        console.log('[JOURNAL-DATES] Total records fetched:', allDates.length)
      } else if (queryError) {
        console.error('Error executing SQL query:', queryError)
        return NextResponse.json(
          { error: 'Failed to fetch journal dates: ' + queryError.message },
          { status: 500 }
        )
      } else {
        // SQL query succeeded
        uniqueDates = distinctDates?.map((d: { sales_date: string }) => d.sales_date) || []
        console.log('[JOURNAL-DATES] SQL DISTINCT query succeeded')
      }
    } else if (datesError) {
      console.error('Error fetching journal dates:', datesError)
      return NextResponse.json(
        { error: 'Failed to fetch journal dates: ' + datesError.message },
        { status: 500 }
      )
    } else {
      // RPC succeeded
      uniqueDates = dates || []
      console.log('[JOURNAL-DATES] RPC succeeded')
    }

    console.log('[JOURNAL-DATES] Unique dates:', uniqueDates.length)
    console.log('[JOURNAL-DATES] Sample dates (first 5):', uniqueDates.slice(0, 5))
    console.log('[JOURNAL-DATES] Sample dates (last 5):', uniqueDates.slice(-5))

    return NextResponse.json({
      dates: uniqueDates,
      count: uniqueDates.length,
    })
  } catch (error: unknown) {
    console.error('Error in journal-dates API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
