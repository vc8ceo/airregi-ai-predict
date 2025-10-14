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

    // Call ML API
    const mlApiUrl = process.env.ML_API_URL
    const mlApiKey = process.env.ML_API_KEY

    if (!mlApiUrl || !mlApiKey) {
      return NextResponse.json(
        {
          error:
            'ML APIが設定されていません。現在はデモモードで動作しています。',
        },
        { status: 503 }
      )
    }

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

    const predictionData = await mlResponse.json()

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

    return NextResponse.json(predictionData)
  } catch (error: unknown) {
    console.error('Prediction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
