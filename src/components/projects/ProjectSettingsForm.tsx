"use client";

import { useState } from "react";

import { useProjectContext } from "@/components/projects/ProjectContext";
import { PermissionLockCard } from "@/components/team/PermissionLockCard";
import type { ProjectPolicies } from "@/lib/projects/projectStore";

type ProjectSettingsFormProps = {
  initialValues: {
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
  };
  initialPolicies: ProjectPolicies;
  onSave: (formData: FormData) => void;
  saved?: boolean;
};

export function ProjectSettingsForm({ initialValues, initialPolicies, onSave, saved = false }: ProjectSettingsFormProps) {
  const [error, setError] = useState<string | null>(null);
  const { permissions, requirePermission, currentRole, currentMember } = useProjectContext();
  const lock = requirePermission("projekt_ustawienia_edycja");
  const canEditPolicies = currentRole === "owner" || currentRole === "manager";

  function validateAndSubmit(formData: FormData) {
    const nazwa = String(formData.get("nazwa") ?? "").trim();
    const domenaLubKanal = String(formData.get("domenaLubKanal") ?? "").trim();
    const grupaDocelowa = String(formData.get("grupaDocelowa") ?? "").trim();

    if (!nazwa || !domenaLubKanal || !grupaDocelowa) {
      setError("Uzupełnij nazwę, domenę/kanał i grupę docelową.");
      return;
    }

    setError(null);
    onSave(formData);
  }

  return (
    <form action={validateAndSubmit} className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <input type="hidden" name="policyActorMemberId" value={currentMember.id} />
      <input type="hidden" name="policyActorName" value={currentMember.imie} />
      <input type="hidden" name="policyActorRole" value={currentRole ?? currentMember.role} />

      {lock.status === "brak_uprawnien" ? (
        <PermissionLockCard title="Brak uprawnień do edycji ustawień projektu" description={lock.powod} />
      ) : null}

      <fieldset disabled={!permissions.projekt_ustawienia_edycja} className="space-y-4 disabled:opacity-70">
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Podstawy</h3>
        <p className="mt-1 text-xs text-[#64748B]">Dane bazowe projektu i ton komunikacji.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input name="nazwa" defaultValue={initialValues.nazwa} placeholder="Nazwa projektu" className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm" />
          <select title="Typ projektu" name="typ" defaultValue={initialValues.typ} className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm">
            <option value="domena">Domena</option>
            <option value="linkedin_osoba">LinkedIn osoba</option>
          </select>
          <input name="domenaLubKanal" defaultValue={initialValues.domenaLubKanal} placeholder="Domena lub kanał" className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm md:col-span-2" />
          <select title="Język" name="jezyk" defaultValue={initialValues.jezyk} className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm">
            <option value="pl">polski</option>
            <option value="en">angielski</option>
          </select>
          <select title="Ton komunikacji" name="tonKomunikacji" defaultValue={initialValues.tonKomunikacji} className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm">
            <option value="profesjonalny">profesjonalny</option>
            <option value="dynamiczny">dynamiczny</option>
            <option value="techniczny">techniczny</option>
            <option value="ludzki">ludzki</option>
          </select>
          <textarea name="grupaDocelowa" defaultValue={initialValues.grupaDocelowa} placeholder="Grupa docelowa" className="min-h-[90px] rounded-xl border border-[#E2E8F0] p-3 text-sm md:col-span-2" />
        </div>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">SEO</h3>
        <div className="mt-3 grid gap-3">
          <textarea name="glowneKlastry" defaultValue={initialValues.glowneKlastry} placeholder="Klastry (po przecinku)" className="min-h-[80px] rounded-xl border border-[#E2E8F0] p-3 text-sm" />
          <textarea name="slowaKluczowe" defaultValue={initialValues.slowaKluczowe} placeholder="Słowa kluczowe (po przecinku)" className="min-h-[80px] rounded-xl border border-[#E2E8F0] p-3 text-sm" />
          <textarea name="konkurenci" defaultValue={initialValues.konkurenci} placeholder="Konkurenci (po przecinku)" className="min-h-[80px] rounded-xl border border-[#E2E8F0] p-3 text-sm" />
        </div>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Linkowanie</h3>
        <div className="mt-3 grid gap-3">
          <textarea name="linkiWewnetrzne" defaultValue={initialValues.linkiWewnetrzne} placeholder="Wewnętrzne: Etykieta|URL" className="min-h-[100px] rounded-xl border border-[#E2E8F0] p-3 text-sm" />
          <textarea name="linkiZewnetrzne" defaultValue={initialValues.linkiZewnetrzne} placeholder="Zewnętrzne: Etykieta|URL" className="min-h-[100px] rounded-xl border border-[#E2E8F0] p-3 text-sm" />
        </div>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Kanały i cadence</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <textarea name="kanaly" defaultValue={initialValues.kanaly} placeholder="kanał:nazwa, kanał:nazwa" className="min-h-[90px] rounded-xl border border-[#E2E8F0] p-3 text-sm md:col-span-2" />
          <input name="dniTygodnia" defaultValue={initialValues.dniTygodnia} placeholder="1,3,5" className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm" />
          <input name="czestotliwoscTygodniowa" defaultValue={initialValues.czestotliwoscTygodniowa} placeholder="3" className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm" />
        </div>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">Polityki projektu</h3>
            <p className="mt-1 text-xs text-[#64748B]">Kontrola użycia AI i workflow publikacji na poziomie projektu.</p>
          </div>
        </div>

        {!canEditPolicies ? (
          <div className="mt-3">
            <PermissionLockCard title="Brak uprawnień do polityk" description="Tylko owner i manager mogą edytować polityki projektu." />
          </div>
        ) : null}

        <fieldset disabled={!canEditPolicies} className="mt-3 space-y-3 disabled:opacity-70">
          <label className="flex items-center gap-2 text-sm text-[#334155]">
            <input type="checkbox" name="policy_aiEnabled" defaultChecked={initialPolicies.aiEnabled} className="h-4 w-4 rounded border-[#CBD5E1]" />
            AI włączone w tym projekcie
          </label>

          <label className="flex items-center gap-2 text-sm text-[#334155]">
            <input
              type="checkbox"
              name="policy_requireApprovalForPublish"
              defaultChecked={initialPolicies.requireApprovalForPublish}
              className="h-4 w-4 rounded border-[#CBD5E1]"
            />
            Wymagaj akceptacji przed publikacją
          </label>

          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2 text-xs text-[#64748B]">
            Role akceptujące publikacje: owner, manager
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#475569]">Limit generacji AI dziennie (0 = bez limitu)</label>
            <input
              type="number"
              min={0}
              title="Limit generacji AI dziennie"
              name="policy_dailyAiGenerationLimit"
              defaultValue={String(initialPolicies.dailyAiGenerationLimit)}
              className="h-10 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-[#475569]">Dozwolone typy generacji AI</p>
            <div className="flex flex-wrap gap-3 text-sm text-[#334155]">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="policy_allowedAiKinds" value="outline" defaultChecked={initialPolicies.allowedAiKinds.includes("outline")} className="h-4 w-4 rounded border-[#CBD5E1]" />
                Outline
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="policy_allowedAiKinds" value="draft" defaultChecked={initialPolicies.allowedAiKinds.includes("draft")} className="h-4 w-4 rounded border-[#CBD5E1]" />
                Draft
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="policy_allowedAiKinds" value="seo" defaultChecked={initialPolicies.allowedAiKinds.includes("seo")} className="h-4 w-4 rounded border-[#CBD5E1]" />
                SEO
              </label>
            </div>
          </div>
        </fieldset>
      </section>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved && permissions.projekt_ustawienia_edycja ? <p className="text-sm text-emerald-700">Zapisano ustawienia projektu.</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Zapisano polityki projektu.</p> : null}

      <button type="submit" disabled={!permissions.projekt_ustawienia_edycja} className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        Zapisz zmiany
      </button>
      </fieldset>
    </form>
  );
}
