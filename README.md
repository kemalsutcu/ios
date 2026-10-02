# Yapay Mevzular · iPhone

Expo SDK 57 ve Expo Router ile hazırlanan iPhone uygulaması. Ajan kataloğu ve favoriler native ekranlardır; ajan görüşmeleri yayımlanmış Wix sayfalarında, uygulama içindeki WebView üzerinden çalışır. Dosya indirmeleri iOS paylaşım ekranına aktarılır.

Bu repo uygulama kaynak kodudur. Expo projesinin bağlanması, Apple imzalama ve gerçek iPhone testi ayrıca tamamlanır; burada hazır bir App Store yayını veya tamamlanmış cihaz testi iddiası yoktur.

[Ekran önizlemesi](docs/ONIZLEME.png) · [Tamamlanan doğrulamalar](docs/DOGRULAMA.md)

## Windows'ta başlat

Proje klasörü:

```text
D:\Users\Kemal\Desktop\Virtari\expoiosgithub\ios
```

1. Node.js 24 ve Git kurulu olsun. Kurulum ZIP'inin içeriğini yukarıdaki klasöre çıkarın; `KURULUM.bat` ve `package.json` doğrudan bu klasörde bulunmalı.
2. Robot kullanıcısı `YAPAYMEVZULAR_ADMIN` için mevcut Expo tokenını yalnızca şu yerel dosyada tutun:

   ```text
   C:\WIX_SECRETS\ADMIN_TOKEN_EXPO.txt
   ```

3. Proje klasöründeki `KURULUM.bat` dosyasını çalıştırın.
4. Menüde **1 — Kurulum ve mevcut Expo projesini bağlama** seçeneğini açın; **mevcut** Expo projesini kullanın. Expo panelinde `kemalsutcus-team` hesabındaki `yapay-mevzular` projesinin **Settings → Project ID** alanından UUID'yi alın. Robot adı, slug ve bundle kimliği UUID değildir.
5. Sırayla **7 — iPhone cihazını kaydet**, **3 — Apple sertifika / provisioning ayarları**, **4 — Preview iOS build** adımlarını kullanın. Başarılı buildin EAS kurulum bağlantısını kayıtlı iPhone'da açın. Preview sürümü geliştirme sunucusu gerektirmez.
6. TestFlight için **5 — Production iOS build**, build tamamlandıktan sonra **6 — App Store Connect/TestFlight'a gönder** adımlarını kullanın. Menü **2** Expo Go önizlemesini, **8** yerel tanı kontrollerini açar; Expo Go önizlemesi gerçek uygulama paketinin cihaz testinin yerine geçmez.

| Kimlik | Beklenen değer |
| --- | --- |
| GitHub deposu | `kemalsutcu/ios` |
| Expo owner | `kemalsutcus-team` |
| Expo slug | `yapay-mevzular` |
| iOS bundle identifier | `com.yapaymevzular.app` |
| EAS project ID | Mevcut Expo projesinin Settings ekranındaki UUID |

Expo robot tokenı EAS erişimi sağlar; Apple Developer yetkisi ve uygulama imzalama bilgilerinin yerine geçmez. Robotun `kemalsutcus-team` hesabında gereken yetkisi bulunmalı. Ayrıntılar: [Windows kurulumu](docs/WINDOWS_KURULUM.md) · [Apple imzalama ve TestFlight](docs/APPLE_IMZALAMA.md).

## Geliştirme ve kontroller

Proje kökünde:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
```

GitHub Actions aynı kontrolleri Node.js 24 ile çalıştırır. Bu workflow build yayımlamaz ve Expo tokenı istemez. Preview, development veya TestFlight paketini gerçek iPhone'da test edin; bilgisayardaki web önizlemesi cihaz izinlerini ve dosya paylaşımını doğrulamaz. Geliştiriciye özel development build akışı için:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\Yapay-Mevzular.ps1 -Action Development
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\Yapay-Mevzular.ps1 -Action Start -DevelopmentClient
```

