/**
 * Текст правового документа со ссылками — заход 7.242.
 *
 * Абзацы политики и страницы удаления — простые строки (`content.ts`,
 * `account-deletion.ts`), и так и должно остаться: их сверяют сторожа
 * `check:legal-truth` и `check:account-deletion` по тексту. Но адрес центра
 * подписок Google Play и адрес страницы удаления обязаны нажиматься, иначе
 * «отмените в Google Play» — инструкция без пути. Поэтому ссылками
 * становятся ровно две формы: `https://…` и адрес почты поддержки.
 *
 * Внешняя ссылка внутри приложения уходит в системный браузер, а
 * `play.google.com` — в сам Google Play (`Bridge.launchIntent`, замер
 * 7.241); свой адрес `rusofacilapp.com` остаётся в приложении.
 */
const TOKEN = /(https:\/\/[^\s)»"]+|[a-z0-9._%+-]+@rusofacilapp\.com)/gi;

export default function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        // Точка или запятая в конце — знак предложения, а не часть адреса.
        const trail = /[.,;:]+$/.exec(part)?.[0] ?? "";
        const href = trail ? part.slice(0, -trail.length) : part;
        const isMail = !href.startsWith("https://");
        return (
          <span key={i}>
            <a
              href={isMail ? `mailto:${href}` : href}
              className="underline underline-offset-2 break-all"
              {...(isMail || href.startsWith("https://rusofacilapp.com") ? {} : { target: "_blank", rel: "noreferrer" })}
            >
              {href}
            </a>
            {trail}
          </span>
        );
      })}
    </>
  );
}
