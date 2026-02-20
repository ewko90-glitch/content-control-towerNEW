"use client";

import { useMemo, useState } from "react";

type NewProjectWizardProps = {
  action: (formData: FormData) => void;
};

type Krok = 1 | 2 | 3 | 4 | 5;

type FormState = {
  nazwa: string;
  typ: "domena" | "linkedin_osoba";
  domenaLubKanal: string;
  jezyk: "pl" | "en";
  tonKomunikacji: "profesjonalny" | "dynamiczny" | "techniczny" | "ludzki";
  grupaDocelowa: string;
  glowneKlastry: string;
  slowaKluczowe: string;
  konkurenci: string;
  linkiWewnetrzne: string;
  linkiZewnetrzne: string;
  kanaly: string;
  dniTygodnia: string;
  czestotliwoscTygodniowa: string;
  linkedinUrl: string;
  instagramUrl: string;
  blogUrl: string;
  newsletterUrl: string;
  websiteUrl: string;
};

const initialState: FormState = {
  nazwa: "",
  typ: "domena",
  domenaLubKanal: "",
  jezyk: "pl",
  tonKomunikacji: "profesjonalny",
  grupaDocelowa: "",
  glowneKlastry: "",
  slowaKluczowe: "",
  konkurenci: "",
  linkiWewnetrzne: "",
  linkiZewnetrzne: "",
  kanaly: "",
  dniTygodnia: "1,3,5",
  czestotliwoscTygodniowa: "3",
  linkedinUrl: "",
  instagramUrl: "",
  blogUrl: "",
  newsletterUrl: "",
  websiteUrl: "",
};

function parseList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

