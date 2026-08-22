export function wantsWebSearch(
  text: string
) {
  return /\b(search the web|browse the web|web search|look online|latest|today|current|news|recent)\b/i.test(
    text
  );
}