// =====================================================================
// ACADEMIC PROGRAMS — the single source of truth for which departments
// and programs/courses the college offers. Every picker in the app
// (the Alumni Tracer Survey, alumni management filters/editor, batch
// rep filters, alumni roster import, etc.) should source its options
// from here instead of keeping its own hardcoded list, so they can't
// drift out of sync with each other.
//
// Kept in sync by hand with the college's official program offerings —
// each department offers exactly the programs listed below (BAA: 3,
// CSE: 4, CTHM: 2). Also mirrored in scripts/import-alumni.mjs, which
// duplicates this list since it's a plain Node script with no build step.
// Department *codes* (BAA/CSE/CTHM) predate this file and are unchanged —
// only the full display names and the program list were realigned.
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
    { code: 'BSMM', name: 'BS in Business Administration Major in Marketing Management (BSMM)' },
    { code: 'BSFM', name: 'BS in Business Administration Major in Financial Management (BSFM)' },
  ],
  CSE: [
    { code: 'BMMA', name: 'Bachelor of Multimedia Arts (BMMA)' },
    { code: 'BSCpE', name: 'BS in Computer Engineering (BSCpE)' },
    { code: 'BSCS', name: 'BS in Computer Science (BSCS)' },
    { code: 'BSIT', name: 'BS in Information Technology (BSIT)' },
  ],
  CTHM: [
    { code: 'BSHM', name: 'BS in Hospitality Management (BSHM)' },
    { code: 'BSTM', name: 'BS in Tourism Management (BSTM)' },
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
// existing alumni records from before this catalog was realigned to the
// official program list (only 3 programs offered under BAA, 4 under CSE,
// 2 under CTHM). Maps them to the current code so old records still match
// filters correctly. 'BSMA' (Management Accounting), 'BSBA-BM' (Business
// Management), 'BSBA-OM' (Operations Management) and 'BSET' (Electronics
// Technology) are intentionally NOT mapped — those programs aren't offered
// at all anymore and need a manual data fix.
export const LEGACY_PROGRAM_CODES: Record<string, string> = {
  'BSBA-MM': 'BSMM',
  'BSBA-FM': 'BSFM',
  'BSBA-MM (old)': 'BSMM',
  BSCOE: 'BSCpE',
  'BS in Accountancy': 'BSA',
  'BS in Business Administration Major in Marketing Management': 'BSMM',
  'BS in Business Administration Major in Financial Management': 'BSFM',
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
