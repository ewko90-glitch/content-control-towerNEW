import Link from "next/link";
import { redirect } from "next/navigation";

import { NewProjectWizard } from "@/components/projects/NewProjectWizard";
import { createProject } from "@/lib/projects/projectStore";
import { resolveActiveWorkspace } from "@/lib/projects/resolveActiveWorkspace";

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseLinks(value: string): Array<{ label: string; url: string }> {
  return value
    .split(/\n|,/) 
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [labelPart, urlPart] = line.split("|");
      return {
        label: (labelPart ?? "Link").trim(),
        url: (urlPart ?? "").trim(),
      };
    })
    .filter((row) => row.url.length > 0);
}

function parseChannels(value: string): Array<{ typ: "wordpress" | "shopify" | "linkedin" | "inne"; nazwa: string }> {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [typePart, namePart] = entry.split(":");
      const normalizedType = (typePart ?? "inne").trim().toLowerCase();
      const typ: "wordpress" | "shopify" | "linkedin" | "inne" =
        normalizedType === "wordpress" || normalizedType === "shopify" || normalizedType === "linkedin"
          ? normalizedType
          : "inne";

      return {
        typ,
        nazwa: (namePart ?? typePart ?? "Kanał").trim(),
      };
    });
}

export default async function NewProjectPage() {
  const activeWorkspace = await resolveActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/onboarding");
  }

  async function createProjectAction(formData: FormData) {
    "use server";

    const workspace = await resolveActiveWorkspace();
    if (!workspace) {
      redirect("/onboarding");
    }

    const nazwa = String(formData.get("nazwa") ?? "").trim();
    const typ = String(formData.get("typ") ?? "domena").trim() === "linkedin_osoba" ? "linkedin_osoba" : "domena";
    const domenaLubKanal = String(formData.get("domenaLubKanal") ?? "").trim();
    const jezyk = String(formData.get("jezyk") ?? "pl").trim() === "en" ? "en" : "pl";
    const tonRaw = String(formData.get("tonKomunikacji") ?? "profesjonalny").trim();
    const tonKomunikacji =
      tonRaw === "dynamiczny" || tonRaw === "techniczny" || tonRaw === "ludzki" ? tonRaw : "profesjonalny";
    const grupaDocelowa = String(formData.get("grupaDocelowa") ?? "").trim();

    // Nowe pola socialProfiles
    const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();
    const linkedinUrl = String(formData.get("linkedinUrl") ?? "").trim();
    const blogUrl = String(formData.get("blogUrl") ?? "").trim();
    const instagramUrl = String(formData.get("instagramUrl") ?? "").trim();
    const newsletterUrl = String(formData.get("newsletterUrl") ?? "").trim();

    const project = createProject(workspace.workspace.id, {
      nazwa,
      typ,
      domenaLubKanal,
      jezyk,
      tonKomunikacji,
      grupaDocelowa,
      glowneKlastry: parseCommaList(String(formData.get("glowneKlastry") ?? "")),
      slowaKluczowe: parseCommaList(String(formData.get("slowaKluczowe") ?? "")),
      konkurenci: parseCommaList(String(formData.get("konkurenci") ?? "")),
      linkiWewnetrzne: parseLinks(String(formData.get("linkiWewnetrzne") ?? "")),
      linkiZewnetrzne: parseLinks(String(formData.get("linkiZewnetrzne") ?? "")),
      kanaly: parseChannels(String(formData.get("kanaly") ?? "")),
      cadence: {
        dniTygodnia: parseCommaList(String(formData.get("dniTygodnia") ?? ""))
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7),
        czestotliwoscTygodniowa: Math.max(1, Number(String(formData.get("czestotliwoscTygodniowa") ?? "1"))),
      },
      socialProfiles: {
        websiteUrl: websiteUrl || undefined,
        linkedinUrl: linkedinUrl || undefined,
        blogUrl: blogUrl || undefined,
        instagramUrl: instagramUrl || undefined,
        newsletterUrl: newsletterUrl || undefined,
      },
    });

    redirect(`/projects/${project.id}/calendar?created=1`);
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <header className="mb-6">
        <p className="text-sm text-[#5B7CFA]">Workspace: {activeWorkspace.workspace.name}</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#0F172A]">Nowy projekt</h1>
        <p className="mt-2 text-sm text-[#475569]">Przejdź przez onboarding i utwórz kontekst operacyjny projektu.</p>
        <Link href="/projects" className="mt-4 inline-flex text-sm font-medium text-[#5B7CFA] hover:underline">
          ← Wróć do projektów
        </Link>
      </header>

      <NewProjectWizard action={createProjectAction} />
    </section>
  );
}
