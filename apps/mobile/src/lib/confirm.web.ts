// Web version of lib/confirm.ts: the browser's own confirm dialog.
export function confirm({ title, message }: { title: string; message?: string; confirmText: string; cancelText?: string }) {
  return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
}
