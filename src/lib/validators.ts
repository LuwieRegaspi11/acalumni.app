// Student ID format: 4-digit enrollment year, dash, 7-digit sequence number.
// Example: 2023-2110585
export const STUDENT_ID_REGEX = /^\d{4}-\d{7}$/;
export const STUDENT_ID_PLACEHOLDER = 'e.g., 2023-2110585';
export const STUDENT_ID_HINT = 'Format: YYYY-NNNNNNN (e.g., 2023-2110585)';

export function isValidStudentId(value: string): boolean {
  return STUDENT_ID_REGEX.test(value.trim());
}
