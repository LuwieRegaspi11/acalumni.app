// =====================================================================
// ACADEMIC PROGRAMS — the single source of truth for which departments
// and programs/courses the college offers. Every picker in the app
// (signup form, alumni management filters/editor, batch rep filters,
// etc.) should source its options from here instead of keeping its own
// hardcoded list, so they can't drift out of sync with each other.
// =====================================================================

export const DEPARTMENTS = ['BAA', 'CSE', 'CTHM'] as const;
export type DepartmentCode = (typeof DEPARTMENTS)[number];

export interface Program {
  code: string;
  name: string;
}

export const PROGRAMS_BY_DEPT: Record<DepartmentCode, Program[]> = {
  BAA: [
    { code: 'BSA', name: 'BS in Accountancy' },
    { code: 'BSMM', name: 'BS in Business Administration Major in Marketing Management' },
    { code: 'BSFM', name: 'BS in Business Administration Major in Financial Management' },
  ],
  CSE: [
    { code: 'BSMA', name: 'Bachelor of Multimedia Arts' },
    { code: 'BSCpE', name: 'BS in Computer Engineering' },
    { code: 'BSCS', name: 'BS in Computer Science' },
    { code: 'BSIT', name: 'BS in Information Technology' },
  ],
  CTHM: [
    { code: 'BSHM', name: 'BS in Hospitality Management' },
    { code: 'BSTM', name: 'BS in Tourism Management' },
  ],
};

// Flat list, all departments combined.
export const ALL_PROGRAMS: Program[] = Object.values(PROGRAMS_BY_DEPT).flat();
export const ALL_PROGRAM_CODES: string[] = ALL_PROGRAMS.map(p => p.code);

// Program code -> which department it belongs to. Lets a signup form
// offer a single "Course" dropdown and derive the department automatically.
export const PROGRAM_TO_DEPARTMENT: Record<string, DepartmentCode> = Object.entries(
  PROGRAMS_BY_DEPT
).reduce((acc, [dept, progs]) => {
  progs.forEach(p => { acc[p.code] = dept as DepartmentCode; });
  return acc;
}, {} as Record<string, DepartmentCode>);

// Legacy/older codes and full-name values that may already be stored on
// existing alumni records from before this catalog was finalized. Maps
// them to the current code so old records still match filters correctly.
// 'BSBA' (no major specified) is intentionally NOT mapped — it's
// ambiguous between BSMM and BSFM and needs a manual data fix.
export const LEGACY_PROGRAM_CODES: Record<string, string> = {
  BMMA: 'BSMA',
  BSCOE: 'BSCpE',
  'BSBA-MM': 'BSMM',
  'BSBA-FM': 'BSFM',
  'BS in Accountancy': 'BSA',
  'BS in Business Administration Major in Marketing Management': 'BSMM',
  'BS in Business Administration Major in Financial Management': 'BSFM',
  'Bachelor of Multimedia Arts': 'BSMA',
  'BS in Computer Engineering': 'BSCpE',
  'BS in Computer Science': 'BSCS',
  'BS in Information Technology': 'BSIT',
  'BS in Hospitality Management': 'BSHM',
  'BS in Tourism Management': 'BSTM',
};

export function normalizeProgramCode(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return trimmed;
  if (ALL_PROGRAM_CODES.includes(trimmed)) return trimmed;
  return LEGACY_PROGRAM_CODES[trimmed] || trimmed;
}
