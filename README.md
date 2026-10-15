# Yapay Mevzular · iPhone

Expo SDK 57 ve Expo Router ile geliştirilen iPhone uygulaması. Ajan kataloğu ve favoriler native ekranlardır. **ŞAHİKA**, iOS uygulamasında native yazılı ve sesli sohbet ekranına açılır; diğer yedi ajan mevcut Wix sayfalarını uygulama içindeki WebView üzerinden kullanmaya devam eder. Web önizlemesinde Şahika da mevcut web akışını kullanır.

Native Şahika, sağlanan `sahika-new(1).js` ve `pulsevet-sahika-mic (1)(1).js` kaynaklarındaki klasik Şahika akışını temel alır. **Şahika Pro dosya yükleme, OCR, fotoğraf/röntgen/ultrason analizi bu native sürümde yoktur.** Diğer ajanların belge özellikleri açılan Wix sayfasının sürümüne bağlıdır.

[Şahika mimarisi ve iPhone kabul kontrolleri](docs/SAHIKA_IOS.md) · [Doğrulama kaydı](docs/DOGRULAMA.md) · [Katalog önizlemesi](docs/ONIZLEME.png)

## Mevcut proje

| Kimlik | Değer |
| --- | --- |
| GitHub deposu | `kemalsutcu/ios` |
| Expo owner | `kemalsutcus-team` |
| Expo slug | `yapay-mevzular` |
| iOS bundle identifier | `com.yapaymevzular.app` |
| EAS project ID | `e34f32e9-0aae-42cc-875e-91685b9fb62f` |

