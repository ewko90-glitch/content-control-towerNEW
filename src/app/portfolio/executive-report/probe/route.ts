import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/session";

function countPhrase(haystack: string, phrase: string): number {
  if (!phrase) {
    return 0;
  }
  const source = haystack.toLowerCase();
  const needle = phrase.toLowerCase();
  let index = 0;
  let hits = 0;

  while (index <= source.length - needle.length) {
    const foundAt = source.indexOf(needle, index);
    if (foundAt === -1) {
      break;
    }
    hits += 1;
    index = foundAt + needle.length;
  }

  return hits;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const queryString = request.nextUrl.search || "";
  const filter = request.nextUrl.searchParams.get("filter") ?? "all";
  const url = `${origin}/portfolio/executive-report${queryString}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "";
  const byteLength = buffer.byteLength;

  const isPdf = contentType.toLowerCase().includes("application/pdf");
  const hasBytes = byteLength > 1000;
  const minSizeThreshold = 30_000;
  const minSizeOk = byteLength > minSizeThreshold;

  const headSlice = new Uint8Array(buffer.slice(0, Math.min(byteLength, 200_000)));
  const headText = new TextDecoder("latin1").decode(headSlice);

  const textProbeHits = {
    auditTrail: countPhrase(headText, "Audit Trail"),
    signalsUsed: countPhrase(headText, "Signals used"),
    lastUpdate: countPhrase(headText, "Last adoption update"),
  };

  const textProbeInconclusive =
    textProbeHits.auditTrail === 0 && textProbeHits.signalsUsed === 0 && textProbeHits.lastUpdate === 0;

  const requestedNowIso = request.headers.get("x-now-iso");
  const timestamp = requestedNowIso && Number.isFinite(Date.parse(requestedNowIso)) ? new Date(requestedNowIso).toISOString() : new Date().toISOString();

  return NextResponse.json({
    ok: response.status === 200 && isPdf && hasBytes && minSizeOk,
    status: response.status,
    contentType,
    byteLength,
    checks: {
      isPdf,
      hasBytes,
      minSizeOk,
      textProbeInconclusive,
    },
    textProbeHits,
    filter,
    timestamp,
  });
}
