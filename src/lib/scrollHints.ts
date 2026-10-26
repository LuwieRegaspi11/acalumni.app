// Shows a soft fade on the right edge of any horizontally scrollable table box
// while there is more to swipe to — so on a phone people can tell a wide table
// continues off-screen (the fade disappears once they reach the end).
// Pure progressive enhancement: it only toggles the class `has-more-right`
// (styled in styles/mobile.css) and never changes layout or data.

const SELECTOR = '.overflow-x-auto, .overflow-auto, .MuiTableContainer-root';

function update(el: HTMLElement) {
  const more = el.scrollWidth > el.clientWidth + 2 && el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
  el.classList.toggle('has-more-right', more);
}

export function initScrollHints() {
  if (typeof window === 'undefined') return;
  const seen = new WeakSet<Element>();

  const attach = (el: HTMLElement) => {
    if (seen.has(el)) { update(el); return; }
    seen.add(el);
    el.addEventListener('scroll', () => update(el), { passive: true });
    update(el);
  };
  const scan = () => document.querySelectorAll<HTMLElement>(SELECTOR).forEach(attach);

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  scan();
}
