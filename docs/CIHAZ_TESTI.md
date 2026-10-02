# iPhone cihaz testi

Bu dosya uygulanacak kabul testlerini içerir; tamamlanmış cihaz testi raporu değildir. Her sürümü gerçek iPhone'da preview veya development build ve dağıtım öncesinde TestFlight sürümüyle kontrol edin. Web tarayıcı önizlemesi mikrofon, iOS dosya seçimi ve paylaşım için yeterli kanıt değildir.

## Test kaydı

| Alan | Değer |
| --- | --- |
| Tarih / test eden | |
| Git commit | |
| EAS build bağlantısı / build numarası | |
| iPhone modeli / iOS sürümü | |
| Kurulum: preview / development / TestFlight | |
| Wix sayfası ve yayımlama sürümü | |
| Sonuç: geçti / kaldı / denenmedi | |

Kişisel belge ve gerçek görüşme yerine kısa, yapay test metinleri kullanın. Hata kaydına token, imzalı oturum URL'si veya belge içeriği koymayın.

## Katalog ve gezinme

- [ ] Uygulama temiz kurulumda açılır; katalog ve arama kullanılabilir.
- [ ] Bir ajanı favorilere ekleyip uygulamayı kapatın. Tekrar açıldığında favori kalır; kaldırma işlemi de kalıcıdır.
- [ ] Ajan sayfası doğru yayımlanmış Wix adresini açar. Yüklenme ve bağlantı hatası durumları anlaşılırdır.
- [ ] Ajan ekranından geri dönün: WebView kapanır, görüşme sesi durur ve iOS mikrofon göstergesi söner. Aynı ajanı yeniden açınca eski bir çağrı kendiliğinden devam etmez.
- [ ] Wi-Fi'yi kapatıp yeniden açın: uygulama kilitlenmez; tekrar deneme aynı ekrana döndürür.
- [ ] Küçük ekranda ve büyük metin ayarında düğmeler görünür; klavye mesaj alanını veya gönderme düğmesini kapatmaz.

## Sesli görüşme ve izinler

- [ ] İlk sesli başlatmada iOS mikrofon izin açıklaması görünür. İzin verince ajan sesi duyulur, kullanıcının sesi iletilir.
- [ ] İzni reddederek deneyin. Uygulama çökmez; izin gereksinimi anlaşılır ve yazılı sohbet erişilebilir kalır.
- [ ] Ayarlar'dan mikrofon iznini yeniden açıp tekrar deneyin. WebView'in ayrıca istediği site iznini de kontrol edin.
- [ ] Bas-konuş kullanılıyorsa yalnızca basılı tutulurken kullanıcı sesi gider. Bırakma, parmağı dışarı kaydırma ve uygulamadan çıkma durumlarında mikrofon açık kalmaz.
- [ ] Ajan konuşurken araya girme davranışı Wix sürümündeki ayarla tutarlıdır; aynı ses iki kez duyulmaz.
- [ ] Görüşmeyi bitirme ve geri dönme ayrı ayrı sesi durdurur. Arka plana alma, ekran kilidi, telefon araması ve Bluetooth bağlantı değişimini deneyin; dönüşte habersiz mikrofon açılmasını hata olarak kaydedin.

## Çoklu dosya ve aktif görüşme

Bu bölüm, ilgili Wix ajan sayfasında çoklu yükleme sürümünün yayımlanmış olmasını gerektirir. Mobil uygulama, web sayfasında bulunmayan ajan yeteneklerini kendiliğinden eklemez.

- [ ] Görüşme başlamadan Dosyalar'dan en az bir TXT/UDF ve iki PDF seçin. Dosyalar ayrı satırlarda görünür; yanlış seçileni tek başına kaldırabilirsiniz.
- [ ] Seçimin kendiliğinden görüşme başlatmadığını, ardından sesli başlatma düğmesinin mikrofon izniyle birlikte çalıştığını kontrol edin.
- [ ] Belgeler gönderilince her biri için sorulabilecek farklı bir test bilgisini sesle sorun. Dosya adının görünmesini, içeriğin başarıyla okunduğu kanıtı olarak kabul etmeyin.
- [ ] Görüşme sürerken yeni dosyalar seçip gönderin. Çağrı kapanmaz, yazılı moda geçmez ve önceki belgelerle birlikte sorular yanıtlanabilir.
- [ ] Aynı dosyayı yeniden seçme, boş dosya, desteklenmeyen tür, boyut/adet sınırı ve iCloud'dan henüz indirilmemiş dosyayı deneyin. Sessiz kayıp yerine anlaşılır durum veya hata görünür.
- [ ] Birden fazla dosya gönderilirken bağlantıyı kesin. Gönderilemeyenler kaybolmaz; tekrar denemede daha önce gönderilmiş içerik yanlışlıkla çoğaltılmaz.
- [ ] Dosya seçiciyi iptal edin. Eski seçimler ve aktif görüşme korunur.

## UDF ve Dosyalar'a kaydetme

- [ ] Yapay bilgilerle suç duyurusu taslağı oluşturun; başlık, taraflar ve Türkçe karakterler doğru görünür.
- [ ] UDF indir düğmesine basınca iOS paylaşım sayfası açılır. “Dosyalara Kaydet” ile dosyayı yerel klasöre veya iCloud Drive'a kaydedin.
- [ ] Kaydedilen adın `.udf` uzantısını koruduğunu ve içeriğin boş olmadığını kontrol edin. Dosyayı Windows'a aktararak UYAP Editör'de açın; tablo düzeni ve metni inceleyin.
- [ ] Paylaşımı iptal edip yeniden indirin. Çift paylaşım penceresi, donma veya “kaydedildi” şeklinde hatalı başarı bildirimi olmaz.
- [ ] Aynı adlı iki indirme ve büyük dosya denemesinde önceki kullanıcı dosyası habersizce ezilmez; destek sınırı aşılıyorsa hata açıklanır.

## Adres ve paylaşım sınırları

- [ ] Güvenilen Wix ajan sayfası ve onun normal yönlendirmeleri çalışır.
- [ ] Harici bağlantılar uygulamanın izin verdiği şekilde dış tarayıcı/ilgili uygulamaya yönlendirilir; yabancı bir site ajan WebView'inin yerine yerleşmez.
- [ ] `https://yapaymevzular.com.ornek.invalid`, `https://yapaymevzular.com@ornek.invalid` ve HTTP adreslerini negatif test olarak kullanın. Alan adı içinde güvenilen adın geçmesi erişim hakkı sağlamaz.
- [ ] Güvenilmeyen sayfa/iframe kaynaklı paylaşım mesajı ve bozuk dosya mesajı reddedilir. Ajan sayfasına geri dönünce normal indirme çalışır.
- [ ] URL, bağlantı hatası veya uygulama ekranında Expo tokenı, ElevenLabs anahtarı veya backend sırrı görünmez.

## Yayın kararı

Geçmeyen her kontrol için adımları, beklenen/gerçek sonucu ve ilgili sürümleri yazın. Ses, dosya gönderimi, geri çıkışta mikrofonun kapanması veya UDF kaydetme başarısızsa sürümü hazır olarak işaretlemeyin. Apple imzalama ve App Store/TestFlight işlemleri için ayrıca [imzalama rehberini](APPLE_IMZALAMA.md) izleyin.
