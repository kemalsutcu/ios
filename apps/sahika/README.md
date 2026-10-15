# Şahika — Yapay Zekâ Veteriner Asistanı

Bağımsız Expo SDK 57 uygulaması. Açılış ekranı doğrudan Şahika'dır. PulseVet'in Wix üzerindeki canlı HTTPS Şahika sayfası, özgün asistan arayüzü ve görselleri kullanılır. iOS kapsayıcısı masaüstü ve mobil üst menüleri, dil seçimini, web sitesinin başlığını ve alt bölümlerini gizler. Şahika adı, açıklaması, avatarı, görüşme ve küçük PulseVet × Yapay Mevzular logoları tek WebView tuvalinde aynı video arka planını paylaşır. Ayrı yerel sabit başlık bulunmaz. Özgün başlık fontu, avatar ve sağlanan iki marka logosu uygulamada paketlenir; isimde mor–mavi gradyan, parlama ve sürekli shimmer vardır. Sistem hareketi azaltma tercihi korunur.

Ekran kullanılabilir yüksekliğe flex düzeniyle sığar; dış sayfa ve WebView kaydırması kapalıdır. Uzun konuşmalarda mesaj geçmişi kendi içinde kayar. Klavye ve pencere boyutu değişikliklerinde `visualViewport` yüksekliği kullanılır; dar yükseklikte avatar ve başlık yan yana küçülür. Yerel güvenli alan kenarları belgeye aktarılır ve yalnızca bir kez uygulanır. Canlı asistan öğesi ve oturumu taşınmaz. Kaynak bileşenin shadow DOM'u yeniden oluştuğunda yerleşim geri uygulanır.

Marka varlıkları veya `appLayoutRuntime` değiştiğinde `npm run generate:branding` çalıştırın. Üretilen JavaScript metni Hermes üzerinde `Function.toString()` kullanmadan WKWebView'a iletilir.

- Expo sahibi: `kemalsutcus-team`
- Expo slug: `sahika-veteriner`
- iOS bundle identifier / Android package: `com.pulsevet.sahika`
- Canlı kaynak: https://www.pulseveteriner.com/sahika
- App Store Connect: `6823163636` — Şahika: Veteriner Asistanı (telefondaki ad: Şahika)

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

Arkadaşlara TestFlight dağıtımı için `production` paketi App Store Connect'e yüklenir ve ilk dış test sürümü Apple'ın beta incelemesinden geçer. `submit.production.ios.ascAppId` doğru uygulama kaydına bağlıdır; App Store dağıtım profili ve gönderim kimlik doğrulaması ayrıca hazırlanmalıdır. Hesapta bekleyen geliştirici sözleşmesi hesap sahibi tarafından incelenip kabul edilmelidir. Ad Hoc `preview` paketi yalnızca imzalama profilindeki cihazlara kurulabilir; yeni arkadaş cihazları için profil ve paket yenilenir.

Uygulama canlı Wix hizmetine ve internet bağlantısına ihtiyaç duyar. Ajan, sürüm, bilgi bankası ve görüşme ayarları canlı sitenin yapılandırmasından alınır; uygulamada eski bir ajan veya dal kimliği sabitlenmez. Web önizlemesi sayfayı iframe içinde açar; iOS'a özgü site gezinti uyarlaması web önizlemesinde uygulanmaz.

Mikrofon izni sesli görüşme sırasında istenir. Arka plana geçişte bileşenin herkese açık `force-stop-key` sözleşmesi kullanılır ve yakalanan medya parçaları kapatılır. Yeniden öne gelmek mikrofonu otomatik açmaz. Konuşmanın TXT dökümü ve bağlantı raporunun JSON dosyası, iOS paylaş menüsüyle kaydedilebilir; geçici dosyalar paylaşım sonrasında temizlenir. İzin verilen dış bağlantılar yalnızca kullanıcının dokunmasıyla açılır.

Sesli görüşme, iOS WebView medya izinleri, TXT paylaşımı, klinik bağlantıları ve uygulamanın arka plana alınıp yeniden açılması gerçek iPhone üzerinde ayrıca doğrulanmalıdır. Otomatik testler URL/ileti doğrulamasını, hazır olma sinyalini ve mikrofonun uygulama yaşam döngüsündeki kapatma davranışını kapsar; gerçek cihaz testinin yerine geçmez.
