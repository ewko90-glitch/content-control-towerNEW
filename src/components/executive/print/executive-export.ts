export function exportExecutivePdf(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("cct:exec:print:start"));

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("cct:exec:print:stop"));
      }, 120);
    });
  });
}
