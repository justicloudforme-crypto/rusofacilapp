"use client";

import { useEffect, useState, type ReactNode } from "react";
import tokens from "../../../tokens.json";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import ProgressBar from "@/components/ui/ProgressBar";
import PremiumBadge from "@/components/ui/PremiumBadge";
import LevelBadge from "@/components/LevelBadge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import { ToastProvider, useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-black/10 py-10 first:border-t-0 first:pt-0 dark:border-white/10">
      <h2 className="text-h2 font-serif font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-1.5 max-w-2xl text-body-sm text-foreground/70">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/50">{children}</h3>;
}

function Swatch({ name, hex, textClass = "text-white" }: { name: string; hex: string; textClass?: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
      <div className={`flex h-14 items-end p-2 text-[0.7rem] font-medium ${textClass}`} style={{ background: hex }}>
        {name}
      </div>
      <div className="bg-background px-2 py-1.5 font-mono text-[0.65rem] text-foreground/60">{hex}</div>
    </div>
  );
}

function colorScaleEntries(scale: Record<string, unknown>): [string, string][] {
  return Object.entries(scale).filter(([k, v]) => /^\d+$/.test(k) && typeof v === "string") as [string, string][];
}

// ---------------------------------------------------------------------------
// Theme toggle — a LOCAL preview override (sets data-theme on <html>
// directly), separate from the real site-wide cookie-persisted theme
// (ThemeSwitcher.tsx on /profile). Reloading or leaving this page reverts
// to the real preference — this toggle is for visual QA only, it must not
// silently change what a signed-in user's account is set to.
// ---------------------------------------------------------------------------

function ThemeToggle({ initialTheme }: { initialTheme: "light" | "dark" }) {
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white/60 p-1 pl-4 dark:border-white/15 dark:bg-white/5">
      <span className="text-xs font-medium text-foreground/60">Preview theme</span>
      <Button
        type="button"
        size="sm"
        variant={theme === "light" ? "primary" : "ghost"}
        haptic={false}
        onClick={() => setTheme("light")}
      >
        ☀️ Light
      </Button>
      <Button
        type="button"
        size="sm"
        variant={theme === "dark" ? "primary" : "ghost"}
        haptic={false}
        onClick={() => setTheme("dark")}
      >
        🌙 Dark
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component gallery pieces
// ---------------------------------------------------------------------------

function StateGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}

function StateLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-[0.65rem] uppercase tracking-wide text-foreground/40">{label}</span>
      {children}
    </div>
  );
}

function ButtonGallery() {
  return (
    <div className="flex flex-col gap-6">
      {(["primary", "secondary", "outline", "ghost", "danger"] as const).map((variant) => (
        <div key={variant}>
          <SubHeading>{variant}</SubHeading>
          <StateGrid>
            <StateLabel label="default / hover / active (interact live)">
              <Button variant={variant} haptic={false}>
                {variant}
              </Button>
            </StateLabel>
            <StateLabel label="focus-visible (tab to it)">
              <Button variant={variant} haptic={false}>
                tab me
              </Button>
            </StateLabel>
            <StateLabel label="disabled">
              <Button variant={variant} disabled haptic={false}>
                disabled
              </Button>
            </StateLabel>
            <StateLabel label="loading">
              <Button variant={variant} loading haptic={false}>
                loading
              </Button>
            </StateLabel>
          </StateGrid>
        </div>
      ))}
      <p className="text-xs text-foreground/50">
        There is deliberately no &quot;premium&quot; variant — see the Premium rule section below.
      </p>
    </div>
  );
}

