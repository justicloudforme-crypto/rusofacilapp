import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { IntroDocument } from "@/lib/intro/pdf";
import { getIntroStats } from "@/lib/intro/bank";

export async function GET() {
  // The same numbers the deck on /[lang]/courses shows, from the same
  // reader — so the downloaded PDF can never quote a different content
  // bank than the page it was downloaded from.
  const stats = await getIntroStats();
  const buffer = await renderToBuffer(<IntroDocument stats={stats} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="rusofacilapp-introduccion.pdf"',
    },
  });
}
