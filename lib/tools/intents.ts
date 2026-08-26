export function wantsWebSearch(text: string) {
  // The Research toggle is the explicit user intent. AmbiShell only calls the
  // tool when settings.webSearch is enabled, so every non-empty prompt is
  // eligible for live research while that toggle is on.
  return text.trim().length > 0;
}
