"use client";

import { useState } from "react";

type AnalysisResult = {
  keywords: string[];
  tone: string;
  audience: string;
  summary: string;
};

type AiSiteAnalyzerProps = {
  onApply?: (result: AnalysisResult) => void;
  initialUrl?: string;
};

async function mockAnalyzeSite(url: string): Promise<AnalysisResult> {
  await new Promise((resolve) => setTimeout(resolve, 1800));
  const domain = url.replace(/https?:\/\//, "").split("/")[0] ?? url;
  return {
    keywords: [
      domain.split(".")[0] ?? "produkt",
      "rozwiazania biznesowe",
      "profesjonalne uslugi",
      "innowacje",
      "efektywnosc",
      "transformacja cyfrowa",
    ],
    tone: "profesjonalny",
    audience: "Menedzerowie i decydenci w firmach B2B szukajacy sprawdzonych rozwiazan biznesowych.",
    summary: `Marka operujaca w obszarze ${domain} — dostarcza rozwiazania dla klientow biznesowych z naciskiem na jakosc i efektywnosc.`,
  };
}

export function AiSiteAnalyzer({ onApply, initialUrl = "" }: AiSiteAnalyzerProps) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleAnalyze() {
    if (!url.trim()) {
      setError("Podaj adres URL strony.");
      return;
    }
    setError(null);
    setResult(null);
    setApplied(false);
    setLoading(true);
    try {
      const data = await mockAnalyzeSite(url.trim());
      setResult(data);
    } catch {
      setError("Nie udalo sie przeanalizowac strony. Sprawdz URL i sprobuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result || !onApply) return;
    onApply(result);
    setApplied(true);
  }

  return (
    <div className="rounded-2xl border border-[#5B7CFA]/30 bg-[#F0F4FF] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🔍</span>
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A]">Analiza strony przez AI</h3>
          <p className="text-xs text-[#64748B]">
            Wpisz URL — AI przeanalizuje strone i zaproponuje slowa kluczowe, ton i opis marki.
          </p>
        </div>
        <span className="ml-auto rounded-full bg-[#5B7CFA]/10 px-2 py-0.5 text-[10px] font-medium text-[#5B7CFA]">
          Beta
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://twojafirma.pl"
          className="h-10 flex-1 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A]"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAnalyze(); } }}
        />
        <button
          type="button"
          onClick={() => void handleAnalyze()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5B7CFA] px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Analizuję..." : "Analizuj"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-[#E2E8F0]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[#E2E8F0]" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-[#E2E8F0]" />
        </div>
      ) : null}

      {result && !loading ? (
        <div className="mt-3 space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-3">
          <div>
            <p className="text-xs font-medium text-[#475569]">Sugerowane slowa kluczowe</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {result.keywords.map((kw) => (
                <span key={kw} className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] text-[#5B7CFA]">
                  {kw}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[#475569]">Ton komunikacji</p>
            <p className="mt-0.5 text-sm text-[#0F172A]">{result.tone}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#475569]">Grupa docelowa</p>
            <p className="mt-0.5 text-sm text-[#0F172A]">{result.audience}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#475569]">Opis marki</p>
            <p className="mt-0.5 text-sm text-[#0F172A]">{result.summary}</p>
          </div>

          {onApply ? (
            <button
              type="button"
              onClick={handleApply}
              disabled={applied}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-[#5B7CFA] px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {applied ? "✓ Zastosowano" : "Zastosuj w projekcie"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
