package com.rusofacilapp.app;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * КАРКАС БЕЗ СЕТИ ВНУТРИ ПРИЛОЖЕНИЯ — ЗАХОД 7.228 (ОФЛАЙН-1б, долг 306).
 *
 * ЧТО БЫЛО ИЗМЕРЕНО. Владелец 23.09.2026 на POCO (сборка 1.0.3): сайт в
 * Chrome на том же телефоне без сети открывает ранее открытые страницы и
 * каркас `public/offline.html` для неоткрытых, а ПРИЛОЖЕНИЕ показывает
 * нативный экран «No pudimos abrir la aplicación» и ничего больше.
 *
 * ПОЧЕМУ. Оболочка грузит боевой адрес удалённо, и тогда Capacitor сам
 * отвечает на КАЖДЫЙ запрос документа — чтобы подмешать в поток скрипт
 * моста. Читается это в его исходниках:
 *
 *   `WebViewLocalServer.shouldInterceptRequest` (184–210) для адреса
 *   `rusofacilapp.com` находит обработчик (хост лежит в `authorities`,
 *   `Bridge.reset()` кладёт его туда сам) и уходит в
 *   `handleProxyRequest` (489–544). Тот для GET с `Accept: text/html`
 *   открывает СВОЁ java-соединение `HttpURLConnection` и возвращает его
 *   поток. Без сети `getInputStream()` бросает, и метод возвращает
 *   `null`; дальше webview грузит адрес сам, получает отказ, и
 *   `BridgeWebViewClient.onReceivedError` (45–59) БЕЗУСЛОВНО показывает
 *   `server.errorPath`.
 *
 * У этого java-соединения нет и не может быть кеша: ни воркера, ни
 * `Cache Storage`, ни HTTP-кеша webview. То есть в приложении дорога к
 * сохранённому содержимому обрывается ДО воркера — а в браузере её
 * никто не обрывает. Это и есть вся разница, которую видел владелец.
 *
 * ЧТО ДЕЛАЕТ ЭТОТ КЛАСС. Ровно одно: когда Capacitor не смог ответить на
 * запрос ГЛАВНОГО КАДРА, документ всё равно отдаётся — каркасом
 * `public/offline.html` из пакета приложения, и отдаётся ПО ИСХОДНОМУ
 * АДРЕСУ. Последнее важнее всего остального: ответ, отданный на адрес
 * `https://rusofacilapp.com/es/courses`, живёт на источнике САЙТА, а
 * значит у каркаса работают его собственные ссылки (пять вкладок), его
 * проба `/api/health` и его же правило «нет сети» из захода 7.227. Файл
 * при этом ОДИН на сайт и на приложение — `public/offline.html`, копии
 * сличает `npm run check:offline-fallback`.
 *
 * ЧЕГО ЭТОТ КЛАСС НЕ ДЕЛАЕТ. Он не рисует сохранённую страницу вместо
 * каркаса: прочитать `Cache Storage` воркера из Java нечем, а отдать
 * HTML сохранённой страницы, не отдав её чанки, значило бы показать
 * сломанную вёрстку вместо честного каркаса. Это записано долгом, а не
 * умолчанием.
 *
 * ПОЧЕМУ ПРИЗНАК «ПРИЛОЖЕНИЕ УЖЕ ОТКРЫВАЛОСЬ» ОБЯЗАТЕЛЕН. На самом
 * первом запуске после установки без сети сохранено НИЧЕГО: каркас с
 * пятью вкладками, из которых ни одна не откроется, — это ложное
 * обещание. В этом случае остаётся прежний нативный экран 7.223, и
 * решает это `Host.offlineShellAllowed()`.
 */
public class OfflineShellWebViewClient extends BridgeWebViewClient {

    /** Что этот клиент спрашивает у окна и о чём ему сообщает. Интерфейс,
     *  а не ссылка на `MainActivity`, чтобы состояние оболочки жило в
     *  одном месте — в самом окне. */
    interface Host {
        /** Есть ли на телефоне то, ради чего каркас с меню имеет смысл. */
        boolean offlineShellAllowed();

        /** Каркас отдан — окну это нужно знать: лестница повторов
         *  считает такой экран НЕ настоящей страницей. */
        void onOfflineShellServed();

        /** Главный кадр не загрузился совсем. Решение — за окном. */
        void onMainFrameLoadFailed(WebView view, String failedUrl);
    }

    /** Путь каркаса ВНУТРИ пакета. `cap sync` кладёт туда всё из
     *  `webDir` (`capacitor-shell/`), рядом с `error.html`. */
    static final String SHELL_ASSET = "public/offline.html";

