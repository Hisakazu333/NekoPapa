/** NekoBuddy's pixel paw (design-mockups/ai-chat-gpt icons.svg#pixel-paw): four toes and a pad on a 28px grid. */
export function PixelPawIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 28 28" fill="currentColor" aria-hidden className={className} shapeRendering="crispEdges">
    <path d="M8 1h4v6H8zm8 0h4v6h-4zM3 5h4v6H3zm18 0h4v6h-4zM9 12h10v4H9zm-4 4h18v4H5zm0 4h7v4H5zm11 0h7v4h-7z" />
  </svg>;
}

/** The same paw as twenty 4px blocks, for the effort slider's build-up animation. */
export const PIXEL_PAW_BLOCKS: readonly (readonly [number, number])[] = [
  [8, 1], [16, 1], [3, 5], [8, 5], [16, 5], [21, 5], [3, 9], [21, 9], [9, 12], [13, 12],
  [17, 12], [5, 16], [9, 16], [13, 16], [17, 16], [21, 16], [5, 20], [9, 20], [17, 20], [21, 20],
];
