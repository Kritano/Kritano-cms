import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { dispatchWebhookEvent } from '../../lib/webhooks'

export const formRoutes = new Hono<AuthEnv>()

// ============================================================
// Admin routes
// ============================================================

// List forms
formRoutes.get('/admin/forms', requireAuth, requirePermission('forms'), async (c) => {
  const sql = getClient()
  const rows = await sql`
    SELECT f.*,
      (SELECT COUNT(*)::int FROM form_submissions fs WHERE fs.form_id = f.id) as submission_count,
      (SELECT MAX(created_at) FROM form_submissions fs WHERE fs.form_id = f.id) as last_submission_at
    FROM forms f
    ORDER BY f.created_at DESC
  `
  return c.json({ data: rows })
})

// Get single form
formRoutes.get('/admin/forms/:id', requireAuth, requirePermission('forms'), async (c) => {
  const sql = getClient()
  const id = c.req.param('id')
  const rows = await sql`SELECT * FROM forms WHERE id = ${id} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, 404)
  }
  return c.json({ data: rows[0] })
})

// Create form
formRoutes.post('/admin/forms', requireAuth, requirePermission('forms'), async (c) => {
  const body = await c.req.json<{
    name: string
    slug: string
    fields: unknown[]
    settings?: Record<string, unknown>
  }>()

  if (!body.name || !body.slug) {
    return c.json({ error: { code: 'VALIDATION', message: 'Name and slug are required' } }, 400)
  }

  const sql = getClient()
  const existing = await sql`SELECT id FROM forms WHERE slug = ${body.slug} LIMIT 1`
  if (existing.length > 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'A form with this slug already exists' } }, 400)
  }

  const rows = await sql`
    INSERT INTO forms (name, slug, fields, settings)
    VALUES (${body.name}, ${body.slug}, ${JSON.stringify(body.fields || [])}::jsonb, ${JSON.stringify(body.settings || {})}::jsonb)
    RETURNING *
  `
  return c.json({ data: rows[0] }, 201)
})

// Update form
formRoutes.put('/admin/forms/:id', requireAuth, requirePermission('forms'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    slug?: string
    fields?: unknown[]
    settings?: Record<string, unknown>
  }>()

  const sql = getClient()
  const setClauses: string[] = []
  const values: any[] = []
  let idx = 1

  if (body.name !== undefined) {
    setClauses.push(`"name" = $${idx}`)
    values.push(body.name)
    idx++
  }
  if (body.slug !== undefined) {
    setClauses.push(`"slug" = $${idx}`)
    values.push(body.slug)
    idx++
  }
  if (body.fields !== undefined) {
    setClauses.push(`"fields" = $${idx}::jsonb`)
    values.push(JSON.stringify(body.fields))
    idx++
  }
  if (body.settings !== undefined) {
    setClauses.push(`"settings" = $${idx}::jsonb`)
    values.push(JSON.stringify(body.settings))
    idx++
  }

  if (setClauses.length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'No fields to update' } }, 400)
  }

  values.push(id)
  const rows = await sql.unsafe(
    `UPDATE forms SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`,
    values,
  )

  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, 404)
  }
  return c.json({ data: rows[0] })
})

// Delete form
formRoutes.delete('/admin/forms/:id', requireAuth, requirePermission('forms'), async (c) => {
  const id = c.req.param('id')
  const sql = getClient()
  const rows = await sql`DELETE FROM forms WHERE id = ${id} RETURNING id`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, 404)
  }
  return c.json({ ok: true })
})

// List submissions (paginated)
formRoutes.get('/admin/forms/:id/submissions', requireAuth, requirePermission('forms'), async (c) => {
  const sql = getClient()
  const formId = c.req.param('id')
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
  const offset = (page - 1) * limit

  const countResult = await sql`SELECT COUNT(*)::int as total FROM form_submissions WHERE form_id = ${formId}`
  const total = (countResult[0] as Record<string, unknown>).total as number

  const rows = await sql`
    SELECT * FROM form_submissions
    WHERE form_id = ${formId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return c.json({
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
})

// Delete submission
formRoutes.delete('/admin/forms/:id/submissions/:subId', requireAuth, requirePermission('forms'), async (c) => {
  const subId = c.req.param('subId')
  const sql = getClient()
  const rows = await sql`DELETE FROM form_submissions WHERE id = ${subId} RETURNING id`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Submission not found' } }, 404)
  }
  return c.json({ ok: true })
})

// CSV export
formRoutes.get('/admin/forms/:id/export', requireAuth, requirePermission('forms'), async (c) => {
  const formId = c.req.param('id')
  const sql = getClient()

  // Get form to know field order
  const formRows = await sql`SELECT fields FROM forms WHERE id = ${formId} LIMIT 1`
  if (formRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, 404)
  }

  const fields = (formRows[0] as Record<string, unknown>).fields as { label: string; name: string }[]
  const fieldNames = fields.map((f) => f.name || f.label)

  const submissions = await sql`
    SELECT data, ip_address, created_at FROM form_submissions
    WHERE form_id = ${formId}
    ORDER BY created_at DESC
  `

  // Build CSV
  const headers = [...fieldNames, 'ip_address', 'submitted_at']
  let csv = headers.join(',') + '\n'

  for (const sub of submissions) {
    const s = sub as Record<string, unknown>
    const data = s.data as Record<string, unknown>
    const row = fieldNames.map((name) => {
      const val = data[name]
      if (val === null || val === undefined) return ''
      const str = String(val).replace(/"/g, '""')
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
    })
    row.push(String(s.ip_address || ''))
    row.push(String(s.created_at || ''))
    csv += row.join(',') + '\n'
  }

  return c.text(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="form-submissions.csv"`,
  })
})

// ============================================================
// Public routes — static paths MUST be before :slug wildcard
// ============================================================

// Embed script (for third-party sites)
formRoutes.get('/forms/embed.js', async (c) => {
  const script = `(function(){
  var containers = document.querySelectorAll('[data-cms-form]');
  containers.forEach(function(el) {
    var slug = el.getAttribute('data-cms-form');
    if (!slug) return;
    var baseUrl = document.currentScript ? document.currentScript.src.replace('/api/forms/embed.js', '') : '';
    fetch(baseUrl + '/api/forms/' + slug)
      .then(function(r) { return r.json(); })
      .then(function(res) {
        var form = res.data;
        if (!form) return;
        var html = '<form method="POST" action="' + baseUrl + '/api/forms/' + slug + '/submit" class="cms-form">';
        form.fields.forEach(function(f) {
          html += '<div style="margin-bottom:12px">';
          html += '<label style="display:block;font-size:14px;margin-bottom:4px">' + f.label + (f.required ? ' *' : '') + '</label>';
          if (f.type === 'textarea') {
            html += '<textarea name="' + f.name + '"' + (f.required ? ' required' : '') + ' style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" rows="' + (f.rows || 4) + '"></textarea>';
          } else if (f.type === 'select') {
            html += '<select name="' + f.name + '"' + (f.required ? ' required' : '') + ' style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">';
            html += '<option value="">Select…</option>';
            (f.options || []).forEach(function(o) { html += '<option value="' + o + '">' + o + '</option>'; });
            html += '</select>';
          } else if (f.type === 'checkbox') {
            html += '<input type="checkbox" name="' + f.name + '" value="yes"' + (f.required ? ' required' : '') + '> ' + f.label;
          } else {
            var inputType = f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : f.type === 'date' ? 'date' : 'text';
            html += '<input type="' + inputType + '" name="' + f.name + '"' + (f.required ? ' required' : '') + ' style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">';
          }
          html += '</div>';
        });
        html += '<input type="text" name="_hp" tabindex="-1" aria-hidden="true" style="display:none">';
        html += '<button type="submit" style="padding:10px 20px;background:#18181b;color:#fff;border:none;border-radius:4px;cursor:pointer">' + (form.settings.submitLabel || 'Submit') + '</button>';
        html += '</form>';
        el.innerHTML = html;
      });
  });
})();`

  return c.text(script, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=3600',
  })
})

// Progressive enhancement script (optional inline validation)
formRoutes.get('/forms/enhance.js', async (c) => {
  const script = `(function(){
  document.querySelectorAll('.cms-form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      var errors = [];
      form.querySelectorAll('[required]').forEach(function(input) {
        var val = input.type === 'checkbox' ? input.checked : input.value.trim();
        var label = input.closest('div')?.querySelector('label')?.textContent || input.name;
        if (!val) {
          errors.push({ input: input, message: label.replace(' *', '') + ' is required' });
        }
      });
      var emailInputs = form.querySelectorAll('input[type="email"]');
      emailInputs.forEach(function(input) {
        if (input.value && !/^[^@]+@[^@]+\\.[^@]+$/.test(input.value)) {
          errors.push({ input: input, message: 'Please enter a valid email' });
        }
      });
      form.querySelectorAll('.cms-field-error').forEach(function(el) { el.remove(); });
      if (errors.length > 0) {
        e.preventDefault();
        errors.forEach(function(err) {
          var msg = document.createElement('p');
          msg.className = 'cms-field-error';
          msg.style.cssText = 'color:#dc2626;font-size:13px;margin-top:4px';
          msg.textContent = err.message;
          err.input.parentNode.appendChild(msg);
        });
        errors[0].input.focus();
      }
    });
  });
})();`

  return c.text(script, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=3600',
  })
})

// Get form schema (public — for SDK and embed)
formRoutes.get('/forms/:slug', async (c) => {
  const slug = c.req.param('slug')
  const sql = getClient()
  const rows = await sql`SELECT id, name, slug, fields, settings FROM forms WHERE slug = ${slug} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, 404)
  }
  return c.json({ data: rows[0] })
})

