// Pure, dependency-free validation helpers safe to import from both
// client and server code (no Node-only or next/headers dependencies).

export const SESSION_COOKIE = "seaoil_session";

export const PASSWORD_RULE_TEXT =
  "At least 8 characters, including 1 uppercase letter, 1 number, and 1 special character.";

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
