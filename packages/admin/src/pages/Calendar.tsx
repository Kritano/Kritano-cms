import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

const COLLECTIONS = ['page', 'article', 'project']
const COLLECTION_COLOURS: Record<string, string> = {
  page: 'bg-blue-500',
  article: 'bg-green-500',
  project: 'bg-purple-500',
}

interface DocItem {
  id: string
  title: string
  status: string
  collection: string
  date: string
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

function getStartDay(year: number, month: number): number {
  // Monday = 0
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Calendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [filterCollection, setFilterCollection] = useState<string>('all')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Fetch all collections
  const queries = COLLECTIONS.map((col) =>
    useQuery({
      queryKey: ['collection', col, 'calendar'],
      queryFn: () => api<any>(`/${col}?limit=500`),
    }),
  )

  // Build items grouped by date
  const itemsByDate = useMemo(() => {
    const map: Record<string, DocItem[]> = {}
    COLLECTIONS.forEach((col, idx) => {
      const data = queries[idx].data?.data || []
      for (const doc of data) {
        const d = doc.status === 'published' && doc.published_at
          ? doc.published_at
          : doc.updated_at || doc.created_at
        if (!d) continue
        const key = d.substring(0, 10) // YYYY-MM-DD
        if (!map[key]) map[key] = []
        if (filterCollection === 'all' || filterCollection === col) {
          map[key].push({
            id: doc.id,
            title: doc.title || 'Untitled',
            status: doc.status,
            collection: col,
            date: d,
          })
        }
      }
    })
    return map
  }, [queries.map((q) => q.data), filterCollection])

  const days = getDaysInMonth(year, month)
  const startPad = getStartDay(year, month)
  const monthName = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
    setSelectedDay(null)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
    setSelectedDay(null)
  }

  const todayKey = dateKey(now)
  const selectedItems = selectedDay ? (itemsByDate[selectedDay] || []) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Content Calendar</h1>
        <select
          value={filterCollection}
          onChange={(e) => setFilterCollection(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="all">All collections</option>
          {COLLECTIONS.map((col) => (
            <option key={col} value={col}>{col.charAt(0).toUpperCase() + col.slice(1)}s</option>
          ))}
        </select>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prevMonth}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-lg font-medium text-gray-900">{monthName}</h2>
        <Button variant="ghost" size="sm" onClick={nextMonth}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Padding for start of month */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[80px] border-b border-r border-gray-100 bg-gray-50/50" />
          ))}

          {days.map((day) => {
            const key = dateKey(day)
            const items = itemsByDate[key] || []
            const isToday = key === todayKey
            const isSelected = key === selectedDay

            return (
              <div
                key={key}
                onClick={() => setSelectedDay(isSelected ? null : key)}
                className={`min-h-[80px] cursor-pointer border-b border-r border-gray-100 p-1.5 transition-colors ${
                  isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <p className={`text-xs font-medium ${isToday ? 'rounded-full bg-gray-900 text-white inline-flex h-5 w-5 items-center justify-center' : 'text-gray-600'}`}>
                  {day.getDate()}
                </p>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] ${
                        item.status === 'scheduled' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLLECTION_COLOURS[item.collection] || 'bg-gray-400'}`} />
                      <span className="truncate">{item.title}</span>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <p className="text-[10px] text-gray-400 px-1">+{items.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        {COLLECTIONS.map((col) => (
          <div key={col} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${COLLECTION_COLOURS[col]}`} />
            {col.charAt(0).toUpperCase() + col.slice(1)}s
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Scheduled
        </div>
      </div>

      {/* Expanded day */}
      {selectedDay && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-gray-400">No content on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <Link
                  key={item.id}
                  to="/admin/$collection/$id"
                  params={{ collection: item.collection, id: item.id }}
                  className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${COLLECTION_COLOURS[item.collection]}`} />
                    <span className="text-sm font-medium text-gray-900">{item.title}</span>
                  </div>
                  <Badge
                    variant={
                      item.status === 'published' ? 'success' :
                      item.status === 'scheduled' ? 'warning' : 'default'
                    }
                  >
                    {item.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
