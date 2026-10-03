// A shared 20px drawing grid keeps the small navigation icons optically aligned.
const paths = {
  home: '<path d="m3.25 8.5 6.75-5.25 6.75 5.25v7.25a1 1 0 0 1-1 1h-3.5v-5.5h-4.5v5.5h-3.5a1 1 0 0 1-1-1Z"/>',
  message: '<path d="M5.75 3.75h8.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-7L3.25 17V6.25a2.5 2.5 0 0 1 2.5-2.5Z"/>',
  clock: '<circle cx="10" cy="10" r="6.75"/><path d="M10 5.75v4.5l3 1.75"/>',
  cat: '<path d="m4.25 6.5-.75-3.25 4 1.75a9 9 0 0 1 5 0l4-1.75-.75 3.25a6 6 0 0 1 1.5 4c0 3.75-3 6.25-7.25 6.25S2.75 14.25 2.75 10.5a6 6 0 0 1 1.5-4Z"/><circle cx="7.25" cy="9.75" r=".6" fill="currentColor" stroke="none"/><circle cx="12.75" cy="9.75" r=".6" fill="currentColor" stroke="none"/><path d="m8.75 12 1.25.75 1.25-.75M10 12.75v1M2.75 11.75l2 .25m10.5 0 2-.25"/>',
  workflow: '<rect x="7.5" y="2.75" width="5" height="4.5" rx="1.25"/><rect x="2.75" y="12.75" width="5" height="4.5" rx="1.25"/><rect x="12.25" y="12.75" width="5" height="4.5" rx="1.25"/><path d="M10 7.25v3m-4.75 2.5v-2.5h9.5v2.5"/>',
  more: '<g fill="currentColor" stroke="none"><circle cx="4.5" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="15.5" cy="10" r="1"/></g>',
  settings: '<path d="M8.5 2.75h3l.4 1.8 1.6.95 1.8-.55 1.5 2.6-1.4 1.25v1.9l1.4 1.25-1.5 2.6-1.8-.55-1.6.95-.4 1.8h-3l-.4-1.8-1.6-.95-1.8.55-1.5-2.6 1.4-1.25v-1.9L3.7 7.55l1.5-2.6 1.8.55 1.6-.95Z"/><circle cx="10" cy="9.75" r="2.5"/>',
  folder: '<path d="M2.75 6V4.75A1.5 1.5 0 0 1 4.25 3.25h3.5L10 5h5.75a1.5 1.5 0 0 1 1.5 1.5v8.75a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M2.75 7.5h14.5"/>',
  folderOpen: '<path d="M3 8V4.75a1.5 1.5 0 0 1 1.5-1.5h3.25L10 5h5.25a1.5 1.5 0 0 1 1.5 1.5V8"/><path d="M5.15 8h11.6a1 1 0 0 1 .96 1.27l-1.65 5.89a1.5 1.5 0 0 1-1.44 1.09H4a1 1 0 0 1-.96-1.27l1.15-6.25A1 1 0 0 1 5.15 8Z"/>',
  file: '<path d="M11.5 2.75h-6A1.5 1.5 0 0 0 4 4.25v11.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-8.5Z"/><path d="M11.5 2.75v4.5H16M7 10.75h6M7 13.75h4.25"/>',
  code: '<path d="m6.5 6-4 4 4 4m7-8 4 4-4 4m-2-10-3 12"/>',
  edit: '<path d="M9 3.75H5A1.75 1.75 0 0 0 3.25 5.5v9A1.75 1.75 0 0 0 5 16.25h9a1.75 1.75 0 0 0 1.75-1.75V11M8.25 11.75l-.5 3 3-.5 6.5-6.5a1.77 1.77 0 0 0-2.5-2.5Zm5.25-5.5 2.5 2.5"/>',
  search: '<circle cx="8.75" cy="8.75" r="5.5"/><path d="m12.75 12.75 4 4"/>',
  bell: '<path d="M14.75 8a4.75 4.75 0 0 0-9.5 0c0 4-1.5 4.5-1.5 6.25h12.5c0-1.75-1.5-2.25-1.5-6.25ZM8.25 16.5a2 2 0 0 0 3.5 0"/>',
  left: '<path d="m11.75 5.75-4.25 4.25 4.25 4.25"/>',
  right: '<path d="m8.25 5.75 4.25 4.25-4.25 4.25"/>',
  down: '<path d="m5.75 8.25 4.25 4.25 4.25-4.25"/>',
  plus: '<path d="M10 4.25v11.5M4.25 10h11.5"/>',
  close: '<path d="m5.75 5.75 8.5 8.5m-8.5 0 8.5-8.5"/>',
  sidebar: '<rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2"/><path d="M7.25 3.75v12.5"/>',
  book: '<path d="M10 4.75c-2-1.25-4.5-1.5-7.25-.75v11.25c2.75-.75 5.25-.5 7.25.75 2-1.25 4.5-1.5 7.25-.75V4c-2.75-.75-5.25-.5-7.25.75Zm0 0V16"/>',
  star: '<path d="m10 2.75 2.2 4.5 4.95.7-3.6 3.5.85 4.95-4.4-2.35-4.4 2.35.85-4.95-3.6-3.5 4.95-.7Z"/>',
  check: '<path d="m4.25 10 3.5 3.5 8-8"/>',
  link: '<path d="m8.5 6.5 2.75-2.75a3.9 3.9 0 0 1 5.5 5.5L14 12a3.9 3.9 0 0 1-5.5 0m3 1.5-2.75 2.75a3.9 3.9 0 0 1-5.5-5.5L6 8a3.9 3.9 0 0 1 5.5 0"/>',
  arrow: '<path d="M3.75 10h12.5m-5-5 5 5-5 5"/>',
} as const;

export type IconName = keyof typeof paths;

export function icon(name: IconName, className = ""): string {
  return `<svg class="icon icon-${name} ${className}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
