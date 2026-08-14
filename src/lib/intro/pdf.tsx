import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Svg, Path, Circle, Rect, StyleSheet, Font } from "@react-pdf/renderer";
import { introSlides } from "./content";
import { INTRO_ILLUSTRATION_VIEWBOX, introSlideIllustrations, type IntroIconKey, type IntroIllustrationColorRole } from "./slideIcons";

// Same brand palette as src/lib/lessons/pdf.tsx (and src/app/globals.css'
// --brand / --brand-accent custom properties) — kept in sync manually
// since react-pdf can't read CSS variables. Also mirrors the COLORS map in
// src/components/intro/IntroIllustration.tsx, which draws the same shape
// data on the web.
const BRAND = "#3730a3";
const BRAND_LIGHT = "#4f46e5";
const BRAND_ACCENT = "#b45309";
const BRAND_ACCENT_LIGHT = "#d97706";
const BRAND_TINT = "#f2f1fb";
const INK = "#1f2130";
const INK_SOFT = "#4b4d5e";

const SHAPE_COLORS: Record<IntroIllustrationColorRole, string> = {
  brand: BRAND,
  brandLight: BRAND_LIGHT,
  accent: BRAND_ACCENT,
  accentLight: BRAND_ACCENT_LIGHT,
  ink: INK,
  inkSoft: INK_SOFT,
  muted: "#e4e4ef",
  white: "#ffffff",
  danger: "#dc2626",
};

const SPARKLE_PATH = "M12 3 C13 8 15 10 21 12 C15 14 13 16 12 21 C11 16 9 14 3 12 C9 10 11 8 12 3 Z";

