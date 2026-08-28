export function wantsWebSearch(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  const explicit = /\b(research|search online|look (it )?up|check online|verify|fact[- ]?check|fact check|cite sources?|give sources?|with sources?|according to current|what is the latest|latest|current|today|recent|live)\b/.test(normalized);
  const studySpecific = /\b(?:act|scene|chapter|episode)\s*(?:[ivxlcdm]+|\d+)\b/.test(normalized)
    && /^(?:who|what|when|where|why|how|which|explain|describe|give|state|tell)\b/.test(normalized);
  return explicit || studySpecific;
}

export function wantsPexelsSearch(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return /\b(?:find|search|show|browse|get|give me|look for)\b[\s\S]{0,60}\b(?:photo|photos|image|images|picture|pictures|stock photo|video|videos|footage|clip|clips)\b/.test(normalized)
    || /\b(?:from|on)\s+pexels\b/.test(normalized);
}

export function pexelsMediaKind(text: string): "photo" | "video" {
  return /\b(?:video|videos|footage|clip|clips)\b/i.test(text) ? "video" : "photo";
}
