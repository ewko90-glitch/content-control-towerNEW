export function executivePrintCss(): string {
  return `
@page {
  size: A4;
  margin: 12mm;
}

.exec-print-only {
  display: none;
}

@media print {
  body {
    background: #ffffff !important;
    color: #111827 !important;
  }

  body * {
    visibility: hidden !important;
  }

  #executive-print-root,
  #executive-print-root * {
    visibility: visible !important;
  }

  #executive-print-root {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 0;
    margin: 0;
    background: #ffffff !important;
  }

  .exec-print-only {
    display: block !important;
    margin-bottom: 10mm;
    border-bottom: 1px solid #d1d5db;
    padding-bottom: 4mm;
  }

  .exec-no-print {
    display: none !important;
  }

  .exec-print-block {
    page-break-inside: avoid;
    break-inside: avoid;
    border-color: #d1d5db !important;
    background: #ffffff !important;
    box-shadow: none !important;
  }
}
`;
}
