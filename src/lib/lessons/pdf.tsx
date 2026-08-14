import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Svg, Path, Circle, Rect, StyleSheet, Font } from "@react-pdf/renderer";
import type { LessonContent, SlideIconKey } from "./types";
import { ILLUSTRATION_VIEWBOX, slideIllustrations, type IllustrationColorRole } from "./slideIcons";

// react-pdf's built-in "Helvetica" only covers WinAnsi (Latin) glyphs — every
// lesson has Cyrillic vocabulary/example text, which would otherwise render
// as garbled Latin lookalikes with wrong glyph widths (the mis-measured
// widths are also what caused chip text and captions to overlap). PT Sans
// covers Cyrillic + Latin. See also src/lib/intro/pdf.tsx, which registers
// the same family.
const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf-fonts");
Font.register({
  family: "PT Sans",
  fonts: [
    { src: path.join(FONTS_DIR, "PTSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "PTSans-Bold.ttf"), fontWeight: 700 },
  ],
});
// Disable react-pdf's automatic hyphenation, which is tuned for English and
// mangles Spanish/Russian words at line-wrap points.
Font.registerHyphenationCallback((word) => [word]);

// Mirrors the CSS custom properties in src/app/globals.css (--brand,
// --brand-light, --brand-accent, --brand-accent-light) — react-pdf can't
// read CSS variables, so the light-mode values are duplicated here. Keep
// these two in sync if the brand palette ever changes. Also mirrors the
// COLORS map in src/components/lesson/SlideIllustration.tsx, which uses
// the same fixed hex values for the same shape data on the web.
const BRAND = "#3730a3";
const BRAND_LIGHT = "#4f46e5";
const BRAND_ACCENT = "#b45309";
const BRAND_ACCENT_LIGHT = "#d97706";
const BRAND_TINT = "#f2f1fb";
const INK = "#1f2130";
const INK_SOFT = "#4b4d5e";

const SHAPE_COLORS: Record<IllustrationColorRole, string> = {
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
// Speaker cone + two sound-wave arcs — standard fonts have no glyph for the
// "\u{1F50A}" emoji used here previously, which rendered as garbage and (via
// its wrong glyph width) threw off the chip's layout. Drawn as a vector icon
// instead so it renders identically regardless of font/emoji support.
const SPEAKER_CONE_PATH = "M2 9 H5 L10 5 V19 L5 15 H2 Z";
const SPEAKER_WAVE_NEAR = "M14 9 A5 5 0 0 1 14 15";
const SPEAKER_WAVE_FAR = "M16.5 6.5 A8.5 8.5 0 0 1 16.5 17.5";

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

  // Tap-to-listen chips: a PDF can't play audio, so this is a visual
  // reminder ("hear this on the site") rather than an interaction.
  audioRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  audioChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0d9b5",
    backgroundColor: "#fdf6ec",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  audioChipSpeaker: { marginRight: 6 },
  audioChipText: { fontSize: 12, fontWeight: 700, color: INK },
  audioChipCaption: { fontSize: 8, color: INK_SOFT, marginTop: 1 },

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

/** Renders the same shape recipe as SlideIllustration.tsx (web) using
 * react-pdf's Svg primitives, so the deck and its PDF export show the same
 * illustration for a given slide. */
function PdfIllustration({ icon }: { icon: SlideIconKey }) {
  const shapes = slideIllustrations[icon] ?? [];
  return (
    <Svg width={ILLUSTRATION_VIEWBOX.width} height={ILLUSTRATION_VIEWBOX.height} viewBox="0 0 160 120">
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

function AudioSpeakerIconPdf() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d={SPEAKER_CONE_PATH} fill={BRAND_ACCENT} />
      <Path d={SPEAKER_WAVE_NEAR} stroke={BRAND_ACCENT} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Path d={SPEAKER_WAVE_FAR} stroke={BRAND_ACCENT} strokeWidth={1.8} strokeLinecap="round" fill="none" />
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

export function LessonSlidesDocument({
  levelLabel,
  lessonSlug,
  lessonTitle,
  slides,
}: {
  levelLabel: string;
  lessonSlug: string;
  lessonTitle: string;
  slides: NonNullable<LessonContent["slides"]>;
}) {
  const totalPages = slides.length + 1;

  return (
    <Document title={`RusoFásil — ${lessonTitle}`}>
      <Page size="A4" style={styles.page}>
        <View style={{ ...styles.topBar, backgroundColor: BRAND_ACCENT_LIGHT }} />
        <View style={styles.coverBrandMark}>
          <BrandMarkPdf />
        </View>
        <View style={styles.coverBody}>
          <Text style={styles.coverEyebrow}>
            {levelLabel} · Lección {lessonSlug}
          </Text>
          <Text style={styles.coverTitle}>{lessonTitle}</Text>
          <Text style={{ ...styles.coverSubtitle, color: BRAND_ACCENT }}>Presentación — RusoFásil</Text>
          <View style={styles.coverAccentBar} />
        </View>
        <FooterPdf page={1} total={totalPages} />
      </Page>

      {slides.map((slide, index) => (
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
              Diapositiva {index + 1} de {slides.length}
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

            {slide.audioExamples && slide.audioExamples.length > 0 && (
              <View style={styles.audioRow}>
                {slide.audioExamples.map((example) => (
                  <View key={example.text} style={styles.audioChip}>
                    <View style={styles.audioChipSpeaker}>
                      <AudioSpeakerIconPdf />
                    </View>
                    <View>
                      <Text style={styles.audioChipText}>{example.text}</Text>
                      {example.caption && <Text style={styles.audioChipCaption}>{example.caption}</Text>}
                    </View>
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
