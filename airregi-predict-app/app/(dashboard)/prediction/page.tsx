'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PredictionResult {
  prediction_date: string
  predictions: {
    visitor_count: {
      value: number
      confidence_lower: number
      confidence_upper: number
    }
    sales_amount: {
      value: number
      confidence_lower: number
      confidence_upper: number
    }
  }
  weather_forecast: {
    condition: string
    temp_max: number
    temp_min: number
    precipitation: number
  }
}

export default function PredictionPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const supabase = createClient()

  const handlePredict = async () => {
    setLoading(true)
    setError(null)
    setPrediction(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('ログインが必要です')
      }

      // Call the prediction API
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '予測に失敗しました')
      }

      const data = await response.json()
      setPrediction(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '予測の実行中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">来店者数・売上予測</h1>
        <p className="mt-1 text-sm text-gray-600">
          機械学習モデルと天気予報を用いて次の営業日を予測します
        </p>
      </div>

      {/* Predict Button */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="text-center">
          <button
            onClick={handlePredict}
            disabled={loading}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                予測中...
              </>
            ) : (
              <>
                <svg
                  className="-ml-1 mr-3 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                予測を実行
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">エラー</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prediction Results */}
      {prediction && (
        <div className="space-y-6">
          {/* Prediction Date and Weather */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">予測日</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">対象日</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {new Date(prediction.prediction_date).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">天気予報</p>
                <div className="mt-1">
                  <p className="text-lg font-medium text-gray-900">
                    {prediction.weather_forecast.condition}
                  </p>
                  <p className="text-sm text-gray-600">
                    最高気温: {prediction.weather_forecast.temp_max}°C / 最低気温:{' '}
                    {prediction.weather_forecast.temp_min}°C
                  </p>
                  <p className="text-sm text-gray-600">
                    降水確率: {prediction.weather_forecast.precipitation}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Visitor Count Prediction */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">来店者数予測</h2>
            <div className="text-center py-8">
              <p className="text-5xl font-bold text-blue-600">
                {Math.round(prediction.predictions.visitor_count.value)}
              </p>
              <p className="text-lg text-gray-500 mt-2">人</p>
              <div className="mt-4 text-sm text-gray-600">
                <p>
                  信頼区間: {Math.round(prediction.predictions.visitor_count.confidence_lower)} 〜{' '}
                  {Math.round(prediction.predictions.visitor_count.confidence_upper)} 人
                </p>
              </div>
            </div>
          </div>

          {/* Sales Amount Prediction */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">売上予測</h2>
            <div className="text-center py-8">
              <p className="text-5xl font-bold text-green-600">
                ¥{Math.round(prediction.predictions.sales_amount.value).toLocaleString()}
              </p>
              <div className="mt-4 text-sm text-gray-600">
                <p>
                  信頼区間: ¥
                  {Math.round(prediction.predictions.sales_amount.confidence_lower).toLocaleString()}{' '}
                  〜 ¥
                  {Math.round(prediction.predictions.sales_amount.confidence_upper).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  この予測は機械学習モデルと天気予報に基づいて算出されています。
                  実際の来店者数や売上は、イベントや特別な要因により変動する可能性があります。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!prediction && !loading && !error && (
        <div className="bg-white shadow rounded-lg p-12">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">予測結果なし</h3>
            <p className="mt-1 text-sm text-gray-500">
              「予測を実行」ボタンをクリックして予測を開始してください
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
