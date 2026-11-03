"use client";

import type {ComponentProps} from "react";

// Every section is rendered by the mounted LifeHub shell. Updating the URL
// directly lets usePathname switch sections without waiting for an RSC fetch.
export default function SectionLink({onClick, ...props}: ComponentProps<"a">) {
  return <a {...props} onClick={event => {
    onClick?.(event);
    const anchor = event.currentTarget;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey ||
        (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
    const target = new URL(anchor.href);
    if (target.origin !== window.location.origin) return;
    event.preventDefault();
    if (target.href === window.location.href) return;
    window.history.pushState(null, "", target.pathname + target.search + target.hash);
    window.dispatchEvent(new Event("lifehub:navigate"));
    if (!target.hash) window.scrollTo(0, 0);
  }}/>;
}
