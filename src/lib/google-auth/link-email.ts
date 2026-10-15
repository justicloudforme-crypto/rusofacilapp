/**
 * Письмо о первой привязке Google к учётке с паролем (долг 381, 7.268).
 * Испанский — мексиканский, на «tú»; ниже русский, как у остальных писем
 * (`forgot-password`, `request-account-deletion`). Чистая функция: текст
 * проверяется сторожем `check:google-signin` без отправки.
 */
const SUPPORT = "support@rusofacilapp.com";
const GOOGLE_SECURITY = "https://myaccount.google.com/security";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function googleLinkEmail({ email, origin }: { email: string; origin: string }) {
  const address = escapeHtml(email);
  const forgotEs = `${origin}/es/forgot-password`;
  const forgotRu = `${origin}/ru/forgot-password`;
  return {
    subject: "RusoFácilapp — entraste con Google / вход через Google",
    html: `
        <p>Hola:</p>
        <p>Entraste a tu cuenta de RusoFácilapp (<b>${address}</b>) con «Continuar con Google» por primera vez. Tu progreso y tu suscripción siguen igual.</p>
        <p>Por seguridad, desactivamos la contraseña que tenía la cuenta y cerramos la sesión en tus otros dispositivos. Así nadie puede entrar con una contraseña anterior. A partir de ahora entras con Google.</p>
        <p>Si también quieres entrar con tu correo y una contraseña, crea una nueva en «¿Olvidaste tu contraseña?»:</p>
        <p><a href="${forgotEs}">${forgotEs}</a></p>
        <p><b>¿No fuiste tú?</b> Entonces alguien pudo entrar a tu cuenta de Google. Cambia ya la contraseña de Google, revisa su seguridad en <a href="${GOOGLE_SECURITY}">${GOOGLE_SECURITY}</a> y escríbenos a <a href="mailto:${SUPPORT}">${SUPPORT}</a>.</p>
        <hr />
        <p>Вы впервые вошли в аккаунт RusoFácilapp (<b>${address}</b>) через Google. Прогресс и подписка на месте.</p>
        <p>Ради безопасности мы отключили пароль, который был у аккаунта, и завершили сеансы на других устройствах — чтобы никто не мог войти по старому паролю. Теперь вход — через Google.</p>
        <p>Если хотите входить и по email с паролем, задайте новый через «Забыли пароль?»:</p>
        <p><a href="${forgotRu}">${forgotRu}</a></p>
        <p><b>Это были не вы?</b> Значит, кто-то мог войти в ваш аккаунт Google. Сразу смените пароль Google, проверьте защиту на <a href="${GOOGLE_SECURITY}">${GOOGLE_SECURITY}</a> и напишите нам: <a href="mailto:${SUPPORT}">${SUPPORT}</a>.</p>
      `,
  };
}