// react-pdf's built-in "Helvetica" only covers WinAnsi (Latin) glyphs — this
// deck has Cyrillic vocabulary throughout the illustrations and the
// literature slide. PT Sans covers Cyrillic + Latin. See src/lib/lessons/pdf.tsx
// for the fuller explanation (same fix, same font).
const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf-fonts");
Font.register({
  family: "PT Sans",
  fonts: [
    { src: path.join(FONTS_DIR, "PTSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "PTSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingBottom: 56, fontSize: 11, lineHeight: 1.55, color: INK, fontFamily: "PT Sans" },
  topBar: { height: 8, backgroundColor: BRAND },

  // Cover page
  coverBody: { padding: 40, flexGrow: 1, justifyContent: "center" },
  coverEyebrow: {
    fontSize: 10,
    fontWeight: 700,
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  coverTitle: { fontSize: 28, fontWeight: 700, color: INK, marginBottom: 10 },
  coverSubtitle: { fontSize: 12, color: INK_SOFT },
  coverAccentBar: { width: 64, height: 5, backgroundColor: BRAND_ACCENT_LIGHT, borderRadius: 3, marginTop: 22 },
  coverBrandMark: { position: "absolute", top: 24, right: 40 },

  // Content pages
  content: { paddingTop: 32, paddingHorizontal: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  illustrationPanel: {
    width: 168,
    height: 118,
    borderRadius: 14,
    backgroundColor: BRAND_TINT,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrowChip: {
    marginTop: 18,
    alignSelf: "flex-start",
    backgroundColor: BRAND_TINT,
    color: BRAND,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  slideTitle: { fontSize: 18, fontWeight: 700, color: INK, marginTop: 10, marginBottom: 14 },
  paragraph: { marginBottom: 8, fontSize: 10.5, color: INK_SOFT },
  highlightsBox: {
    marginTop: 8,
    backgroundColor: BRAND_TINT,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bullet: { flexDirection: "row", marginBottom: 5, alignItems: "flex-start" },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND_ACCENT_LIGHT, marginTop: 3, marginRight: 8 },
  bulletText: { flex: 1, fontSize: 10.5, color: INK },

  // Brand mark (full wordmark, top-right corner of every page)
  brandMarkPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#e9e7fa",
  },
  brandMarkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BRAND_ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 5,
  },
  brandMarkWordmark: { fontSize: 9.5, fontWeight: 700, color: BRAND },

  // Footer
  footerBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    borderTopWidth: 1,
    borderTopColor: "#e7e6f4",
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 8, color: "#8a8ba0" },
});

/** Renders the same shape recipe as IntroIllustration.tsx (web) using
 * react-pdf's Svg primitives, so the deck and its PDF export show the same
 * illustration for a given slide. Mirrors PdfIllustration in
 * src/lib/lessons/pdf.tsx. */
function PdfIllustration({ icon }: { icon: IntroIconKey }) {
  const shapes = introSlideIllustrations[icon] ?? [];
  return (
    <Svg width={INTRO_ILLUSTRATION_VIEWBOX.width} height={INTRO_ILLUSTRATION_VIEWBOX.height} viewBox="0 0 160 120">
      {shapes.map((shape, i) => {
        const key = `${icon}-${i}`;
        if (shape.kind === "circle") {
          return (
            <Circle
              key={key}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              fill={shape.fill ? SHAPE_COLORS[shape.fill] : "none"}
              stroke={shape.stroke ? SHAPE_COLORS[shape.stroke] : undefined}
              strokeWidth={shape.strokeWidth}
              opacity={shape.opacity}
            />
          );
        }
        if (shape.kind === "rect") {
          return (
            <Rect
              key={key}
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              rx={shape.rx}
              fill={SHAPE_COLORS[shape.fill]}
              opacity={shape.opacity}
            />
          );
        }
        if (shape.kind === "path") {
          return (
            <Path
              key={key}
              d={shape.d}
              fill={shape.fill ? SHAPE_COLORS[shape.fill] : "none"}
              stroke={shape.stroke ? SHAPE_COLORS[shape.stroke] : undefined}
              strokeWidth={shape.strokeWidth}
              strokeLinecap={shape.round ? "round" : undefined}
              strokeLinejoin={shape.round ? "round" : undefined}
              opacity={shape.opacity}
            />
          );
        }
        return (
          <Text
            key={key}
            x={shape.x}
            y={shape.y}
            fill={SHAPE_COLORS[shape.fill]}
            style={{ fontFamily: "PT Sans", fontSize: shape.size, fontWeight: shape.bold ? 700 : 400 }}
            textAnchor={shape.anchor ?? "start"}
            opacity={shape.opacity}
          >
            {shape.content}
          </Text>
        );
      })}
    </Svg>
  );
}

function BrandMarkPdf() {
  return (
    <View style={styles.brandMarkPill}>
      <View style={styles.brandMarkCircle}>
        <Svg width={9} height={9} viewBox="0 0 24 24">
          <Path d={SPARKLE_PATH} fill="#ffffff" />
        </Svg>
      </View>
      <Text style={styles.brandMarkWordmark}>RusoFásil</Text>
    </View>
  );
}

function FooterPdf({ page, total }: { page: number; total: number }) {
  return (
    <View style={styles.footerBar} fixed>
      <Text style={styles.footerText}>RusoFásil — aprende ruso desde México</Text>
      <Text style={styles.footerText}>
        {page} / {total}
      </Text>
    </View>
  );
}

export function IntroDocument() {
  const totalPages = introSlides.length + 1;

  return (
    <Document title="RusoFásil — Introducción">
      <Page size="A4" style={styles.page}>
        <View style={{ ...styles.topBar, backgroundColor: BRAND_ACCENT_LIGHT }} />
        <View style={styles.coverBrandMark}>
          <BrandMarkPdf />
        </View>
        <View style={styles.coverBody}>
          <Text style={styles.coverEyebrow}>Presentación de introducción</Text>
          <Text style={styles.coverTitle}>Bienvenido a RusoFásil</Text>
          <Text style={{ ...styles.coverSubtitle, color: BRAND_ACCENT }}>
            El idioma ruso y todo lo que la plataforma tiene para ti
          </Text>
          <View style={styles.coverAccentBar} />
        </View>
        <FooterPdf page={1} total={totalPages} />
      </Page>

      {introSlides.map((slide, index) => (
        <Page key={slide.id} size="A4" style={styles.page}>
          <View style={styles.topBar} />
          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.illustrationPanel}>
                <PdfIllustration icon={slide.icon} />
              </View>
              <BrandMarkPdf />
            </View>

            <Text style={styles.eyebrowChip}>
              Diapositiva {index + 1} de {introSlides.length}
            </Text>
            <Text style={styles.slideTitle}>{slide.title}</Text>

            {slide.body.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}

            {slide.highlights && slide.highlights.length > 0 && (
              <View style={styles.highlightsBox}>
                {slide.highlights.map((item) => (
                  <View key={item} style={styles.bullet}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <FooterPdf page={index + 2} total={totalPages} />
        </Page>
      ))}
    </Document>
  );
}
