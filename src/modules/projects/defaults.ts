import type { ProjectContextInput } from "./types";

export type ProjectTemplate = {
  id: "blog-first" | "linkedin-first";
  label: string;
  description: string;
  context: Omit<ProjectContextInput, "name">;
};

export const defaultProjectContext: Omit<ProjectContextInput, "name"> = {
  summary: "",
  audience: "",
  toneOfVoice: "",
  goals: "",
  channels: [],
  keywordsPrimary: [],
  keywordsSecondary: [],
  internalLinks: [
    { url: "", title: "", note: "", anchorHints: [] },
    { url: "", title: "", note: "", anchorHints: [] },
    { url: "", title: "", note: "", anchorHints: [] },
  ],
  externalLinks: [{ url: "", title: "", note: "" }],
};

export const projectTemplates: ProjectTemplate[] = [
  {
    id: "blog-first",
    label: "Content Marketing — Blog na pierwszym miejscu",
    description: "Dlugodystansowy content z glebokim SEO i linkowaniem zorientowanym na konwersje.",
    context: {
      summary:
        "Buduj autorytet w kategorii poprzez edukacyjny content blogowy skupiony na wyszukiwarce, ktory konsekwentnie zamienia czytelnikow w rozmowy biznesowe.",
      audience:
        "Liderzy marketingu i wzrostu w firmach B2B, ktorzy potrzebuja przewidywalnych systemow contentowych, silniejszego zasięgu organicznego i lepszej konwersji z content marketingu.",
      toneOfVoice: "Strategiczny, klarowny, ekspercki, praktyczny",
      goals:
        "Zwiekszenie kwalifikowanego ruchu organicznego, poprawa autorytetu tematycznego i mierzalna konwersja z contentu edukacyjnego w komercyjne zapytania.",
      channels: ["blog", "newsletter"],
      keywordsPrimary: ["strategia contentu", "content b2b", "framework seo", "workflow redakcyjny", "operacje contentowe"],
      keywordsSecondary: ["klastry tematyczne", "copywriting konwertujacy", "planowanie redakcyjne"],
      internalLinks: [
        {
          url: "https://twoja-domena.pl/oferta",
          title: "Oferta",
          note: "Zastap adresem URL swojej strony z oferta.",
          anchorHints: ["usluga strategii contentu", "wsparcie content b2b"],
        },
        {
          url: "https://twoja-domena.pl/case-studies",
          title: "Case studies",
          note: "Wskazuj na strony z dowodami i wynikami.",
          anchorHints: ["wyniki content marketingu", "efekty dla klientow"],
        },
        {
          url: "https://twoja-domena.pl/blog",
          title: "Blog hub",
          note: "Uzyj jako strony glownej klastra tematycznego.",
          anchorHints: ["powiazane poradniki", "czytaj dalej"],
        },
      ],
      externalLinks: [
        {
          url: "https://developers.google.com/search/docs",
          title: "Google Search Central",
          note: "Odwolaj sie do wytycznych technicznych i jakosciowych.",
        },
      ],
    },
  },
  {
    id: "linkedin-first",
    label: "Marka Foundera — LinkedIn na pierwszym miejscu",
    description: "System narracji eksperta zoptymalizowany pod zasieg tygodniowy, zaufanie i jakosc rozmow.",
    context: {
      summary:
        "Buduj autorytet foundera przez wysokiej jakosci content na LinkedIn, ktory zamienia ekspertyze w zaufanie, przychodzace rozmowy i strategiczne szanse biznesowe.",
      audience:
        "Founderzy, liderzy komercyjni i decydenci poszukujacy strategicznych partnerow, zainteresowani zwiezlym i praktycznym thought leadership.",
      toneOfVoice: "Pewny siebie, zwiezly, oparty na insightach, ludzki",
      goals:
        "Zwiekszenie kwalifikowanego zasiegu tygodniowego, poprawa jakosci zaangazowania i konwersja strategicznej uwagi w wartosciowe rozmowy biznesowe.",
      channels: ["linkedin", "newsletter"],
      keywordsPrimary: ["marka foundera", "strategia linkedin", "thought leadership", "content ekspercki", "pozycjonowanie marki"],
      keywordsSecondary: ["zaufanie odbiorcy", "rytm publikacji", "pipeline przychodzacy"],
      internalLinks: [
        {
          url: "https://twoja-domena.pl/about",
          title: "About",
          note: "Zastap adresem strony profilu i pozycjonowania foundera.",
          anchorHints: ["perspektywa foundera", "dlaczego istniejemy"],
        },
        {
          url: "https://twoja-domena.pl/services",
          title: "Services",
          note: "Kieruj strategiczny ruch na strone oferty.",
          anchorHints: ["wspolpraca", "model wspolpracy"],
        },
        {
          url: "https://twoja-domena.pl/resources",
          title: "Resources",
          note: "Wspieraj wiarygodnosc glebszymi materialami.",
          anchorHints: ["poglebiona analiza", "dowiedz sie wiecej"],
        },
      ],
      externalLinks: [
        {
          url: "https://business.linkedin.com/marketing-solutions",
          title: "LinkedIn Marketing Solutions",
          note: "Odwolaj sie do najlepszych praktyk i formatow platformy.",
        },
      ],
    },
  },
];

export function getTemplateById(id: string | null | undefined): ProjectTemplate | null {
  if (!id) {
    return null;
  }
  return projectTemplates.find((template) => template.id === id) ?? null;
}