// Submit form (public — returns redirect, not JSON)
formRoutes.post('/forms/:slug/submit', async (c) => {
  const slug = c.req.param('slug')
  const sql = getClient()

  const formRows = await sql`SELECT * FROM forms WHERE slug = ${slug} LIMIT 1`
  if (formRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, 404)
  }

  const form = formRows[0] as Record<string, unknown>
  const fields = form.fields as { name: string; type: string; required?: boolean; label: string }[]
  const settings = form.settings as Record<string, unknown>
  const referer = c.req.header('Referer') || '/'

  let data: Record<string, unknown>

  // Support both JSON and form-encoded
  const contentType = c.req.header('Content-Type') || ''
  if (contentType.includes('application/json')) {
    data = await c.req.json()
  } else {
    const formData = await c.req.formData()
    data = {}
    for (const [key, value] of formData.entries()) {
      data[key] = value
    }
  }

  // Check honeypot
  if (data._hp) {
    // Bot detected — silently discard
    const redirectUrl = settings.redirectUrl as string || `${referer}${referer.includes('?') ? '&' : '?'}submitted=true`
    return c.redirect(redirectUrl, 302)
  }
  delete data._hp

  // Validate required fields
  for (const field of fields) {
    if (field.required && !data[field.name]) {
      const errorUrl = `${referer}${referer.includes('?') ? '&' : '?'}error=${encodeURIComponent(field.name)}&message=${encodeURIComponent(`${field.label} is required`)}`
      return c.redirect(errorUrl, 302)
    }
  }

  // Store submission
  const ip = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || c.req.header('X-Real-IP') || null
  const userAgent = c.req.header('User-Agent') || null

  await sql`
    INSERT INTO form_submissions (form_id, data, ip_address, user_agent)
    VALUES (${form.id as string}, ${JSON.stringify(data)}::jsonb, ${ip}, ${userAgent})
  `

  // Dispatch webhook
  dispatchWebhookEvent('form.submitted', {
    formId: form.id,
    formSlug: slug,
    formName: form.name,
    submission: data,
  }).catch(() => {})

  // Redirect to success
  const redirectUrl = settings.redirectUrl as string || `${referer}${referer.includes('?') ? '&' : '?'}submitted=true`
  return c.redirect(redirectUrl, 302)
})

// ============================================================
// Public form endpoint — serves form definition by slug
// Used by frontend components to render forms dynamically
// ============================================================

formRoutes.get('/forms/definition/:slug', async (c) => {
  const sql = getClient()
  const formSlug = c.req.param('slug')

  const rows = await sql`SELECT id, name, slug, fields, settings FROM forms WHERE slug = ${formSlug} LIMIT 1`

  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, 404)
  }

  const form = rows[0] as Record<string, unknown>
  return c.json({
    data: {
      id: form.id,
      name: form.name,
      slug: form.slug,
      fields: form.fields,
      settings: form.settings,
      submitUrl: `/api/forms/${form.id}/submit`,
    },
  })
})
