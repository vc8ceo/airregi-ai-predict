'use client'

import { useEffect, useState } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

type ValuePiece = Date | null
type Value = ValuePiece | [ValuePiece, ValuePiece]

interface JournalCalendarProps {
  highlightedDates?: string[] // Array of date strings in YYYY-MM-DD format
}

export default function JournalCalendar({ highlightedDates = [] }: JournalCalendarProps) {
  const [value, setValue] = useState<Value>(new Date())
  const [journalDates, setJournalDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Convert highlightedDates to Set for faster lookup
    setJournalDates(new Set(highlightedDates))
  }, [highlightedDates])

  // Function to check if a date has journal data
  const hasJournalData = (date: Date): boolean => {
    const dateString = date.toISOString().split('T')[0]
    return journalDates.has(dateString)
  }

  // Function to add custom class to dates with data
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month' && hasJournalData(date)) {
      return 'has-journal-data'
    }
    return null
  }

  return (
    <div className="journal-calendar-container">
      <Calendar
        onChange={setValue}
        value={value}
        tileClassName={tileClassName}
        locale="ja-JP"
        formatShortWeekday={(locale, date) => {
          const weekdays = ['日', '月', '火', '水', '木', '金', '土']
          return weekdays[date.getDay()]
        }}
      />
      <style jsx global>{`
        .journal-calendar-container {
          max-width: 100%;
          margin: 0 auto;
        }

        .react-calendar {
          width: 100%;
          max-width: 100%;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          font-family: inherit;
          line-height: 1.5;
          padding: 1rem;
        }

        .react-calendar__navigation {
          display: flex;
          height: 44px;
          margin-bottom: 1em;
        }

        .react-calendar__navigation button {
          min-width: 44px;
          background: none;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: #f3f4f6;
          border-radius: 0.375rem;
        }

        .react-calendar__month-view__weekdays {
          text-align: center;
          font-weight: 600;
          font-size: 0.875rem;
          color: #6b7280;
          text-transform: uppercase;
        }

        .react-calendar__month-view__weekdays__weekday {
          padding: 0.5em;
        }

        .react-calendar__tile {
          max-width: 100%;
          padding: 0.75em 0.5em;
          background: none;
          text-align: center;
          line-height: 16px;
          font-size: 0.875rem;
          border-radius: 0.375rem;
        }

        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
          background-color: #f3f4f6;
        }

        .react-calendar__tile--active {
          background: #3b82f6;
          color: white;
        }

        .react-calendar__tile--active:enabled:hover,
        .react-calendar__tile--active:enabled:focus {
          background: #2563eb;
        }

        .react-calendar__tile--now {
          background: #dbeafe;
          border-radius: 0.375rem;
        }

        .react-calendar__tile--now:enabled:hover,
        .react-calendar__tile--now:enabled:focus {
          background: #bfdbfe;
        }

        /* Highlight dates with journal data */
        .has-journal-data {
          background-color: #d1fae5 !important;
          font-weight: 600;
          color: #065f46;
          position: relative;
        }

        .has-journal-data::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          background-color: #10b981;
          border-radius: 50%;
        }

        .has-journal-data:enabled:hover,
        .has-journal-data:enabled:focus {
          background-color: #a7f3d0 !important;
        }

        /* Active and has data */
        .react-calendar__tile--active.has-journal-data {
          background-color: #10b981 !important;
          color: white;
        }

        .react-calendar__tile--active.has-journal-data::after {
          background-color: white;
        }
      `}</style>
    </div>
  )
}
