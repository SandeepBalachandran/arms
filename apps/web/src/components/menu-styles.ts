// Plain module (not "use client") so server components get the string itself;
// a constant exported from a client file arrives on the server as a reference.
export const menuItemClass =
  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm outline-none hover:bg-border/40 focus-visible:bg-border/40";
