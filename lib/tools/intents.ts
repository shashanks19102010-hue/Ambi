export function wantsWebSearch(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;

  // Explicit research intent should work even when the persistent toggle is off.
  const explicit = /\b(research|search online|look (it )?up|check online|verify|fact[- ]?check|fact check|cite sources?|give sources?|with sources?|according to current|what is the latest|latest|current|today|recent|live)\b/.test(normalized);
  // Academic/work-specific questions benefit from source verification because a
  // small wording error can change the answer (for example, Act/Scene questions).
  const studySpecific = /\b(?:act|scene|chapter|episode)\s*(?:[ivxlcdm]+|\d+)\b/.test(normalized)
    && /^(?:who|what|when|where|why|how|which|explain|describe|give|state|tell)\b/.test(normalized);

  return explicit || studySpecific;
}
