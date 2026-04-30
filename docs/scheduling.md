# Scheduled publishing

Kritano CMS supports scheduling documents to publish at a future date and time. A background job powered by BullMQ checks for due items and publishes them automatically.

## Scheduling a document

In the document editor, click the **Publish** tab in the right sidebar, then click **Schedule for later**. Set the date, time, and timezone, then click **Schedule**.

The document status changes to **scheduled** and shows an amber badge in the collection list and calendar.

## Cancelling a schedule

In the same Publish panel, click **Cancel schedule**. The document reverts to draft status.

## Timezone support

Schedules are timezone-aware. The CMS uses [IANA timezone strings](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) (e.g. `Europe/London`, `America/New_York`). The timezone selector defaults to your browser's timezone.

All scheduled times are converted to UTC for storage and job scheduling. The time displayed in the admin is shown in the timezone you selected.

## How the scheduler works

1. A schedule request stores a record in the `scheduled_publishes` table and enqueues a delayed BullMQ job
2. The BullMQ worker fires at the scheduled UTC time
3. The worker publishes the document and marks the schedule as `completed`
4. If the publish fails, the schedule is marked as `failed`

## Content calendar

The **Calendar** page (`/admin/calendar`) shows a month view of all content across collections:

- Published content shown by published date
- Scheduled content shown in amber
- Colour-coded by collection (pages = blue, articles = green, projects = purple)
- Click a day to expand and see all documents for that date
- Filter by collection

## API endpoints

```
POST   /api/:collection/:id/schedule    Schedule a publish
GET    /api/:collection/:id/schedule    Get current schedule
DELETE /api/:collection/:id/schedule    Cancel schedule
```

### Example: schedule a publish

```bash
curl -X POST https://mysite.com/api/article/abc-123/schedule \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"scheduledFor": "2025-06-01T09:00:00", "timezone": "Europe/London"}'
```
