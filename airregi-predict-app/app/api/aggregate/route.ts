import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { user_id } = await request.json()

    if (user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log('Starting aggregation for user:', user.id)

    // Get all unique dates from journal_data
    const { data: dates, error: datesError } = await supabase
      .from('journal_data')
      .select('sales_date')
      .eq('user_id', user.id)

    if (datesError) {
      throw new Error('日付の取得に失敗しました: ' + datesError.message)
    }

    if (!dates || dates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'ジャーナルデータが見つかりませんでした',
        dates_processed: 0,
      })
    }

    // Get unique dates
    const uniqueDates = [...new Set(dates.map((d) => d.sales_date).filter((d) => d))]
    console.log(`Found ${uniqueDates.length} unique dates to aggregate`)

    let processedCount = 0

    for (const dateStr of uniqueDates) {
      // Get all journal data for this user and date
      const { data: dayData, error: dayError } = await supabase
        .from('journal_data')
        .select('receipt_no, subtotal, tax_amount')
        .eq('user_id', user.id)
        .eq('sales_date', dateStr)

      if (!dayError && dayData && dayData.length > 0) {
        // Calculate aggregates
        const visitorCount = new Set(dayData.map((d) => d.receipt_no)).size
        const salesAmount = dayData.reduce((sum, d) => {
          const subtotal = typeof d.subtotal === 'number' ? d.subtotal : parseFloat(d.subtotal || '0')
          const taxAmount = typeof d.tax_amount === 'number' ? d.tax_amount : parseFloat(d.tax_amount || '0')
          return sum + subtotal + taxAmount
        }, 0)
        const avgPerCustomer = visitorCount > 0 ? salesAmount / visitorCount : 0

        // Get day of week (0 = Sunday, 6 = Saturday)
        const dayOfWeek = new Date(dateStr).getDay()

        // Insert or update daily_aggregated
        const { error: aggError } = await supabase
          .from('daily_aggregated')
          .upsert(
            {
              user_id: user.id,
              date: dateStr,
              visitor_count: visitorCount,
              sales_amount: salesAmount,
              avg_per_customer: avgPerCustomer,
              day_of_week: dayOfWeek,
              is_holiday: false,
            },
            {
              onConflict: 'user_id,date',
            }
          )

        if (aggError) {
          console.error('Error aggregating data for date', dateStr, aggError)
        } else {
          processedCount++
        }
      }
    }

    console.log(`Aggregation complete. Processed ${processedCount} dates`)

    return NextResponse.json({
      success: true,
      message: `${processedCount}日分のデータを集計しました`,
      dates_processed: processedCount,
    })
  } catch (error: unknown) {
    console.error('Aggregation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '集計処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