function PremiumRuleSection() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <p className="mb-3 text-sm font-semibold text-success">✅ Так — gold — только маркер</p>
        <PremiumBadge>Premium</PremiumBadge>
        <p className="mt-3 text-xs text-foreground/60">
          <code>&lt;PremiumBadge&gt;</code> рендерит <code>&lt;span&gt;</code>, не кликается, никогда не получает
          <code> onClick</code>/<code>href</code>.
        </p>
      </div>
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
        <p className="mb-3 text-sm font-semibold text-danger">❌ Не так — gold как кнопка</p>
        <div className="relative inline-block">
          {/* Intentionally NOT a real <button>/<Button>/onClick — this is a
              static illustration of the mistake, not a functioning control,
              so it can't itself trip check-tokens' premium-on-clickable
              guard or actually be tapped. */}
          <div
            aria-hidden
            className="pointer-events-none inline-flex min-h-11 select-none items-center justify-center rounded-full bg-premium-500 px-5 text-sm font-medium text-white opacity-70"
          >
            👑 Upgrade
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center" aria-hidden>
            <div className="h-0.5 w-full -rotate-6 bg-danger" />
          </div>
        </div>
        <p className="mt-3 text-xs text-foreground/60">
          Никогда не <code>bg-premium</code>/<code>text-premium</code> на элементе с <code>onClick</code>/
          <code>href</code> или на <code>&lt;Button&gt;</code>. <code>npm run check:tokens</code> падает, если это
          случится.
        </p>
      </div>
    </div>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" haptic={false} onClick={() => setOpen(true)}>
        Open modal
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Пример модального окна" closeLabel="Закрыть">
        <p className="text-sm text-foreground/70">
          На мобиле (&lt; 640px) это bottom sheet с safe-area снизу и свайп-ручкой сверху. На 640px+ — обычный
          центрированный диалог. Esc и клик по фону закрывают.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" haptic={false} onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button variant="primary" haptic={false} onClick={() => setOpen(false)}>
            Готово
          </Button>
        </div>
      </Modal>
    </>
  );
}

function ToastDemo() {
  const { show } = useToast();
  return (
    <StateGrid>
      <Button variant="outline" haptic={false} onClick={() => show("Обычное уведомление")}>
        default
      </Button>
      <Button variant="outline" haptic={false} onClick={() => show("Сохранено", "success")}>
        success
      </Button>
      <Button variant="outline" haptic={false} onClick={() => show("Ошибка сохранения", "danger")}>
        danger
      </Button>
    </StateGrid>
  );
}

type FontSizeKey = "display" | "h1" | "h2" | "h3" | "bodyLg" | "body" | "bodySm" | "caption";
const FONT_SIZE_TOKENS = tokens.typography.fontSize as unknown as Record<FontSizeKey, { min: number; max: number; clamp: string }>;

const TYPE_EXAMPLES: { key: FontSizeKey; ru: string; es: string }[] = [
  { key: "display", ru: "Говорите по-русски уверенно", es: "Habla ruso con confianza desde tu primera lección hasta la fluidez completa" },
  { key: "h1", ru: "Русский язык — ближе, чем кажется", es: "El idioma ruso está más cerca de lo que imaginas para un hispanohablante" },
  { key: "h2", ru: "Понимайте настоящий русский язык", es: "Comprende el ruso auténtico como lo hablan los rusos de verdad, sin filtros" },
  { key: "h3", ru: "Учите русский день за днём", es: "Aprende ruso todos los días, paso a paso y sin prisa" },
  { key: "bodyLg", ru: "Идиомы, произношение и живые истории — всё в одном месте.", es: "Modismos, pronunciación auténtica e historias reales — todo en un solo lugar para hispanohablantes." },
  { key: "body", ru: "Каждый урок закрепляет то, что вы уже знаете.", es: "Cada lección refuerza lo que ya sabes y añade algo nuevo." },
  { key: "bodySm", ru: "Продолжайте серию из 7 дней", es: "Continúa tu racha de aprendizaje diario" },
  { key: "caption", ru: "Бесплатный доступ", es: "Acceso gratuito disponible" },
];

// ---------------------------------------------------------------------------

