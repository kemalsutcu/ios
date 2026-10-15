# Şahika — Yapay Zekâ Veteriner Asistanı

Bağımsız Expo SDK 57 uygulaması. Açılış ekranı doğrudan Şahika'dır. PulseVet'in Wix üzerindeki canlı HTTPS Şahika sayfası, özgün arayüzü ve görselleri kullanılır. iOS kapsayıcısı site gezinti alanlarını gizler; Şahika başlığı, video arka planı ve asistan bileşeninin kendi arayüzüne müdahale etmez.

- Expo sahibi: `kemalsutcus-team`
- Expo slug: `sahika-veteriner`
- iOS bundle identifier / Android package: `com.pulsevet.sahika`
- Canlı kaynak: https://www.pulseveteriner.com/sahika

## Yerel geliştirme

Node.js 22.13 veya üzeri ile bu klasörde çalıştırın:

```sh
npm install
npm run start
```

Yeni paket eklemek için `npx expo install <paket>` kullanın. Anahtarlar mobil uygulamaya eklenmez; canlı sitedeki sunucu bağlantısı kullanılır.

## Doğrulama ve iOS derlemesi

```sh
npm run lint
npm run typecheck
npm test
npm run doctor
npm run build:preview
```

`preview` kayıtlı gerçek cihaz için imzalı dahili dağıtım, `simulator` iOS simülatörü, `production` App Store derlemesi içindir. Gerçek cihaz derlemesi için Apple Developer imzalama bilgileri gerekir. Expo EAS projesi bu uygulamanın kendi kimliğiyle bağlanmalıdır.

Uygulama canlı Wix hizmetine ve internet bağlantısına ihtiyaç duyar. Ajan, sürüm, bilgi bankası ve görüşme ayarları canlı sitenin yapılandırmasından alınır; uygulamada eski bir ajan veya dal kimliği sabitlenmez. Web önizlemesi sayfayı iframe içinde açar; iOS'a özgü site gezinti uyarlaması web önizlemesinde uygulanmaz.

Mikrofon izni sesli görüşme sırasında istenir. Arka plana geçişte bileşenin herkese açık `force-stop-key` sözleşmesi kullanılır ve yakalanan medya parçaları kapatılır. Yeniden öne gelmek mikrofonu otomatik açmaz. Konuşmanın TXT dökümü ve bağlantı raporunun JSON dosyası, iOS paylaş menüsüyle kaydedilebilir; geçici dosyalar paylaşım sonrasında temizlenir. İzin verilen dış bağlantılar yalnızca kullanıcının dokunmasıyla açılır.

Sesli görüşme, iOS WebView medya izinleri, TXT paylaşımı, klinik bağlantıları ve uygulamanın arka plana alınıp yeniden açılması gerçek iPhone üzerinde ayrıca doğrulanmalıdır. Otomatik testler URL/ileti doğrulamasını, hazır olma sinyalini ve mikrofonun uygulama yaşam döngüsündeki kapatma davranışını kapsar; gerçek cihaz testinin yerine geçmez.
