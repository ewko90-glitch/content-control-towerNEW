import { randomBytes } from "crypto";

export function generateSecureToken(size = 48): string {
  return randomBytes(size).toString("hex");
}
