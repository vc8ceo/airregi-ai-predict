import { createClient } from '@/lib/supabase/server'
import { format, subDays } from 'date-fns'

async function getDashboardData(userId: string) {
  const supabase = await createClient()

  // Get last 30 days of aggregated data
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const { data: dailyData, error } = await supabase
    .from('daily_aggregated')
    .select('*')
    .eq('user_id', userId)
    .gte('date', thirtyDaysAgo)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching dashboard data:', error)
    return { dailyData: [] }
  }

  return { dailyData: dailyData || [] }
}

interface DailyData {
  visitor_count: number
  sales_amount: string | number
}

function calculateKPIs(dailyData: DailyData[]) {
  if (dailyData.length === 0) {
    return {
      totalVisitors: 0,
      totalSales: 0,
      avgDailyVisitors: 0,
      avgPerCustomer: 0,
    }
  }

  const totalVisitors = dailyData.reduce((sum, day) => sum + day.visitor_count, 0)
  const totalSales = dailyData.reduce(
    (sum, day) => sum + (typeof day.sales_amount === 'number' ? day.sales_amount : parseFloat(day.sales_amount)),
    0
  )
  const avgDailyVisitors = totalVisitors / dailyData.length
  const avgPerCustomer = totalSales / totalVisitors

  return {
    totalVisitors,
    totalSales,
    avgDailyVisitors,
    avgPerCustomer,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { dailyData } = await getDashboardData(user.id)
  const kpis = calculateKPIs(dailyData)

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          過去30日間の店舗データサマリー
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    総来店者数
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {kpis.totalVisitors.toLocaleString()}人
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    総売上
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    ¥{kpis.totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400 dark:text-gray-500"
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
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    1日平均来店者数
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {kpis.avgDailyVisitors.toFixed(1)}人
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    顧客単価
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    ¥{isFinite(kpis.avgPerCustomer) ? kpis.avgPerCustomer.toFixed(0) : '0'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {dailyData.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                来店者数推移
              </h3>
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                グラフは次の実装フェーズで追加予定
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                売上推移
              </h3>
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                グラフは次の実装フェーズで追加予定
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">データがありません</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              データ管理ページからジャーナル履歴CSVをアップロードしてください
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
