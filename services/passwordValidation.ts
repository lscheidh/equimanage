/** Mindestens 8 Zeichen, Groß-/Kleinbuchstaben, Ziffer, Sonderzeichen */
const MIN_LENGTH = 8;
const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

export interface PasswordStrengthResult {
  valid: boolean;
  message?: string;
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  if (password.length < MIN_LENGTH) {
    return { valid: false, message: 'Mindestens 8 Zeichen erforderlich.' };
  }
  if (!HAS_UPPER.test(password)) {
    return { valid: false, message: 'Mindestens ein Großbuchstabe erforderlich.' };
  }
  if (!HAS_LOWER.test(password)) {
    return { valid: false, message: 'Mindestens ein Kleinbuchstabe erforderlich.' };
  }
  if (!HAS_DIGIT.test(password)) {
    return { valid: false, message: 'Mindestens eine Ziffer erforderlich.' };
  }
  if (!HAS_SPECIAL.test(password)) {
    return { valid: false, message: 'Mindestens ein Sonderzeichen erforderlich (z.B. !@#$%&*).' };
  }
  return { valid: true };
}
