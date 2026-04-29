import { Button } from '@/components/ui/Button'

interface Scores {
  overall: number
  seo: number
  accessibility: number
  performance: number
  ai_visibility: number | null
}

interface Props {
  scores: Scores | null
  lastAudit: { completedAt: string } | null
  onRunAudit: () => void
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-gray-50 p-4">
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
      <span className="mt-1 text-xs text-gray-500">{label}</span>
    </div>
  )
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function KritanoHealth({ scores, lastAudit, onRunAudit }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-gray-700">Connected to Kritano</span>
        </div>
        <a
          href="https://app.kritano.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Open Dashboard ↗
        </a>
      </div>

      {scores ? (
        <>
          <h3 className="text-sm font-semibold text-gray-900">Site Health Score</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreCard label="Overall" score={scores.overall} />
            <ScoreCard label="SEO" score={scores.seo} />
            <ScoreCard label="Accessibility" score={scores.accessibility} />
            <ScoreCard label="Performance" score={scores.performance} />
          </div>

          {scores.ai_visibility !== null ? (
            <ScoreCard label="AI Visibility" score={scores.ai_visibility} />
          ) : (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              AI Visibility Score — Upgrade to Kritano Pro to unlock
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500">No audit data yet. Run your first audit.</p>
      )}

      <div className="flex items-center justify-between">
        {lastAudit && (
          <span className="text-xs text-gray-400">Last audit: {timeAgo(lastAudit.completedAt)}</span>
        )}
        <Button variant="secondary" size="sm" onClick={onRunAudit}>
          Run audit now
        </Button>
      </div>
    </div>
  )
}
