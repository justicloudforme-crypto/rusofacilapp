import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { IntroDocument } from "@/lib/intro/pdf";

export async function GET() {
  const buffer = await renderToBuffer(<IntroDocument />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="rusofasil-introduccion.pdf"',
    },
  });
}
