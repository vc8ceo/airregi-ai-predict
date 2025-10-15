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
  historical_average?: {
    visitor_count: number | null
    sales_amount: number | null
    day_of_week: number
  }
}

export default function PredictionPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const supabase = createClient()

  // Helper function to get day of week name in Japanese
  const getDayOfWeekName = (dayOfWeek: number) => {
    const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
    return days[dayOfWeek]
  }

  // Helper function to get weather icon
  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase()

    if (lowerCondition.includes('晴れ') || lowerCondition.includes('sunny')) {
      return '☀️'
    } else if (lowerCondition.includes('曇り') || lowerCondition.includes('cloudy')) {
      return '☁️'
    } else if (lowerCondition.includes('雨') || lowerCondition.includes('rain')) {
      return '🌧️'
    } else if (lowerCondition.includes('雪') || lowerCondition.includes('snow')) {
      return '❄️'
    }
    return '⛅'
  }

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const getMaxDate = () => {
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 14)
    return maxDate.toISOString().split('T')[0]
  }

  const handlePredict = async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('ログインが必要です')
      }

      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          prediction_date: selectedDate,
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
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          来店者数・売上予測
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          AIモデルが天気予報と過去データから明日以降の来店者数と売上を予測します
        </p>
      </div>

      {/* Prediction Input Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <label htmlFor="prediction-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          予測したい日付を選択
        </label>
        <div className="flex items-center gap-4">
          <input
            type="date"
            id="prediction-date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={getMinDate()}
            max={getMaxDate()}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-base"
          />
          <button
            onClick={handlePredict}
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                予測中...
              </span>
            ) : (
              '予測を実行'
            )}
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          ※ 明日から14日先まで選択可能
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Prediction Results */}
      {prediction && (
        <div className="space-y-6 animate-fadeIn">
          {/* Weather Card */}
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-6">
              <div className="text-6xl flex-shrink-0">
                {getWeatherIcon(prediction.weather_forecast.condition)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {new Date(prediction.prediction_date).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </h3>
                <p className="text-2xl text-gray-700 dark:text-gray-300 mb-3">
                  {prediction.weather_forecast.condition}
                </p>
                <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                  <span>🌡️ {prediction.weather_forecast.temp_max}°C / {prediction.weather_forecast.temp_min}°C</span>
                  <span>💧 降水確率 {prediction.weather_forecast.precipitation}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Visitor Prediction Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  来店者数予測
                </h3>
              </div>

              <div className="text-center py-6">
                <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(prediction.predictions.visitor_count.value)}
                  <span className="text-2xl ml-2 text-gray-600 dark:text-gray-400">人</span>
                </div>

                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  信頼区間: {Math.round(prediction.predictions.visitor_count.confidence_lower)}
                  〜 {Math.round(prediction.predictions.visitor_count.confidence_upper)} 人
                </div>

                {prediction.historical_average?.visitor_count !== null && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      過去の{getDayOfWeekName(prediction.historical_average.day_of_week)}平均
                    </p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {prediction.historical_average.visitor_count}人
                    </p>
                    {(() => {
                      const diff = Math.round(prediction.predictions.visitor_count.value) - (prediction.historical_average.visitor_count || 0)
                      return (
                        <p className={`text-lg font-bold mt-2 ${diff > 0 ? 'text-green-600 dark:text-green-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          {diff > 0 ? '+' : ''}{diff}人
                        </p>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Sales Prediction Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  売上予測
                </h3>
              </div>

              <div className="text-center py-6">
                <div className="text-5xl font-bold text-green-600 dark:text-green-400">
                  ¥{Math.round(prediction.predictions.sales_amount.value).toLocaleString()}
                </div>

                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  信頼区間: ¥{Math.round(prediction.predictions.sales_amount.confidence_lower).toLocaleString()}
                  〜 ¥{Math.round(prediction.predictions.sales_amount.confidence_upper).toLocaleString()}
                </div>

                {prediction.historical_average?.sales_amount !== null && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      過去の{getDayOfWeekName(prediction.historical_average.day_of_week)}平均
                    </p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      ¥{prediction.historical_average.sales_amount?.toLocaleString()}
                    </p>
                    {(() => {
                      const diff = Math.round(prediction.predictions.sales_amount.value) - (prediction.historical_average.sales_amount || 0)
                      return (
                        <p className={`text-lg font-bold mt-2 ${diff > 0 ? 'text-green-600 dark:text-green-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          {diff > 0 ? '+' : ''}¥{Math.abs(diff).toLocaleString()}
                        </p>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  この予測はAIモデルによる推定値です。実際の結果と異なる場合があります。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}