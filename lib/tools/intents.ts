export type RequestIntent = "chat" | "research" | "image" | "video" | "pexels-photo" | "pexels-video";

const IMAGE_GENERATION_RE = /^\s*(?:please\s+)?(?:create|generate|make|draw|design|visualize|imagine)\s+(?:an?\s+)?(?:image|picture|photo|illustration|artwork|poster|wallpaper|logo|icon|portrait)\b/i;
const VIDEO_GENERATION_RE = /^\s*(?:please\s+)?(?:create|generate|make|produce|animate|render)\s+(?:a\s+)?(?:video|clip|movie|animation|reel|short)\b(?!\s+game\b)/i;
const EXPLICIT_RESEARCH_RE = /\b(?:search\s+(?:the\s+)?web|search\s+online|look(?:\s+this)?\s+up(?:\s+online)?|research\s+(?:this|it|online)?|check\s+(?:this|online)|verify\s+(?:this|it|online)|fact[- ]?check|cite\s+sources?|give\s+(?:me\s+)?sources?|with\s+sources?|show\s+sources?|latest\s+(?:news|information|updates?)\s+(?:about|on|for)|current\s+(?:news|information|status|events?)\s+(?:about|on|for)|what(?:'s| is)\s+(?:the\s+)?latest\s+(?:news|update|information)\s+(?:about|on|for))\b/i;
const PEXELS_RE = /\b(?:find|search|show|browse|get|give me|look for)\b[\s\S]{0,80}\b(?:photo|photos|image|images|picture|pictures|stock photo|video|videos|footage|clip|clips)\b|\b(?:from|on)\s+pexels\b/i;

export function detectRequestIntent(text: string): RequestIntent {
  const normalized = text.trim();
  if (!normalized) return "chat";
  if (VIDEO_GENERATION_RE.test(normalized)) return "video";
  if (IMAGE_GENERATION_RE.test(normalized)) return "image";
  if (PEXELS_RE.test(normalized)) return /\b(?:video|videos|footage|clip|clips)\b/i.test(normalized) ? "pexels-video" : "pexels-photo";
  if (EXPLICIT_RESEARCH_RE.test(normalized)) return "research";
  const studySpecific = /\b(?:act|scene|chapter|episode)\s*(?:[ivxlcdm]+|\d+)\b/i.test(normalized)
    && /^(?:who|what|when|where|why|how|which|explain|describe|give|state|tell)\b/i.test(normalized);
  return studySpecific ? "research" : "chat";
}

export function wantsWebSearch(text: string) { return detectRequestIntent(text) === "research"; }
export function wantsPexelsSearch(text: string) { const intent = detectRequestIntent(text); return intent === "pexels-photo" || intent === "pexels-video"; }
export function pexelsMediaKind(text: string): "photo" | "video" { return detectRequestIntent(text) === "pexels-video" ? "video" : "photo"; }
