# Windows'ta Yapay Mevzular iPhone projesi

Projeyi `D:\Users\Kemal\Desktop\Virtari\expoiosgithub\ios` klasörüne çıkarıp **KURULUM.bat** dosyasına çift tıklayın. Klasörü başka yere taşırsanız başlatıcı kendi konumunu kullanır. ZIP'in içinden çalıştırmayın.

## İlk kurulum

1. Expo SDK 57'nin desteklediği **Node.js LTS** ve Git for Windows kurulu olsun. Node kurulumundan sonra terminali yeniden açın. Yönetici olarak çalıştırmak gerekmez.
2. Expo robotu **YAPAYMEVZULAR_ADMIN** için oluşturulmuş **ADMIN_TOKEN_EXPO** access tokenının gerçek değerini `C:\WIX_SECRETS\ADMIN_TOKEN_EXPO.txt` dosyasına tek satır yazın. Dosyada token adı veya `EXPO_TOKEN=...` ifadesi bulunmasın. Gerçek token bu pakette yoktur.
3. `KURULUM.bat` → **1**. Kilitli bağımlılıklar `npm ci --engine-strict` ile kurulur; doctor, TypeScript ve lint kontrolleri çalışır.
4. Proje kimliği sorulunca [mevcut Expo projesinin ayarlarından](https://expo.dev/accounts/kemalsutcus-team/projects/yapay-mevzular/settings) **Project ID** UUID'sini kopyalayın. UUID bir sır değildir. Hesap `kemalsutcus-team`, proje `yapay-mevzular` olmalı.
5. Script yalnız bu UUID ile mevcut projeyi bağlar. Bağlandıktan sonra `app.json` içindeki `expo.extra.eas.projectId` alanı dolmuş olur. UUID'yi henüz bulamadıysanız boş bırakıp sonra tekrar **1** çalıştırabilirsiniz.

Kurulum yeni bir Expo projesi, Apple sertifikası veya bulut buildi kendiliğinden oluşturmaz. Proje adı/owner, UUID yerine geçmez. Mevcut projeye erişim hatasında doğru UUID'yi ve robotun takım erişimini kontrol edin.

## Menü

| Seçim | İşlem |
|---|---|
| 1 | Bağımlılıkları kurar, kontrolleri yapar, mevcut proje UUID bağlantısını kurar. |
| 2 | Kurulmuş development client için QR kodlu yerel geliştirme sunucusunu açar. |
| 3 | Apple sertifika ve provisioning profile yönetimini açar. |
| 4 | Kayıtlı fiziksel iPhone için `preview` bulut buildini başlatır. |
| 5 | TestFlight/App Store için `production` bulut buildini başlatır. |
| 6 | Seçeceğiniz production buildini App Store Connect'e gönderir. |
| 7 | Preview/development için iPhone kaydını başlatır. |
| 8 | Ortam, proje, doctor, TypeScript, lint ve varsa robot erişimini kontrol eder. |

**5 build oluşturur; 6 gönderir.** Otomatik gönderim veya otomatik “en son build” seçimi yoktur. App Store Connect'e gönderilen buildin işlenmesi ve TestFlight tester erişimi Apple tarafında tamamlanır; bu işlem uygulamayı kendiliğinden App Store'da yayımlamaz.

## iPhone'da açma

**Development client:** Native Şahika, ElevenLabs/LiveKit modülleri içerdiği için Expo Go ile çalışmaz. Önce aşağıdaki komutla development build oluşturun ve EAS kurulum bağlantısından iPhone'a yükleyin. Sonra menü **2** ile sunucuyu açıp QR kodunu development client ile kullanın. Telefon ve bilgisayar aynı Wi-Fi'da olsun; Windows güvenlik duvarı sorarsa özel ağ erişimine izin verin. `npm start` ve PowerShell `-Action Start` artık varsayılan olarak `--dev-client` kullanır.

**Preview:** Menü **7** ile cihaz kaydını tamamlayın, ardından **4** çalıştırın. Build sonunda EAS'nin kurulum bağlantısını kayıtlı iPhone'da açın. Sonradan yeni cihaz eklenirse o cihazın provisioning profile'a alınması için yeni build veya EAS re-sign işlemi gerekir. Preview, Expo Go ve açık bir Metro sunucusu gerektirmeyen test paketidir.

Development build oluşturmak ve kurulumdan sonra sunucuyu açmak için:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\windows\Yapay-Mevzular.ps1" -Action Development
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\windows\Yapay-Mevzular.ps1" -Action Start -DevelopmentClient
```

`-DevelopmentClient` eski kısayollarla uyumluluk için kabul edilir; Start artık bu parametre olmadan da aynı modu kullanır.

**Simulator:** `-Action Simulator` veya `npm run build:simulator` bulutta bağımsız simulator paketi oluşturur; Metro sunucusu gerektirmez. Apple'ın yerel iOS Simulator uygulaması macOS/Xcode gerektirir; bu paket Windows'ta veya fiziksel iPhone'da çalışmaz.

## Token ve dosya yolları

Script tokenı yalnız EAS alt sürecinin çalıştığı sırada **process kapsamındaki `EXPO_TOKEN`** değişkenine atar; başarı veya hatadan sonra önceki değeri geri yükler. `setx`, kalıcı ortam değişkeni, `.env`, `EXPO_PUBLIC_*`, kod deposuna kopyalama veya ekrana token yazma kullanmaz. `npm ci`, yerel Expo sunucusu ve uygulama paketi token dosyasını okumaz.

Farklı token yolu veya önceden bilinen UUID ile:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\windows\Yapay-Mevzular.ps1" -Action Link -TokenPath "C:\WIX_SECRETS\ADMIN_TOKEN_EXPO.txt" -ProjectId "MEVCUT-PROJENIN-GERCEK-UUID-DEGERI"
```

Sadece yerel kurulumu yapmak için `-Action Setup -SkipProjectLink` kullanın. `-ProjectRoot` ile farklı klasör seçilebilir. PowerShell kodunu terminale parça parça yapıştırmak yerine `.ps1` dosyasını `-File` ile çalıştırın; yol çözümü parametrelerden sonra yapılır.

## Yaygın durumlar

- **Token dosyası yok:** Gerçek tokenı yukarıdaki haricî dosyaya kaydedin. Robotun adı, token değeri değildir.
- **Owner/slug/bundle uyuşmuyor:** `app.json` değerleri `kemalsutcus-team`, `yapay-mevzular`, `com.yapaymevzular.app` olmalı. Script başka projeye geçmez.
- **UUID eksik:** Menü 1 veya `-Action Link`; proje UUID'sini Dashboard'dan alın.
- **npm engine hatası:** Node.js sürümünü projenin istediği desteklenen LTS sürümüne yükseltip tekrar 1 çalıştırın.
- **Kontrol başarısız:** Buildi başlatmadan önce doctor/typecheck/lint çıktısındaki somut hatayı giderin. Script bu kapıları otomatik atlamaz.
- **Expo/Apple yetkisi:** Expo robot erişimi Apple Developer hesabı yerine geçmez; [APPLE_IMZALAMA.md](APPLE_IMZALAMA.md) akışını kullanın.

Expo komutları projeye kurulu aracı kullanır. EAS komutları `npm exec --yes --package=eas-cli@24.9.0 -- eas ...` ile sabit sürümden çalışır; EAS CLI proje bağımlılığına eklenmez ve global kurulum gerekmez. İlk EAS çağrısı bu sürümü npm önbelleğine indirebilir. Expo uygulamasının bağımlılıkları `package-lock.json` ile sabitlenir. Windows PowerShell 5.1 sözdizimi hedeflenmiştir.

Resmî kaynaklar: [SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Expo geliştirme](https://docs.expo.dev/get-started/start-developing/), [EAS CLI](https://docs.expo.dev/eas/cli/), [token erişimi](https://docs.expo.dev/accounts/programmatic-access/), [iç dağıtım](https://docs.expo.dev/build/internal-distribution/).
