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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('user_id') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are allowed' },
        { status: 400 }
      )
    }

    // Create upload history record
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('upload_history')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        status: 'processing',
      })
      .select()
      .single()

    if (uploadError) {
      throw new Error('Failed to create upload record')
    }

    try {
      // Read file content
      const fileContent = await file.text()
      const lines = fileContent.split('\n').filter((line) => line.trim())
      const rowCount = lines.length - 1 // Exclude header

      // Parse CSV (simplified - in production, use a proper CSV parser like papaparse)
      const rows = lines.slice(1).map((line) => {
        const values = line.split(',')
        return {
          user_id: user.id,
          upload_id: uploadRecord.id,
          receipt_no: values[0]?.trim() || '',
          sales_date: values[2]?.trim() || '',
          sales_time: values[3]?.trim() || '',
          product_name: values[4]?.trim() || null,
          category: values[5]?.trim() || null,
          quantity: parseFloat(values[19]) || 0,
          unit_price: parseFloat(values[20]) || 0,
          subtotal: parseFloat(values[30]) || 0,
          discount_amount: parseFloat(values[32]) || 0,
          tax_amount: parseFloat(values[41]) || 0,
          payment_method: values[53]?.trim() || null,
        }
      })

      // Insert data in batches (Supabase has a limit on batch size)
      const batchSize = 1000
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { error: insertError } = await supabase
          .from('journal_data')
          .insert(batch)

        if (insertError) {
          throw new Error(`Failed to insert batch: ${insertError.message}`)
        }
      }

      // Aggregate daily data
      // Get unique dates from uploaded data
      const uniqueDates = [...new Set(rows.map((r) => r.sales_date).filter((d) => d))]

      for (const dateStr of uniqueDates) {
        // Get all journal data for this user and date
        const { data: dayData, error: dayError } = await supabase
          .from('journal_data')
          .select('receipt_no, subtotal, tax_amount, sales_date')
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
            .upsert({
              user_id: user.id,
              date: dateStr,
              visitor_count: visitorCount,
              sales_amount: salesAmount,
              avg_per_customer: avgPerCustomer,
              day_of_week: dayOfWeek,
              is_holiday: false,
            }, {
              onConflict: 'user_id,date',
            })

          if (aggError) {
            console.error('Error aggregating data for date', dateStr, aggError)
          }
        }
      }

      // Mark upload as successful
      await supabase
        .from('upload_history')
        .update({
          status: 'success',
          row_count: rowCount,
        })
        .eq('id', uploadRecord.id)

      return NextResponse.json({
        success: true,
        row_count: rowCount,
        upload_id: uploadRecord.id,
      })
    } catch (error: unknown) {
      // Update upload history with error
      await supabase
        .from('upload_history')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', uploadRecord.id)

      throw error
    }
  } catch (error: unknown) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