İkinci komut, development build telefona kurulduktan sonra çalıştırılır.

## GitHub'a aktarma

Bu teslimde GitHub bağlantısı yazma isteğini `403 Resource not accessible by integration` hatasıyla reddetti; dosyalar uzaktaki `kemalsutcu/ios` deposuna yüklenmedi. ZIP bütün kaynakları içerir. Mevcut yerel `ios` deponuza açıp GitHub Desktop ile değişiklikleri gözden geçirebilir ve kendi hesabınızla commit/push yapabilirsiniz. İlk committe yalnız bu paketin dosyalarını seçin; token ve Apple imza dosyalarını eklemeyin. GitHub bağlantısına bu depo için yazma erişimi verildiğinde uzaktan aktarım da yapılabilir.

## Ajanlar ve dosyalar

Katalog: **BELMA, AYLİN, ŞAHİKA, CAN, NARİN, SUDE, ATA ve VINCENT**. Adresler `src/data/agents.ts` dosyasında yönetilir. Sekiz sayfanın canlı HTTP 200 yanıtları 2 Ekim 2026'da doğrulandı. Aylin'in ana sayfada bağlantısı verilen güncel yolu `/aylinastrolog` olarak kullanıldı. Sitedeki genel katalog `/agentatelier` adresindedir.

Ses, transkript, çoklu belge yükleme ve Belma'nın UDF üretimi, açılan Wix ajan sayfasındaki sürüme bağlıdır. İlgili özelliklerin önce Wix'te yayımlanmış olması gerekir. Native uygulama bu sayfaları açar ve desteklenen indirmeleri iOS paylaşımına taşır.

Belma akışında dosyaları seçip sesli görüşmeyi başlatın; görüşme sırasında yeni dosyalar ekleyip gönderebilirsiniz. UDF indirirken paylaşım ekranından **Dosyalara Kaydet** seçeneğini kullanın. iOS'ta kaydedilen UDF'yi UYAP Editör'de açıp içeriğini kontrol etmek ayrı bir adımdır.

Favoriler cihazda saklanır. Görüşme ve gönderilen belge işlemleri Wix/ajan sağlayıcısının hizmetlerine bağlıdır; uygulama çevrimdışı ajan çalıştırmaz. Görüşme ekranından geri çıkışın mikrofonu ve sesi kapattığını gerçek cihazda doğrulayın.

## Kimlik bilgileri

Token dosyasını repoya, uygulama kaynaklarına, `app.json` içine veya `EXPO_PUBLIC_…` değişkenlerine koymayın. Uygulamaya Expo/ElevenLabs yönetici anahtarı gömülmez. Yerel tokenın okunması ve EAS komutlarına aktarılması Windows kurulum araçlarının işidir; mobil uygulamanın çalışması bu dosyayı gerektirmez.

İndirilen veya paylaşılan kullanıcı belgeleri ve imzalı görüşme URL'leri hata raporlarına eklenmemeli. Bu repoda sağlanan CI, uygulama kodu kontrolleri içindir; mağaza yayını ayrı bir işlemdir.

## Cihaz testi

[Gerçek iPhone test listesini](docs/CIHAZ_TESTI.md) uygulayın. Özellikle mikrofon iznini reddetme, aktif görüşmede çoklu dosya gönderme, bağlantı kesintisi, UDF'yi Dosyalar'a kaydetme ve geri dönüşte sesin durması kontrol edilmelidir. Liste test sonuçları değil, doldurulacak kabul ölçütleridir.

## Resmî başvuru kaynakları

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [EAS Build kurulumu ve iOS imzalama](https://docs.expo.dev/build/setup/)
- [Expo robot kullanıcıları ve token kullanımı](https://docs.expo.dev/accounts/programmatic-access/)
- [Development build kullanımı](https://docs.expo.dev/develop/development-builds/use-development-builds/)