Bu kimlikler mevcut Expo projesine aittir ve korunur. Proje ayarları: [Expo Dashboard](https://expo.dev/accounts/kemalsutcus-team/projects/yapay-mevzular/settings). Kaynak güncellemeleri mevcut GitHub deposunda geliştirme dalı ve pull request üzerinden gözden geçirilir; kaynak değişikliği tek başına telefona kurulum veya App Store yayını yapmaz.

## Windows’ta başlatma

Önerilen proje klasörü:

```text
D:\Users\Kemal\Desktop\Virtari\expoiosgithub\ios
```

Node.js 24 ve Git kurulu olsun. Proje kökünde:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
```

**Native Şahika, ElevenLabs/LiveKit native modüllerini kullandığı için Expo Go ile çalışmaz.** Önce development build oluşturup iPhone’a kurun; ardından `npm start` ile development client sunucusunu açın. Bu projede `start` komutu `expo start --dev-client` çalıştırır.

Mevcut Windows aracıyla:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\Yapay-Mevzular.ps1 -Action Development
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\Yapay-Mevzular.ps1 -Action Start -DevelopmentClient
```

İlk komut EAS buildi oluşturur. İkinci komut, build telefona kurulduktan sonra çalıştırılır. Expo robot tokenı gerekiyorsa mevcut `C:\WIX_SECRETS\ADMIN_TOKEN_EXPO.txt` dosyası kullanılır. Token uygulama kaynaklarına eklenmez. Windows başlatıcısında menü **2** artık development client sunucusunu açar.

[Windows araçları](docs/WINDOWS_KURULUM.md) · [Apple imzalama ve TestFlight](docs/APPLE_IMZALAMA.md)

## iOS build profilleri

| Profil | Kullanım | Metro gerekir mi? |
| --- | --- | --- |
| `development` | Kayıtlı fiziksel iPhone’da development client | Evet |
| `preview` | Kayıtlı fiziksel iPhone’da bağımsız iç test paketi | Hayır |
| `simulator` | macOS/Xcode iOS Simulator için bağımsız test paketi | Hayır |
| `production` | TestFlight/App Store Connect dağıtımı | Hayır |

```powershell
npm run build:preview
npm run build:simulator
npm run build:production
```

Simulator paketi fiziksel iPhone’a kurulmaz ve Windows’ta iOS Simulator çalıştırmaz. Fiziksel cihaz buildleri Apple Developer erişimi ve uygun provisioning gerektirir. Production buildi oluşturmak, mağazaya göndermek ve yayımlamak ayrı adımlardır.

## Şahika’nın kapsamı

- Yazılı sohbet, native sesli görüşme, mikrofon aç/kapat, mesaj geçmişi, sohbet paylaşımı ve kliniğe kullanıcı tarafından açılan telefon/WhatsApp/harita bağlantıları.
- Sabit klasik Şahika ajanı `agent_3201kxh8cz66frw97yn0tb0tm134`, mikrofon dalı `agtbrch_8901m48ppneyfrjsgtp57te8mss0`. Yönetici API anahtarı mobil uygulamaya gömülmez.
- Cihazda en fazla **50 sohbet** saklanır. Aynı sohbet yeniden açıldığında veya yazı/ses bağlantısı değiştiğinde son **24 mesajdan, mesaj metni bütçesi 10.000 karakteri aşmayan** bağlam yeni oturuma aktarılır. Bu, hesaplar ya da cihazlar arası bellek değildir; farklı sohbetler birleştirilmez.
- Sesli bağlantı mikrofon izni ister ve mikrofon kapalı başlar. Kullanıcı mikrofonu açabilir; kullanıcının kesinleşmiş sesli mesajından sonra tekrar kapanır. Arka plana geçişte veya ekrandan çıkışta oturum sonlandırılır. Oturum süresi 10 dakikadır; yerel mesajlar saklanır.
- Varsayılan akış public ajanı kullanır. İsteğe bağlı `EXPO_PUBLIC_SESSION_ENDPOINT`, private ajan için HTTPS sunucusundan kısa ömürlü oturum bilgisi alınmasını sağlar; bu değişken bir sağlayıcı API anahtarı içermez.

Canlı bağlantı, izinler, ses kesintileri ve sağlayıcıdaki ajan ayarları gerçek cihazda doğrulanmalıdır. Derleme veya tür kontrolü bu kabul kontrollerinin yerine geçmez.

## Diğer ajanlar ve dosyalar

Katalog **BELMA, AYLİN, ŞAHİKA, CAN, NARİN, SUDE, ATA ve VINCENT** ajanlarını korur. Public sayfa adresleri `src/data/agents.ts` içinde yönetilir; Şahika için native rota seçimi `src/app/agent/[id].tsx` dosyasındadır.

Diğer ajanların ses, transkript, çoklu belge yükleme ve Belma’nın UDF üretimi açılan Wix sayfasındaki sürüme bağlıdır. Desteklenen indirmeler iOS paylaşım ekranına aktarılır. UDF için **Dosyalara Kaydet** seçeneğini kullanıp kaydedilen belgeyi UYAP Editör’de ayrıca kontrol edin. Favoriler cihazda saklanır. Ajan bağlantıları internet gerektirir.

## Kontroller ve cihaz testi

```powershell
npm run typecheck
npm run lint
npm test
npm run doctor
npm run export:ios
```

GitHub Actions kod kontrollerini Node.js 24 ile çalıştırır; build yayımlamaz. Bu komut listesi bir başarı raporu değildir. Çalıştırılan kontrollerin sonucu [DOGRULAMA.md](docs/DOGRULAMA.md) içinde kaydedilir. Native Şahika için [SAHIKA_IOS.md](docs/SAHIKA_IOS.md), diğer ajanların WebView ve dosya akışları için [CIHAZ_TESTI.md](docs/CIHAZ_TESTI.md) kullanılmalıdır.

## Kimlik bilgileri

Expo/ElevenLabs yönetici anahtarları, Apple imza dosyaları ve kullanıcı belgeleri repoya veya uygulamanın public değişkenlerine eklenmez. Expo robot tokenı EAS erişimi sağlar; Apple Developer yetkisi yerine geçmez. Mobil uygulama bilgisayardaki token dosyasını okumaz.

## Resmî kaynaklar

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Development build kullanımı](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [EAS Build ve iOS imzalama](https://docs.expo.dev/build/setup/)
