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

    const { address } = await request.json()

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: '住所を入力してください' }, { status: 400 })
    }

    // Use Google Maps Geocoding API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    console.log('API Key exists:', !!apiKey)
    console.log('API Key length:', apiKey?.length || 0)

    if (!apiKey) {
      // Fallback to a simple geocoding service or return error
      return NextResponse.json(
        {
          error:
            'Google Maps APIキーが設定されていません。環境変数GOOGLE_MAPS_API_KEYを設定してください。',
        },
        { status: 503 }
      )
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=ja&region=jp&key=${apiKey}`

    console.log('Geocoding request for address:', address)

    const response = await fetch(geocodeUrl)

    if (!response.ok) {
      console.error('Geocoding HTTP error:', response.status, response.statusText)
      throw new Error('住所の検索に失敗しました')
    }

    const data = await response.json()
    console.log('Geocoding API response status:', data.status)

    if (data.status === 'ZERO_RESULTS') {
      return NextResponse.json(
        { error: '住所が見つかりませんでした。正確な住所を入力してください。' },
        { status: 404 }
      )
    }

    if (data.status === 'REQUEST_DENIED') {
      console.error('Geocoding REQUEST_DENIED. Error message:', data.error_message)
      return NextResponse.json(
        {
          error: `Google Maps APIの認証に失敗しました。APIキーを確認してください。${data.error_message ? ' 詳細: ' + data.error_message : ''}`,
        },
        { status: 403 }
      )
    }

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return NextResponse.json(
        { error: '住所の検索に失敗しました。後でもう一度お試しください。' },
        { status: 500 }
      )
    }

    const location = data.results[0].geometry.location
    const formattedAddress = data.results[0].formatted_address

    return NextResponse.json({
      lat: location.lat,
      lng: location.lng,
      formatted_address: formattedAddress,
    })
  } catch (error: unknown) {
    console.error('Geocoding error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '住所の検索中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
