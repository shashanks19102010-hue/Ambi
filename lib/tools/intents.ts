export type RequestIntent="chat"|"research"|"pexels-photo"|"pexels-video";

const IMAGE_RE=/\b(?:create|generate|make|draw|design|visualize|imagine|find|search|show|browse|get)\b[\s\S]{0,90}\b(?:image|images|photo|photos|picture|pictures|illustration|artwork|poster|wallpaper|logo|icon|portrait|stock photo)\b|\b(?:from|on)\s+pexels\b/i;
const VIDEO_RE=/\b(?:create|generate|make|produce|animate|render|find|search|show|browse|get)\b[\s\S]{0,90}\b(?:video|videos|footage|clip|clips|animation|reel|short)\b|\b(?:from|on)\s+pexels\b/i;
const EXPLICIT_RESEARCH_RE=/\b(?:search\s+(?:the\s+)?web|search\s+online|look(?:\s+this)?\s+up(?:\s+online)?|research\s+(?:this|it|online)?|check\s+(?:this|online)|verify\s+(?:this|it|online)|fact[- ]?check|cite\s+sources?|give\s+(?:me\s+)?sources?|with\s+sources?|show\s+sources?|latest\s+(?:news|information|updates?)\s+(?:about|on|for)|current\s+(?:news|information|status|events?)\s+(?:about|on|for)|what(?:'s| is)\s+(?:the\s+)?latest\s+(?:news|update|information)\s+(?:about|on|for))\b/i;

export function detectRequestIntent(text:string):RequestIntent{
 const normalized=text.trim();if(!normalized)return"chat";
 if(VIDEO_RE.test(normalized)&&!IMAGE_RE.test(normalized))return"pexels-video";
 if(IMAGE_RE.test(normalized))return VIDEO_RE.test(normalized)?"pexels-video":"pexels-photo";
 if(EXPLICIT_RESEARCH_RE.test(normalized))return"research";
 const studySpecific=/\b(?:act|scene|chapter|episode)\s*(?:[ivxlcdm]+|\d+)\b/i.test(normalized)&&/^(?:who|what|when|where|why|how|which|explain|describe|give|state|tell)\b/i.test(normalized);
 return studySpecific?"research":"chat";
}
export function wantsWebSearch(text:string){return detectRequestIntent(text)==="research";}
export function wantsPexelsSearch(text:string){const intent=detectRequestIntent(text);return intent==="pexels-photo"||intent==="pexels-video";}
export function pexelsMediaKind(text:string):"photo"|"video"{return detectRequestIntent(text)==="pexels-video"?"video":"photo";}