const DANGEROUS_PATTERNS = [
  /\b(?:build|make|assemble)\b.*\b(?:bomb|explosive)\b/i,

  /\b(?:malware|ransomware|keylogger|credential\s*stealer)\b/i,

  /\b(?:bypass|disable|evade)\b.*\b(?:security|antivirus|parental control)\b/i
];

export interface SafetyDecision {
  allowed: boolean;
  reason?: string;
}

export function checkUserMessage(
  text: string
): SafetyDecision {
  if (text.length > 12000) {
    return {
      allowed: false,
      reason:
        "Message is too large to process safely."
    };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        reason:
          "Ambi blocked a potentially dangerous request."
      };
    }
  }

  return {
    allowed: true
  };
}

export function sanitizeExternalText(
  text: string
) {
  return text
    .replaceAll("\u0000", "")
    .slice(0, 12000);
}