function StyleguideBody({ initialTheme }: { initialTheme: "light" | "dark" }) {
  const { color, spacing, radius, shadow } = tokens;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display font-serif font-bold tracking-tight">Style guide</h1>
          <p className="mt-2 max-w-xl text-body text-foreground/70">
            Живой каталог токенов и компонентов дизайн-системы «Кремль». Internal-only — <code>noindex</code>, не
            попадает в поиск. Источник правды: <code>tokens.json</code> в корне репозитория.
          </p>
        </div>
        <ThemeToggle initialTheme={initialTheme} />
      </div>

      <Section
        id="colors"
        title="Палитра"
        description="Каждая плашка — реальный HEX из tokens.json. Сверяйте глазами против исходника, не доверяйте только рендеру."
      >
        <SubHeading>Primary (indigo, единственный кликабельный акцент)</SubHeading>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
          {colorScaleEntries(color.primary).map(([step, hex]) => (
            <Swatch key={step} name={`primary-${step}`} hex={hex} textClass={Number(step) <= 300 ? "text-black/70" : "text-white"} />
          ))}
        </div>

        <div className="mt-6">
          <SubHeading>Neutral (тёплая шкала)</SubHeading>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
            {colorScaleEntries(color.neutral).map(([step, hex]) => (
              <Swatch key={step} name={`neutral-${step}`} hex={hex} textClass={Number(step) <= 300 ? "text-black/70" : "text-white"} />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <SubHeading>Premium (gold — только некликабельные маркеры)</SubHeading>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
            {colorScaleEntries(color.premium).map(([step, hex]) => (
              <Swatch key={step} name={`premium-${step}`} hex={hex} textClass={Number(step) <= 300 ? "text-black/70" : "text-white"} />
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {(["success", "warning", "danger"] as const).map((name) => (
            <div key={name}>
              <SubHeading>{name}</SubHeading>
              <div className="grid grid-cols-3 gap-2">
                {(["subtle", "default", "strong"] as const).map((shade) => (
                  <Swatch
                    key={shade}
                    name={shade}
                    hex={color.semantic[name][shade]}
                    textClass={shade === "subtle" ? "text-black/70" : "text-white"}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <SubHeading>Level A1–C1 (приглушённая, не спорит с primary)</SubHeading>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(["a1", "a2", "b1", "b2", "c1"] as const).map((lvl) => (
              <Swatch key={lvl} name={lvl.toUpperCase()} hex={color.level[lvl].default} />
            ))}
          </div>
        </div>
      </Section>

      <Section
        id="typography"
        title="Типографика"
        description="Fluid clamp() от 375px до 1280px. RU и ES на каждом размере — испанский обычно длиннее, перенос должен быть виден на узком экране."
      >
        <div className="flex flex-col gap-6">
          {TYPE_EXAMPLES.map((ex) => (
            <div key={ex.key} className="max-w-lg border-l-2 border-primary/20 pl-4">
              <p className="mb-1 font-mono text-[0.65rem] text-foreground/40">
                text-{ex.key.replace(/([A-Z])/g, "-$1").toLowerCase()} · {FONT_SIZE_TOKENS[ex.key].min}–
                {FONT_SIZE_TOKENS[ex.key].max}px
              </p>
              <p className={`font-serif font-bold`} style={{ fontSize: `var(--text-${ex.key.replace(/([A-Z])/g, "-$1").toLowerCase()})` }}>
                {ex.ru}
              </p>
              <p className="mt-1 text-foreground/70" style={{ fontSize: `var(--text-${ex.key.replace(/([A-Z])/g, "-$1").toLowerCase()})` }}>
                {ex.es}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="spacing" title="Отступы / радиусы / тени" description="Шкала отступов кратна 4px.">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <SubHeading>Spacing</SubHeading>
            <div className="flex flex-col gap-1.5">
              {Object.entries(spacing).map(([step, rem]) => (
                <div key={step} className="flex items-center gap-2 text-xs">
                  <span className="w-10 font-mono text-foreground/50">{step}</span>
                  <span className="h-3 bg-primary/40" style={{ width: rem }} />
                  <span className="font-mono text-foreground/40">{rem}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SubHeading>Radius</SubHeading>
            <div className="flex flex-col gap-2">
              {Object.entries(radius).map(([name, rem]) => (
                <div key={name} className="flex items-center gap-3 text-xs">
                  <span className="h-8 w-8 border-2 border-primary/50" style={{ borderRadius: rem }} />
                  <span className="font-mono text-foreground/50">
                    {name} · {rem}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SubHeading>Shadow</SubHeading>
            <div className="flex flex-col gap-3">
              {Object.entries(shadow).map(([name, value]) => (
                <div
                  key={name}
                  className="flex h-10 items-center justify-center rounded-lg bg-background text-xs font-mono text-foreground/50"
                  style={{ boxShadow: value }}
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="badges" title="LevelBadge / PremiumBadge">
        <SubHeading>LevelBadge — A1–C1, на токенах level-*</SubHeading>
        <StateGrid>
          {(["A1", "A2", "B1", "B2", "C1"] as const).map((lvl) => (
            <LevelBadge key={lvl} level={lvl} />
          ))}
        </StateGrid>
        <div className="mt-6">
          <SubHeading>PremiumBadge — единственный некликабельный gold-компонент</SubHeading>
          <StateGrid>
            <PremiumBadge>Premium</PremiumBadge>
            <PremiumBadge icon="⭐">Featured</PremiumBadge>
            <PremiumBadge size="sm">Small</PremiumBadge>
          </StateGrid>
        </div>
        <div className="mt-6">
          <PremiumRuleSection />
        </div>
      </Section>

      <Section id="buttons" title="Button">
        <ButtonGallery />
      </Section>

      <Section id="card-tabs" title="Card / Tabs">
        <SubHeading>Card — neutral / primary / premium</SubHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card tone="neutral">neutral</Card>
          <Card tone="primary">primary</Card>
          <Card tone="premium">premium (не кликается)</Card>
        </div>
        <div className="mt-6">
          <SubHeading>Tabs (клавиатура: Tab, взаимодействуйте live)</SubHeading>
          <TabsDemo />
        </div>
      </Section>

      <Section id="progress" title="ProgressBar">
        <div className="flex max-w-sm flex-col gap-4">
          <StateLabel label="primary, 35%">
            <ProgressBar percent={35} className="w-64" />
          </StateLabel>
          <StateLabel label="success, 72%">
            <ProgressBar percent={72} tone="success" className="w-64" />
          </StateLabel>
          <StateLabel label="two segments (seen/mastered)">
            <ProgressBar segments={[{ percent: 80, className: "bg-primary/50" }, { percent: 45, tone: "success" }]} className="w-64" />
          </StateLabel>
        </div>
      </Section>

      <Section id="forms" title="Input / Select / Switch">
        <div className="grid max-w-md grid-cols-1 gap-5">
          <Input label="Email" placeholder="tu@correo.com" hint="16px минимум — без зума в iOS Safari" />
          <Input label="Ошибка" defaultValue="неверное значение" error="Проверьте формат" />
          <Input label="Disabled" disabled defaultValue="недоступно" />
          <Select label="Уровень" defaultValue="a1">
            <option value="a1">A1</option>
            <option value="a2">A2</option>
            <option value="b1">B1</option>
          </Select>
          <Switch label="Уведомления по email" defaultChecked />
          <Switch label="Disabled" disabled />
        </div>
      </Section>

      <Section id="skeleton-empty" title="Skeleton / EmptyState">
        <SubHeading>Skeleton (loading-состояние контента)</SubHeading>
        <div className="flex max-w-sm flex-col gap-2">
          <Skeleton variant="text" className="w-1/2" />
          <Skeleton variant="text" />
          <Skeleton variant="text" className="w-2/3" />
          <div className="mt-2 flex items-center gap-3">
            <Skeleton variant="circle" />
            <Skeleton variant="rect" className="h-16 flex-1" />
          </div>
        </div>
        <div className="mt-6">
          <SubHeading>EmptyState</SubHeading>
          <EmptyState
            icon="🧩"
            title="Пока нет пазлов для этого уровня"
            description="Попробуйте другой уровень или загляните позже — контент обновляется регулярно."
            action={
              <Button variant="secondary" haptic={false}>
                Выбрать другой уровень
              </Button>
            }
          />
        </div>
      </Section>

      <Section id="overlays" title="Modal / Toast" description="Живые вызовы — проверяйте поведение на телефоне.">
        <div className="flex flex-wrap items-start gap-8">
          <StateLabel label="Modal (bottom sheet < 640px)">
            <ModalDemo />
          </StateLabel>
          <StateLabel label="Toast (безопасная зона снизу)">
            <ToastDemo />
          </StateLabel>
        </div>
      </Section>
    </div>
  );
}

function TabsDemo() {
  const [active, setActive] = useState("a");
  return (
    <Tabs
      label="Демо вкладок"
      activeId={active}
      onSelect={setActive}
      items={[
        { id: "a", label: "Первая" },
        { id: "b", label: "Вторая" },
        { id: "c", label: "Третья" },
      ]}
    />
  );
}

export default function StyleguideClient({ initialTheme }: { initialTheme: "light" | "dark" }) {
  return (
    <ToastProvider>
      <StyleguideBody initialTheme={initialTheme} />
    </ToastProvider>
  );
}
