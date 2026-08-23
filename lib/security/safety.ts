import { MAX_MESSAGE_LENGTH, SENSITIVE_PATTERNS } from "@/lib/constants";

export interface SafetyDecision { allowed: boolean; reason?: string; risk: "low" | "medium" | "high"; }

const dangerousPatterns = [
  /\b(?:build|make|assemble)\b.*\b(?:bomb|explosive|weapon)\b/i,
  /\b(?:malware|ransomware|keylogger|credential\s*stealer)\b/i,
  /\b(?:bypass|disable|evade)\b.*\b(?:security|antivirus|parental control)\b/i
];
const injectionPatterns = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+message\s*:/i,
  /reveal\s+(the\s+)?(system|developer)\s+prompt/i,
  /show\s+(me\s+)?(?:secrets|credentials|api\s*keys)/i,
  /disable\s+(safety|security)/i
];

export function checkUserMessage(input: string): SafetyDecision {
  const text = input.trim();
  if (!text) return { allowed: false, reason: "Please enter a message.", risk: "low" };
  if (text.length > MAX_MESSAGE_LENGTH) return { allowed: false, reason: `This message is too long. Keep it under ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`, risk: "medium" };
  if (dangerousPatterns.some((pattern) => pattern.test(text))) return { allowed: false, reason: "Ambi blocked a potentially dangerous request. I can still help with safe, defensive or educational information.", risk: "high" };
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))) return { allowed: true, reason: "Potential secret detected; Ambi will avoid retaining or exposing it.", risk: "medium" };
  return { allowed: true, risk: injectionPatterns.some((pattern) => pattern.test(text)) ? "medium" : "low" };
}

export function sanitizeExternalText(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/\b(ignore|override|follow these instructions|system message)\b/gi, "[untrusted instruction text]").replaceAll("\u0000", "").slice(0, 5000);
}

export function redactSecrets(input: string): string {
  let value = input;
  for (const pattern of SENSITIVE_PATTERNS) value = value.replace(pattern, "[REDACTED]");
  return value;
}
