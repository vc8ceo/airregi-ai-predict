'use client'

import { useState, useMemo } from 'react'

interface YearlyHeatmapCalendarProps {
  highlightedDates?: string[] // Array of date strings in YYYY-MM-DD format
}

export default function YearlyHeatmapCalendar({ highlightedDates = [] }: YearlyHeatmapCalendarProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)

  // Convert highlightedDates to Set for faster lookup
  const journalDatesSet = useMemo(() => new Set(highlightedDates), [highlightedDates])

  // Get available years from highlightedDates
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    highlightedDates.forEach((dateStr) => {
      const year = parseInt(dateStr.split('-')[0])
      if (!isNaN(year)) {
        years.add(year)
      }
    })
    // Add current year if no data
    if (years.size === 0) {
      years.add(currentYear)
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [highlightedDates, currentYear])

  // Generate calendar data for the selected year
  const calendarData = useMemo(() => {
    const months = []
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']

    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(selectedYear, month, 1)
      const lastDay = new Date(selectedYear, month + 1, 0)
      const daysInMonth = lastDay.getDate()
      const startDayOfWeek = firstDay.getDay()

      const days = []

      // Add empty cells for days before the first day of the month
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null)
      }

      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        // Create date string directly to avoid timezone conversion issues
        const dateStr = `${selectedYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const hasData = journalDatesSet.has(dateStr)
        days.push({
          day,
          date: dateStr,
          hasData,
        })
      }

      months.push({
        name: monthNames[month],
        days,
      })
    }

    return { months, weekdays }
  }, [selectedYear, journalDatesSet])

  // Count total days with data for the selected year
  const totalDaysWithData = useMemo(() => {
    return highlightedDates.filter((dateStr) => dateStr.startsWith(selectedYear.toString())).length
  }, [highlightedDates, selectedYear])

  return (
    <div className="yearly-heatmap-container">
      {/* Year Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="前年"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-xl font-semibold text-gray-900">{selectedYear}年</h3>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="翌年"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {availableYears.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">データがある年：</span>
            <div className="flex gap-1">
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    year === selectedYear
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {calendarData.months.map((month, monthIndex) => (
          <div key={monthIndex} className="month-container">
            <div className="text-sm font-semibold text-gray-700 mb-2">{month.name}</div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {calendarData.weekdays.map((weekday, i) => (
                <div
                  key={i}
                  className="text-xs text-center text-gray-500 font-medium"
                >
                  {weekday}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {month.days.map((dayData, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`aspect-square flex items-center justify-center text-xs rounded ${
                    dayData === null
                      ? 'bg-transparent'
                      : dayData.hasData
                      ? 'bg-green-500 text-white font-semibold hover:bg-green-600 cursor-pointer'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={dayData ? `${dayData.date}${dayData.hasData ? ' (データあり)' : ''}` : ''}
                >
                  {dayData?.day}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend and Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-sm text-gray-600">データあり</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
            <span className="text-sm text-gray-600">データなし</span>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {totalDaysWithData > 0 ? (
            <>
              <span className="font-semibold text-green-600">{totalDaysWithData}</span> 日分のデータ（{selectedYear}年）
            </>
          ) : (
            <span className="text-gray-400">{selectedYear}年のデータなし</span>
          )}
        </div>
      </div>

      <style jsx>{`
        .yearly-heatmap-container {
          width: 100%;
        }

        .month-container {
          background: white;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
        }

        @media (max-width: 768px) {
          .month-container {
            padding: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}
