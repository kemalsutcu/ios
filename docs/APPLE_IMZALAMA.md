# iPhone imzalama ve TestFlight

Uygulamanın Bundle Identifier değeri **`com.yapaymevzular.app`**. Expo hesabı **`kemalsutcus-team`**, proje **`yapay-mevzular`**. Apple Team ID, sertifika kimliği, provisioning profile, App Store Connect App ID ve API anahtarı kullanıcı hesabından gelir; pakette uydurulmuş değer bulunmaz.

## Apple ekranındaki alanlar

| Alan | Ne kullanılır? | Nasıl tamamlanır? |
|---|---|---|
| Bundle Identifier / App Identifier | `com.yapaymevzular.app` | Apple Developer'daki uygulama kimliği bu değere karşılık gelmeli. Başkasına ait/kullanılamayan kimlik varsa önce gerçek takımınızda kullanılabilirliği çözün. |
| Apple Team / Team ID | Kendi Apple Developer takımınız | EAS sorusunda doğru takımı seçin; Expo takım adı değildir. |
| Distribution Certificate | Apple dağıtım imza sertifikası | Menü 3 veya ilk buildde EAS'nin mevcut uygun sertifikayı kullanmasına ya da yenisini oluşturmasına izin verin. |
| Provisioning Profile | Bu bundle ve dağıtım türüne uygun profil | Preview/development için ad hoc cihaz listeli; production/TestFlight için App Store dağıtım profili kullanılır. EAS etkileşimli akışta yönetir. |
| Push Notification Key | APNs `.p8` anahtarı | Yalnız push bildirim kullanılacaksa gerekir; temel uygulama imzasının yerine geçmez. Bildirim kullanmıyorsanız sırf ekran boş diye anahtar üretmeyin. |
| App Store Connect API Key | Yetkili Apple hesabının ASC anahtarı | TestFlight gönderimi sırasında EAS'nin sunduğu kurulum akışını tamamlayın veya mevcut yetkili anahtarı seçin. Key ID/Issuer ID ve `.p8` değerlerini rastgele doldurmayın. |
| App Store Connect App ID / `ascAppId` | Apple'ın uygulama kaydına verdiği sayısal kimlik | App Store Connect uygulama kaydındaki Apple ID'dir; bundle veya Expo UUID değildir. Gerektiğinde EAS sorusuna/submit ayarına gerçek değeri girin. |

Expo robot access tokenı yalnız Expo/EAS erişimini sağlar. Apple Developer Program üyeliği ve uygun Apple hesabı yetkisi ayrıca gerekir. Bireysel hesaplarda imza oluşturma yetkisi Account Holder'a aittir; kurumsal hesapta uygun roller ve Certificates, Identifiers & Profiles erişimi gerekir.

## İlk fiziksel iPhone testi

1. `KURULUM.bat` → **1** ile mevcut Expo projesini UUID üzerinden bağlayın.
2. **7** ile iPhone kaydını başlatın. EAS'nin verdiği bağlantıyı telefonda açıp kayıt adımlarını tamamlayın.
3. **3** ile iOS credentials ekranını açın. Apple hesabınızı ve doğru takımınızı seçin. Mevcut uyumlu imza varlıkları kullanılabilir; yoksa EAS'nin otomatik oluşturma adımlarını takip edin.
4. **4** ile `preview` buildi başlatın. EAS gerekli Apple yetkisini ve provisioning profile güncellemesini sorabilir.
5. EAS build sayfasındaki kurulum bağlantısını kayıtlı iPhone'da açın.

Menü 3'te yaptığınız seçimler gerçek Apple/EAS imza varlıklarını yönetir. Var olan sertifikaları silmek veya iptal etmek gerekmez; bu paketin scriptleri otomatik silme/iptal etme komutu içermez.

## TestFlight

1. App Store Connect'te aynı Bundle ID için uygulama kaydını tamamlayın. Gerçek Apple ID/uygulama adı ve dil bilgilerinizi kullanın.
2. Menü **5** ile production build oluşturun. Bu işlem tek başına yükleme yapmaz.
3. Build başarılı olunca menü **6** seçin. EAS listesinden göndereceğiniz production iOS buildini seçin; preview/development paketi seçmeyin.
4. EAS'nin App Store Connect kimlik bilgileri akışını tamamlayın. Gerekiyorsa mevcut ASC API anahtarını bağlayın veya yetkili Apple hesabınızla kurun.
5. Apple işlemesi tamamlanınca App Store Connect → TestFlight bölümünden buildi ve testçi erişimini yönetin. Haricî testçilerin erişimi Apple beta incelemesi gerektirebilir.

Script `--auto-submit` veya `--latest` kullanmaz. App Store yayımlama, mağaza metinleri/ekran görüntüleri ve Apple incelemesi TestFlight yüklemesinden ayrı işlemlerdir.

## Anahtarların yeri

Expo tokenı `C:\WIX_SECRETS\ADMIN_TOKEN_EXPO.txt` dosyasında kalır. Apple `.p8`, `.p12`, `.mobileprovision`, özel anahtarlar veya `credentials.json` dosyalarını kod deposuna eklemeyin. Otomatik EAS credentials akışında bu değerleri elle koda yerleştirmek gerekmez. Apple hesabı oturumunu EAS CLI'nin kendi güvenli isteminde açın; parola veya anahtar içeriğini script parametresine yazmayın.

Bu ortamda gerçek Expo tokenı, Apple Developer hesabı veya mevcut proje UUID'si sağlanmadığından uzaktan build, cihaz kaydı, sertifika oluşturma ve App Store Connect gönderimi yapılmadı.

Resmî kaynaklar: [otomatik imza yönetimi](https://docs.expo.dev/app-signing/managed-credentials/), [iOS kimlik bilgileri](https://docs.expo.dev/app-signing/app-credentials/), [Apple yetkileri](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/), [iç dağıtım](https://docs.expo.dev/build/internal-distribution/), [iOS gönderimi](https://docs.expo.dev/submit/ios/), [TestFlight](https://docs.expo.dev/submit/testflight/).
