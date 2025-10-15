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

    const { user_id, prediction_date } = await request.json()

    if (user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate prediction_date
    if (!prediction_date) {
      return NextResponse.json({ error: '予測日を指定してください' }, { status: 400 })
    }

    const selectedDate = new Date(prediction_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + 14)

    if (selectedDate < tomorrow || selectedDate > maxDate) {
      return NextResponse.json(
        { error: '予測日は明日から14日先までの範囲で選択してください' },
        { status: 400 }
      )
    }

    // Get user profile for location
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_location, store_lat, store_lon')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.store_lat || !profile.store_lon) {
      return NextResponse.json(
        {
          error:
            '店舗の位置情報が設定されていません。プロフィール設定から店舗の住所を登録してください。',
        },
        { status: 400 }
      )
    }

    // Calculate historical averages for the same day of week
    const targetDate = new Date(prediction_date)
    const dayOfWeek = targetDate.getDay() // 0 = Sunday, 6 = Saturday

    // Check if daily_aggregated table has data
    const { data: checkData, error: checkError } = await supabase
      .from('daily_aggregated')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    // If no aggregated data exists, automatically create it
    if (!checkError && (!checkData || checkData.length === 0)) {
      console.log('No aggregated data found. Auto-aggregating journal data...')

      // Get all unique dates from journal_data
      const { data: dates, error: datesError } = await supabase
        .from('journal_data')
        .select('sales_date')
        .eq('user_id', user.id)

      if (!datesError && dates && dates.length > 0) {
        const uniqueDates = [...new Set(dates.map((d) => d.sales_date).filter((d) => d))]
        console.log(`Auto-aggregating ${uniqueDates.length} dates...`)

        for (const dateStr of uniqueDates) {
          const { data: dayData, error: dayError } = await supabase
            .from('journal_data')
            .select('receipt_no, subtotal, tax_amount')
            .eq('user_id', user.id)
            .eq('sales_date', dateStr)

          if (!dayError && dayData && dayData.length > 0) {
            const visitorCount = new Set(dayData.map((d) => d.receipt_no)).size
            const salesAmount = dayData.reduce((sum, d) => {
              const subtotal =
                typeof d.subtotal === 'number' ? d.subtotal : parseFloat(d.subtotal || '0')
              const taxAmount =
                typeof d.tax_amount === 'number' ? d.tax_amount : parseFloat(d.tax_amount || '0')
              return sum + subtotal + taxAmount
            }, 0)
            const avgPerCustomer = visitorCount > 0 ? salesAmount / visitorCount : 0
            const dateDayOfWeek = new Date(dateStr).getDay()

            await supabase.from('daily_aggregated').upsert(
              {
                user_id: user.id,
                date: dateStr,
                visitor_count: visitorCount,
                sales_amount: salesAmount,
                avg_per_customer: avgPerCustomer,
                day_of_week: dateDayOfWeek,
                is_holiday: false,
              },
              {
                onConflict: 'user_id,date',
              }
            )
          }
        }
        console.log('Auto-aggregation complete.')
      }
    }

    // Get daily aggregated data for the same day of week
    const { data: historicalData, error: histError } = await supabase
      .from('daily_aggregated')
      .select('visitor_count, sales_amount')
      .eq('user_id', user.id)
      .eq('day_of_week', dayOfWeek)

    let avgVisitors = null
    let avgSales = null

    if (historicalData && historicalData.length > 0) {
      const totalVisitors = historicalData.reduce(
        (sum, day) => sum + (typeof day.visitor_count === 'number' ? day.visitor_count : 0),
        0
      )
      const totalSales = historicalData.reduce(
        (sum, day) => sum + (typeof day.sales_amount === 'number' ? day.sales_amount : parseFloat(day.sales_amount)),
        0
      )
      avgVisitors = Math.round(totalVisitors / historicalData.length)
      avgSales = Math.round(totalSales / historicalData.length)
    }

    console.log(
      `Historical averages for day ${dayOfWeek}: visitors=${avgVisitors}, sales=${avgSales}, data points=${historicalData?.length || 0}`
    )

    // Call ML API or use demo mode
    const mlApiUrl = process.env.ML_API_URL
    const mlApiKey = process.env.ML_API_KEY

    let predictionData

    // Check if ML API is configured
    if (!mlApiUrl || !mlApiKey || mlApiUrl === 'your_ml_api_url' || mlApiKey === 'your_ml_api_key') {
      // Demo mode: Generate realistic prediction data
      console.log('Using demo mode for prediction for date:', prediction_date)

      // Generate prediction based on store location (simple heuristic)
      const baseVisitors = 45
      const baseSales = 28000

      // Vary prediction based on day of week
      const targetDate = new Date(prediction_date)
      const dayOfWeek = targetDate.getDay() // 0 = Sunday, 6 = Saturday

      // Weekend boost
      let dayMultiplier = 1.0
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        dayMultiplier = 1.3 // 30% more visitors on weekends
      } else if (dayOfWeek === 5) {
        dayMultiplier = 1.15 // 15% more on Fridays
      }

      // Add some randomness for realistic demo
      const visitorVariation = Math.floor(Math.random() * 10) - 5
      const salesVariation = Math.floor(Math.random() * 5000) - 2500

      const adjustedVisitors = Math.round(baseVisitors * dayMultiplier) + visitorVariation
      const adjustedSales = Math.round(baseSales * dayMultiplier) + salesVariation

      // Vary weather based on date (simple simulation)
      const weatherConditions = ['晴れ', '曇り', '晴れ時々曇り', '曇り時々晴れ']
      const weatherIndex = targetDate.getDate() % weatherConditions.length
      const tempBase = 20 + (targetDate.getDate() % 10) - 5

      predictionData = {
        prediction_date: prediction_date,
        predictions: {
          visitor_count: {
            value: adjustedVisitors,
            confidence_lower: adjustedVisitors - 8,
            confidence_upper: adjustedVisitors + 8,
          },
          sales_amount: {
            value: adjustedSales,
            confidence_lower: adjustedSales - 4500,
            confidence_upper: adjustedSales + 4500,
          },
        },
        weather_forecast: {
          condition: weatherConditions[weatherIndex],
          temp_max: tempBase + 5,
          temp_min: tempBase - 3,
          precipitation: Math.floor(Math.random() * 40),
        },
        model_version: 'demo-v1.0',
      }
    } else {
      // Production mode: Call ML API
      const mlResponse = await fetch(`${mlApiUrl}/predict/next-day`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mlApiKey}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          location: {
            lat: profile.store_lat,
            lon: profile.store_lon,
          },
        }),
      })

      if (!mlResponse.ok) {
        const errorData = await mlResponse.json()
        throw new Error(errorData.message || 'ML API error')
      }

      predictionData = await mlResponse.json()
    }

    // Save prediction to database
    const { error: insertError } = await supabase.from('predictions').insert({
      user_id: user.id,
      prediction_date: predictionData.prediction_date,
      predicted_visitor_count: Math.round(predictionData.predictions.visitor_count.value),
      predicted_sales_amount: predictionData.predictions.sales_amount.value,
      visitor_count_confidence_lower: Math.round(
        predictionData.predictions.visitor_count.confidence_lower
      ),
      visitor_count_confidence_upper: Math.round(
        predictionData.predictions.visitor_count.confidence_upper
      ),
      sales_amount_confidence_lower: predictionData.predictions.sales_amount.confidence_lower,
      sales_amount_confidence_upper: predictionData.predictions.sales_amount.confidence_upper,
      weather_forecast: predictionData.weather_forecast,
      model_version: predictionData.model_version || 'v1.0',
    })

    if (insertError) {
      console.error('Error saving prediction:', insertError)
    }

    // Add historical comparison to response
    const responseData = {
      ...predictionData,
      historical_average: {
        visitor_count: avgVisitors,
        sales_amount: avgSales,
        day_of_week: dayOfWeek,
      },
    }

    return NextResponse.json(responseData)
  } catch (error: unknown) {
    console.error('Prediction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