export function NewProjectWizard({ action }: NewProjectWizardProps) {
  const [krok, setKrok] = useState<Krok>(1);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialState);

  const progress = useMemo(() => (krok / 5) * 100, [krok]);
  const progressWidthClass = useMemo(() => {
    if (krok === 1) {
      return "w-1/5";
    }
    if (krok === 2) {
      return "w-2/5";
    }
    if (krok === 3) {
      return "w-3/5";
    }
    if (krok === 4) {
      return "w-4/5";
    }
    return "w-full";
  }, [krok]);

  function validateCurrentStep(): boolean {
    if (krok === 1) {
      if (!form.nazwa.trim() || !form.domenaLubKanal.trim() || !form.grupaDocelowa.trim()) {
        setError("Uzupełnij nazwę, domenę/kanał i grupę docelową.");
        return false;
      }
    }
    if (krok === 2) {
      if (parseList(form.glowneKlastry).length === 0 || parseList(form.slowaKluczowe).length === 0) {
        setError("Podaj co najmniej 1 klaster i 1 słowo kluczowe.");
        return false;
      }
    }
    if (krok === 3) {
      if (!form.linkiWewnetrzne.trim()) {
        setError("Dodaj przynajmniej 1 link wewnętrzny (format: Etykieta|URL).");
        return false;
      }
    }
    if (krok === 4) {
      if (!form.kanaly.trim()) {
        setError("Podaj przynajmniej 1 kanał publikacji (format: typ:nazwa).");
        return false;
      }
      if (parseList(form.dniTygodnia).length === 0 || !form.czestotliwoscTygodniowa.trim()) {
        setError("Podaj dni tygodnia i częstotliwość publikacji.");
        return false;
      }
    }
    setError(null);
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) {
      return;
    }
    setKrok((value) => Math.min(5, value + 1) as Krok);
  }

  function prevStep() {
    setError(null);
    setKrok((value) => Math.max(1, value - 1) as Krok);
  }

  return (
    <form action={action} className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] md:p-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-[#94A3B8]">
          <span>Krok {krok} z 5</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
          <div className={`h-full bg-[#5B7CFA] ${progressWidthClass}`} />
        </div>
      </div>

      {krok === 1 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0F172A]">1) Podstawy</h2>
          <p className="text-sm text-[#475569]">Nadaj projektowi kontekst biznesowy i komunikacyjny.</p>

          <input name="nazwa" value={form.nazwa} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} placeholder="Np. CRM dla MŚP" className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]" />
          <select title="Typ projektu" name="typ" value={form.typ} onChange={(e) => setForm({ ...form, typ: e.target.value as FormState["typ"] })} className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]">
            <option value="domena">Domena</option>
            <option value="linkedin_osoba">LinkedIn osoba</option>
          </select>
          <input name="domenaLubKanal" value={form.domenaLubKanal} onChange={(e) => setForm({ ...form, domenaLubKanal: e.target.value })} placeholder="Np. crmexpert.pl lub LinkedIn: Jan Kowalski" className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]" />
          <div className="grid gap-3 md:grid-cols-2">
            <select title="Język komunikacji" name="jezyk" value={form.jezyk} onChange={(e) => setForm({ ...form, jezyk: e.target.value as FormState["jezyk"] })} className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]">
              <option value="pl">polski</option>
              <option value="en">angielski</option>
            </select>
            <select title="Ton komunikacji" name="tonKomunikacji" value={form.tonKomunikacji} onChange={(e) => setForm({ ...form, tonKomunikacji: e.target.value as FormState["tonKomunikacji"] })} className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]">
              <option value="profesjonalny">profesjonalny</option>
              <option value="dynamiczny">dynamiczny</option>
              <option value="techniczny">techniczny</option>
              <option value="ludzki">ludzki</option>
            </select>
          </div>
          <textarea name="grupaDocelowa" value={form.grupaDocelowa} onChange={(e) => setForm({ ...form, grupaDocelowa: e.target.value })} placeholder="Np. founderzy SaaS i managerowie marketingu B2B" className="min-h-[96px] w-full rounded-2xl border border-[#E2E8F0] p-3 text-sm text-[#0F172A]" />
        </div>
      ) : null}

      {krok === 2 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0F172A]">2) SEO i strategia</h2>
          <p className="text-sm text-[#475569]">Wpisuj listy po przecinku.</p>

          <textarea name="glowneKlastry" value={form.glowneKlastry} onChange={(e) => setForm({ ...form, glowneKlastry: e.target.value })} placeholder="CRM, automatyzacja, sprzedaż B2B" className="min-h-[88px] w-full rounded-2xl border border-[#E2E8F0] p-3 text-sm text-[#0F172A]" />
          <textarea name="slowaKluczowe" value={form.slowaKluczowe} onChange={(e) => setForm({ ...form, slowaKluczowe: e.target.value })} placeholder="wdrożenie CRM, automatyzacja leadów" className="min-h-[88px] w-full rounded-2xl border border-[#E2E8F0] p-3 text-sm text-[#0F172A]" />
          <textarea name="konkurenci" value={form.konkurenci} onChange={(e) => setForm({ ...form, konkurenci: e.target.value })} placeholder="hubspot.com, pipedrive.com" className="min-h-[88px] w-full rounded-2xl border border-[#E2E8F0] p-3 text-sm text-[#0F172A]" />
        </div>
      ) : null}

      {krok === 3 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0F172A]">3) Linkowanie</h2>
          <p className="text-sm text-[#475569]">Format każdego wiersza: Etykieta|URL</p>

          <textarea name="linkiWewnetrzne" value={form.linkiWewnetrzne} onChange={(e) => setForm({ ...form, linkiWewnetrzne: e.target.value })} placeholder="Oferta CRM|https://twojadomena.pl/oferta" className="min-h-[120px] w-full rounded-2xl border border-[#E2E8F0] p-3 text-sm text-[#0F172A]" />
          <textarea name="linkiZewnetrzne" value={form.linkiZewnetrzne} onChange={(e) => setForm({ ...form, linkiZewnetrzne: e.target.value })} placeholder="Raport Gartner|https://example.com/report" className="min-h-[120px] w-full rounded-2xl border border-[#E2E8F0] p-3 text-sm text-[#0F172A]" />
        </div>
      ) : null}

      {krok === 4 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0F172A]">4) Profile i kanały</h2>
          <p className="text-sm text-[#475569]">
            Podaj URLe swoich kanałów — AI będzie wiedział gdzie publikujesz.
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">
                Strona WWW / domena
              </label>
              <input
                name="websiteUrl"
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                placeholder="https://twojafirma.pl"
                className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">
                LinkedIn (profil lub strona firmy)
              </label>
              <input
                name="linkedinUrl"
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/jankowalski"
                className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">
                Blog / WordPress
              </label>
              <input
                name="blogUrl"
                value={form.blogUrl}
                onChange={(e) => setForm({ ...form, blogUrl: e.target.value })}
                placeholder="https://twojafirma.pl/blog"
                className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">
                Instagram
              </label>
              <input
                name="instagramUrl"
                value={form.instagramUrl}
                onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
                placeholder="https://instagram.com/twojasmarka"
                className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">
                Newsletter (URL strony zapisu)
              </label>
              <input
                name="newsletterUrl"
                value={form.newsletterUrl}
                onChange={(e) => setForm({ ...form, newsletterUrl: e.target.value })}
                placeholder="https://twojafirma.pl/newsletter"
                className="h-11 w-full rounded-2xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-xs font-medium text-[#475569]">
              Kanały publikacji (harmonogram)
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <input
                name="dniTygodnia"
                value={form.dniTygodnia}
                onChange={(e) => setForm({ ...form, dniTygodnia: e.target.value })}
                placeholder="Dni tygodnia np. 1,3,5"
                className="h-10 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]"
              />
              <input
                name="czestotliwoscTygodniowa"
                value={form.czestotliwoscTygodniowa}
                onChange={(e) => setForm({ ...form, czestotliwoscTygodniowa: e.target.value })}
                placeholder="Posty tygodniowo np. 3"
                className="h-10 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]"
              />
            </div>
            <input
              name="kanaly"
              value={form.kanaly}
              onChange={(e) => setForm({ ...form, kanaly: e.target.value })}
              placeholder="wordpress:Blog, linkedin:Profil CEO"
              className="mt-2 h-10 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm text-[#0F172A]"
            />
          </div>
        </div>
      ) : null}

      {krok === 5 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0F172A]">5) Podsumowanie</h2>
          <p className="text-sm text-[#475569]">Sprawdź dane projektu przed utworzeniem.</p>

          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[#475569]">
            <p><span className="font-medium text-[#0F172A]">Nazwa:</span> {form.nazwa || "—"}</p>
            <p><span className="font-medium text-[#0F172A]">Typ:</span> {form.typ}</p>
            <p><span className="font-medium text-[#0F172A]">Domena/Kanał:</span> {form.domenaLubKanal || "—"}</p>
            <p><span className="font-medium text-[#0F172A]">Grupa docelowa:</span> {form.grupaDocelowa || "—"}</p>
            <p><span className="font-medium text-[#0F172A]">Klastry:</span> {form.glowneKlastry || "—"}</p>
            <p><span className="font-medium text-[#0F172A]">Kanały:</span> {form.kanaly || "—"}</p>
            <p><span className="font-medium text-[#0F172A]">LinkedIn:</span> {form.linkedinUrl || "—"}</p>
            <p><span className="font-medium text-[#0F172A]">Blog:</span> {form.blogUrl || "—"}</p>
            <p><span className="font-medium text-[#0F172A]">Instagram:</span> {form.instagramUrl || "—"}</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <button
          type="button"
          onClick={prevStep}
          disabled={krok === 1}
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#475569] disabled:opacity-50"
        >
          Wstecz
        </button>

        {krok < 5 ? (
          <button
            type="button"
            onClick={nextStep}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-5 text-sm font-medium text-white transition-colors hover:bg-[#4F6EF5]"
          >
            Dalej
          </button>
        ) : (
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-5 text-sm font-medium text-white transition-colors hover:bg-[#4F6EF5]"
          >
            Utwórz projekt
          </button>
        )}
      </div>
    </form>
  );
}