    private final Bridge shellBridge;
    private final Host host;
    private final AssetManager assets;

    OfflineShellWebViewClient(Bridge bridge, Host host, Context context) {
        super(bridge);
        this.shellBridge = bridge;
        this.host = host;
        this.assets = context.getAssets();
    }

    /**
     * СНАЧАЛА — ВСЁ, ЧТО УМЕЕТ CAPACITOR, И ТОЛЬКО ПОТОМ МЫ.
     *
     * Порядок именно такой, а не наоборот: при живой сети ответ приходит
     * от Capacitor вместе с подмешанным скриптом моста, и подменять его
     * нельзя — без моста не работают ни покупка, ни полосы, ни отклик.
     * Наш каркас включается ровно в том случае, когда Capacitor вернул
     * `null`, то есть его собственное соединение не состоялось.
     */
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        WebResourceResponse answered = super.shouldInterceptRequest(view, request);
        if (answered != null) {
            return answered;
        }
        if (!wantsSavedDocument(request)) {
            return null;
        }
        if (!host.offlineShellAllowed()) {
            return null;
        }
        WebResourceResponse shell = shellResponse();
        if (shell == null) {
            return null;
        }
        host.onOfflineShellServed();
        return shell;
    }

    /**
     * Запрос, вместо которого каркас показать МОЖНО.
     *
     * Три условия, и каждое закрывает свой способ навредить:
     *  * главный кадр — иначе каркас подменил бы картинку или скрипт;
     *  * метод GET — у `handleProxyRequest` живёт только GET, и на POST
     *    (вход в учётную запись отправляет форму) он возвращает `null`
     *    ПРИ ЖИВОЙ СЕТИ; каркас на месте ответа входа — это молчаливая
     *    поломка входа;
     *  * хост ровно наш боевой — `allowNavigation` пускает и чужие
     *    поддомены, и подменять их ответы мы права не имеем.
     */
    private boolean wantsSavedDocument(WebResourceRequest request) {
        if (request == null || !request.isForMainFrame()) {
            return false;
        }
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        Uri url = request.getUrl();
        if (url == null || url.getHost() == null) {
            return false;
        }
        String serverUrl = shellBridge == null ? null : shellBridge.getServerUrl();
        if (serverUrl == null) {
            return false;
        }
        String serverHost = Uri.parse(serverUrl).getHost();
        if (serverHost == null || !serverHost.equalsIgnoreCase(url.getHost())) {
            return false;
        }
        return acceptsHtml(request);
    }

    /** Навигация всегда просит `text/html`; картинка, скрипт и запрос
     *  `fetch` — нет. Тот же признак читает сам Capacitor. */
    private boolean acceptsHtml(WebResourceRequest request) {
        Map<String, String> headers = request.getRequestHeaders();
        if (headers == null) {
            return false;
        }
        for (Map.Entry<String, String> header : headers.entrySet()) {
            if (!"accept".equalsIgnoreCase(header.getKey()) || header.getValue() == null) {
                continue;
            }
            return header.getValue().toLowerCase().contains("text/html");
        }
        return false;
    }

    /** `no-store` намеренно: каркас — это ответ на неудачу, и оставлять
     *  его в кеше webview вместо настоящей страницы нельзя. */
    private WebResourceResponse shellResponse() {
        InputStream stream;
        try {
            stream = assets.open(SHELL_ASSET);
        } catch (IOException e) {
            return null;
        }
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, stream);
    }

    /**
     * ОТКАЗ ГЛАВНОГО КАДРА РЕШАЕТ ОКНО, А НЕ CAPACITOR.
     *
     * `super` здесь не зовётся намеренно: его единственное действие для
     * главного кадра — `view.loadUrl(bridge.getErrorUrl())`, то есть
     * тупик, из которого кнопка «Reintentar» без сети не выводила (её
     * проба — кроссоригинный `fetch` с `https://localhost`, и воркер
     * сайта ответить на него не может по построению). Для НЕ главного
     * кадра поведение прежнее, включая оповещение слушателей.
     */
    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request != null && request.isForMainFrame()) {
            host.onMainFrameLoadFailed(view, urlOf(request));
            return;
        }
        super.onReceivedError(view, request, error);
    }

    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
        if (request != null && request.isForMainFrame()) {
            host.onMainFrameLoadFailed(view, urlOf(request));
            return;
        }
        super.onReceivedHttpError(view, request, errorResponse);
    }

    private String urlOf(WebResourceRequest request) {
        Uri url = request.getUrl();
        return url == null ? null : url.toString();
    }
}
