import bcrypt from 'bcryptjs';

const BCRYPT_COST = 11;
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function isStrongPassword(password) {
  return STRONG_PASSWORD_REGEX.test(String(password || ''));
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_COST);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(password || ''), hash);
}

export { STRONG_PASSWORD_REGEX };
