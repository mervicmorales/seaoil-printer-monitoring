// Pure, dependency-free validation helpers safe to import from both
// client and server code (no Node-only or next/headers dependencies).

export const SESSION_COOKIE = "seaoil_session";

export const PASSWORD_RULE_TEXT =
  "At least 8 characters, including 1 uppercase letter, 1 number, and 1 special character.";

export const EMPLOYEE_ID_PREFIXES = [
  "SPI",
  "NCI",
  "JPCI",
  "OTC",
  "GUI",
  "SVC",
  "SEI",
  "SCI",
  "LDO",
  "LOCQ",
  "EFTI",
  "MTDI",
] as const;

export const EMPLOYEE_ID_RULE_TEXT =
  `Use an approved prefix (${EMPLOYEE_ID_PREFIXES.join(", ")}) followed by five digits.`;

const EMPLOYEE_ID_PATTERN = new RegExp(
  `^(?:${EMPLOYEE_ID_PREFIXES.join("|")})[0-9]{5}$`,
);

export function isValidEmployeeId(employeeId: string) {
  return EMPLOYEE_ID_PATTERN.test(employeeId.trim().toUpperCase());
}

export function isValidPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
