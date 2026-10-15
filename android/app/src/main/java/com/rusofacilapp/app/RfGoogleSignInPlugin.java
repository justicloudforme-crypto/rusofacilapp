package com.rusofacilapp.app;

import android.os.CancellationSignal;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * «ВОЙТИ ЧЕРЕЗ GOOGLE» — СИСТЕМНОЕ ОКНО ВЫБОРА АККАУНТА (заход 7.267, оболочка 1.0.16).
 *
 * Почему не страница Google в WebView: ссылка на accounts.google.com из
 * WebView приложения уходит в Chrome (замер 7.267 на эмуляторе), и вход
 * достался бы браузеру, а не приложению; встроенный WebView Google для
 * OAuth к тому же запрещает. Поэтому окно — Credential Manager Android
 * («Sign in with Google»), а сайт (`src/lib/google-auth/native-client.ts`)
 * получает от плагина только ID-токен.
 *
 * Плагин ничего не решает и ничего не хранит: `serverClientId` (веб-клиент,
 * он же `aud` токена) и одноразовый `nonce` даёт сервер, токен уходит
 * обратно серверу, и уже СЕРВЕР проверяет подпись, `aud`, срок и `nonce`
 * (`src/lib/google-auth/id-token.ts`). Просится только адрес почты —
 * ни имени, ни фото. Разрешений в манифест не добавляет.
 *
 * Коды отказа для сайта: `cancelled` (человек закрыл окно), `no_credentials`
 * (на телефоне нет аккаунта Google или окно ничего не нашло), `failed`.
 */
@CapacitorPlugin(name = "RfGoogleSignIn")
public class RfGoogleSignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String serverClientId = call.getString("serverClientId", "");
        String nonce = call.getString("nonce", "");
        if (serverClientId == null || serverClientId.isEmpty() || nonce == null || nonce.isEmpty()) {
            call.reject("serverClientId and nonce are required", "failed");
            return;
        }

        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(serverClientId)
            .setNonce(nonce)
            .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build();

        CredentialManager manager = CredentialManager.create(getContext());
        manager.getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (credential instanceof CustomCredential
                        && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        try {
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                            JSObject out = new JSObject();
                            out.put("idToken", google.getIdToken());
                            call.resolve(out);
                        } catch (Exception e) {
                            call.reject("bad google credential", "failed", e);
                        }
                        return;
                    }
                    call.reject("unexpected credential type", "failed");
                }

                @Override
                public void onError(GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) {
                        call.reject("cancelled", "cancelled");
                    } else if (e instanceof NoCredentialException) {
                        call.reject("no google account", "no_credentials");
                    } else {
                        call.reject(e.getClass().getSimpleName(), "failed", e);
                    }
                }
            }
        );
    }
}
