export interface FormFieldConfig {
  name: string
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'number'
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]  // for select, radio
}

export interface FormConfig {
  slug: string
  name: string
  fields: FormFieldConfig[]
  settings?: {
    submitLabel?: string
    successMessage?: string
    honeypot?: boolean
  }
}

// Registry of forms declared in cms.config.ts
const declaredForms: FormConfig[] = []

/**
 * Declare a form in cms.config.ts.
 *
 * Usage:
 *   addForm('contact')                           // blank form, configure in admin
 *   addForm('contact', { fields: [...] })        // form with inline field definitions
 *
 * Returns the form slug for use in block definitions.
 */
export function addForm(
  slug: string,
  config?: {
    name?: string
    fields?: FormFieldConfig[]
    submitLabel?: string
    successMessage?: string
  },
): string {
  const form: FormConfig = {
    slug,
    name: config?.name || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/[-_]/g, ' '),
    fields: config?.fields || [],
    settings: {
      submitLabel: config?.submitLabel || 'Submit',
      successMessage: config?.successMessage || 'Thank you. Your submission has been received.',
      honeypot: true,
    },
  }

  // Don't add duplicates
  if (!declaredForms.some((f) => f.slug === slug)) {
    declaredForms.push(form)
  }

  return slug
}

/** Get all forms declared via addForm() in cms.config.ts */
export function getDeclaredForms(): FormConfig[] {
  return declaredForms
}

/** Reset — used in tests */
export function resetDeclaredForms(): void {
  declaredForms.length = 0
}
