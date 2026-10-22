import { compare, hash } from "bcrypt";

const SALT_ROUNDS = 12;

export function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return compare(plainPassword, passwordHash);
}
