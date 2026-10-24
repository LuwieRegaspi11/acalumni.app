// Shared "is this a real name?" check for the required full-name rule
// (registration, roster, profiles). A name part is accepted when it is made of
// letters (any language), spaces, hyphens, apostrophes and periods, has at
// least two letters, and isn't one character repeated ("aaaa").
// Mirrored by hand in supabase/functions/tracer-intake/index.ts and by the
// database trigger in supabase/alumni_required_fields.sql.
export function isRealNamePart(value: string | null | undefined): boolean {
  const v = (value || '').trim();
  if (!/^[\p{L}][\p{L}\p{M}\s.'’-]*$/u.test(v)) return false;
  const letters = v.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return false;
  return new Set(letters.toLowerCase()).size > 1;
}

// A full name is at least a first and a last name, each a real name part.
export function isFullRealName(fullName: string | null | undefined): boolean {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every(p => isRealNamePart(p) || /^[\p{L}]\.?$/u.test(p));
}
