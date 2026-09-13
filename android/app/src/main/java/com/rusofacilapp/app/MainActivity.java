package com.rusofacilapp.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * СТОРОЖ ЗАГРУЗКИ (заход 7.189, долг 175).
 *
 * Оболочка не несёт сайт внутри себя — она грузит боевой адрес удалённо.
 * Отсюда отказ, которого у обычного сайта нет: у приложения нет ни адресной
 * строки, ни кнопки «обновить», ни вкладки, которую можно закрыть. Если
 * первый запрос не доехал, у ученика остаётся белый прямоугольник и ничего
 * больше — ни текста, ни кнопки, ни объяснения.
 *
 * Половину этого Capacitor закрывает сам: `server.errorPath` в
 * `capacitor.config.ts` показывает `capacitor-shell/error.html`, когда
 * webview получает ОШИБКУ (`BridgeWebViewClient.onReceivedError` и
 * `onReceivedHttpError`) — нет сети, не разобралось имя, сервер ответил 5xx.
 *
 * Вторую половину Capacitor не закрывает вовсе, и именно она страшнее:
 * сервер не отказал, а МОЛЧИТ. Тогда ошибки нет, `errorPath` не срабатывает
 * ни разу, и белый экран живёт столько, сколько человек согласен ждать.
 * Этот класс мы уже видели у самих себя — инцидент №1: HTTP 200, правильный
 * HTML, пустой экран.
 *
 * Поэтому здесь стоит таймер. Он заводится один раз при создании окна и
 * через {@link #LOAD_TIMEOUT_MS} спрашивает у webview ровно два факта:
 * дошла ли загрузка до конца и нарисовалось ли хоть что-то. Если нет —
 * грузит локальный экран ошибки, тот же самый, что показывает `errorPath`.
 * Двух фактов, а не одного: `getProgress() == 100` бывает и у пустого
 * документа (сервер ответил 200 и пустым телом), а `getContentHeight() == 0`
 * бывает на середине честной загрузки.
 *
 * ГРАНИЦА ЧЕСТНОСТИ. Ни одна строка этого файла на живом устройстве не
 * проверялась: Java здесь не исполняется ничем, что есть на машине сборки,
 * а `adb install` на телефон владельца падает (долг 112, долг 170). Статика
 * стережётся `npm run check:native-shell`; проверку глазами на телефоне
 * держит отдельный долг 176.
 */
public class MainActivity extends BridgeActivity {

    /**
     * Сколько ждать, прежде чем признать загрузку несостоявшейся.
     *
     * Двенадцать секунд — не круглое число «на всякий случай», а запас над
     * замеренным: время ответа боевого прода на `/api/word-audio` в 7.187
     * было 0,32…0,66 с, а полная отрисовка страницы в прогоне
     * `check:rendered` укладывается в единицы секунд. Ставить меньше опасно
     * в обратную сторону: мобильная сеть в метро отдаёт первую страницу и за
     * восемь секунд, и показать ей экран ошибки значило бы сломать рабочий
     * запуск. Ставить больше бессмысленно — человек к этому времени уже
     * решил, что приложение не работает.
     */
    private static final long LOAD_TIMEOUT_MS = 12_000L;

    private final Handler loadWatchdog = new Handler(Looper.getMainLooper());
    private Runnable pendingCheck;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        armLoadWatchdog();
    }

    private void armLoadWatchdog() {
        pendingCheck = new Runnable() {
            @Override
            public void run() {
                if (getBridge() == null) {
                    return;
                }
                WebView webView = getBridge().getWebView();
                String errorUrl = getBridge().getErrorUrl();
                // Без errorPath в конфиге показывать нечего, и тогда лучше
                // оставить как есть, чем грузить пустоту поверх пустоты.
                if (webView == null || errorUrl == null) {
                    return;
                }
                String current = webView.getUrl();
                // Экран ошибки уже на месте — второй раз грузить его значит
                // стереть у человека нажатие «Повторить».
                if (current != null && current.startsWith(errorUrl)) {
                    return;
                }
                boolean finished = webView.getProgress() >= 100;
                boolean painted = webView.getContentHeight() > 0;
                if (finished && painted) {
                    return;
                }
                webView.stopLoading();
                webView.loadUrl(errorUrl);
            }
        };
        loadWatchdog.postDelayed(pendingCheck, LOAD_TIMEOUT_MS);
    }

    @Override
    public void onDestroy() {
        if (pendingCheck != null) {
            loadWatchdog.removeCallbacks(pendingCheck);
            pendingCheck = null;
        }
        super.onDestroy();
    }
}
