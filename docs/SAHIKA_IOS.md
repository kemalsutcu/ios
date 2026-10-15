# Native Şahika · iOS

Şahika, mevcut Yapay Mevzular kataloğundaki `sahika` kimliğiyle native ekrana açılır. Diğer ajanlar WebView akışını korur. Aşağıdaki kontroller kabul ölçütleridir; yapılmış cihaz testleri olarak okunmamalıdır.

## Mimari

| Dosya / katman | Sorumluluk |
| --- | --- |
| `src/app/agent/[id].tsx` | Katalog kimliğine göre native Şahika veya mevcut ajan ekranını seçer. |
| `src/components/NativeSahika.tsx` | Native Şahika girişini yükler. Web karşılığı mevcut web akışını kullanır. |
| `src/features/sahika/SahikaApp.tsx` | ElevenLabs `ConversationProvider` kapsamı, sohbet paylaşımı ve kullanıcı tarafından açılan klinik bağlantıları. |
| `components/ChatScreen.tsx` | Native mesaj listesi, yazı/ses modu, mikrofon ve yerel geçmiş arayüzü. |
| `hooks/useSahika.ts` | Oturum yaşam döngüsü, mikrofon, SDK mesajları, yeniden bağlanma ve aynı sohbetin bağlamı. |
| `services/session.ts` | Public yazı bağlantısı, sesli token alımı veya isteğe bağlı HTTPS oturum sunucusu. |
| `services/history.ts` | Cihazdaki sohbetleri AsyncStorage ile okur/yazar; yazmalar sırayla yapılır. |
| `config.ts` | Public ajan/dal kimliği, isteğe bağlı endpoint ve 600 saniyelik oturum sınırı. |

ElevenLabs/LiveKit modülleri yalnız native Şahika ekranında yüklenir. Global katalog/favori sağlayıcıları bu sesli oturuma bağlanmaz. Yazılı bağlantı WebSocket/text-only, sesli bağlantı WebRTC kullanır. Sesli oturum başlamadan mikrofon izni istenir; ekranı açmak kendiliğinden mikrofonu açmaz.

Kaynak, verilen iki klasik Şahika tarayıcı bileşenidir. Native yapı bu bileşenleri WebView’e gömmek yerine yeniden uygular. Ajan `agent_3201kxh8cz66frw97yn0tb0tm134`, dal `agtbrch_8901m48ppneyfrjsgtp57te8mss0` olarak sabittir. Bu, Şahika Pro ajanı değildir. Sağlanan dosyalarda bulunmayan belge yükleme, OCR ve görsel/röntgen/ultrason analizi native sürüme eklenmiş sayılmaz.

## Geçmiş ve bağlam

En fazla 50 yerel sohbet tutulur. Aynı sohbetin yeniden bağlanmasında son 24 mesajın metinleri toplamda en fazla 10.000 karakterlik bütçeyle `sendContextualUpdate` üzerinden aktarılır. Bu aktarım yeni bir kullanıcı mesajı olarak gösterilmez. Yeni sohbet açmak farklı bir bağlam başlatır; hesaplar veya cihazlar arasında senkronizasyon yoktur. Geçmişten silme işlemi cihazdaki kaydı kaldırır; sağlayıcıdaki görüşme kayıtlarını silen bir API çağrısı değildir.

İsteğe bağlı `EXPO_PUBLIC_SESSION_ENDPOINT` kullanılırsa uygulama `{ mode, agentId, branchId }` JSON gövdesiyle HTTPS `POST` yapar. Yazı için `signedUrl`/`signed_url`, ses için `conversationToken`/`token` beklenir. Sunucu yönetici API anahtarı döndürmemelidir. Varsayılan public akış uygulamaya sağlayıcı anahtarı eklemez.

## Build ve kurulum

Expo Go native ElevenLabs/LiveKit modüllerini içermez. Fiziksel iPhone için `development` veya `preview`; macOS iOS Simulator için `simulator` profili kullanılır. `simulator` profili bağımsız pakettir ve Metro gerektirmez. Development build kurulduktan sonra `npm start` development client sunucusunu açar. Apple imzalama ve cihaz kaydı için [APPLE_IMZALAMA.md](APPLE_IMZALAMA.md) dosyasına bakın.

Mevcut Expo owner/slug/bundle/UUID korunur: `kemalsutcus-team` / `yapay-mevzular` / `com.yapaymevzular.app` / `e34f32e9-0aae-42cc-875e-91685b9fb62f`.

## Gerçek iPhone kabul kontrolleri

| Kontrol | Beklenen sonuç | Sonuç |
| --- | --- | --- |
| Katalogdan Şahika ve başka bir ajan açma | Şahika native; diğer ajan mevcut WebView ekranında açılır. Favoriler korunur. | Bekliyor |
| Yazılı ilk mesaj / Türkçe karakter / uzun cevap | Kullanıcı mesajı bir kez görünür, cevap gelir, klavye mesaj alanını kapatmaz. | Bekliyor |
| Mikrofon iznini reddetme | Açıklayıcı hata görülür; yazılı sohbete dönülebilir. | Bekliyor |
| Sesli oturum başlatma | Bağlantı kurulur; mikrofon kapalı başlar, ajan sesi duyulur. | Bekliyor |
| Mikrofonu açma ve konuşma | Kesinleşmiş kullanıcı mesajı görünür; mikrofon tekrar kapanır; cevap duyulur. | Bekliyor |
| Ajan konuşurken mikrofon açma | Kullanıcı seçimi uygulanır; yanıt kesme ve ses/mikrofon durumları tutarlı kalır. | Bekliyor |
| Yazı/ses modunu değiştirme | Önceki oturum kapanır; aynı sohbet mesajları ve bağlamı korunur. | Bekliyor |
| Uygulamayı arka plana alma / Şahika’dan çıkma | Ses ve mikrofon sonlanır; yeniden açışta yerel mesajlar görünür. | Bekliyor |
| Uçak modu / ağ kesilmesi / tekrar bağlanma | Bekleme sonsuza uzamaz; hata gösterilir ve yeniden bağlantı mümkün olur. | Bekliyor |
| Aynı sohbeti kapatıp yeniden açma | Son mesajlar görünür; yeni oturuma aynı sohbetin sınırlı bağlamı aktarılır. | Bekliyor |
| Yeni sohbet ve geçmişten farklı sohbet açma | Önceki sohbetin bağlamı yeni sohbete sızmaz. | Bekliyor |
| Geçmişten silme ve uygulamayı yeniden açma | Silinen yerel sohbet yeniden belirmez. | Bekliyor |
| Paylaşım / WhatsApp / telefon / harita | Kullanıcı düğmesi ilgili sistem ekranını açar; WhatsApp mesajı kendiliğinden gönderilmez. | Bekliyor |
| 10 dakika veya manuel bitirme | Oturum kapanır; mesajlar cihazda kalır, yeni bağlantı açılabilir. | Bekliyor |
| Native paket ve web önizleme | Native SDK web paketine girmez; webde mevcut Şahika fallback’i açılır. | Bekliyor |

Test kaydına cihaz modeli, iOS sürümü, build kimliği/tarihi ve bulunan hatalar eklenmelidir. Statik kontroller ile cihaz sonuçları ayrı kaydedilir.

## Sabit SDK düzeltmesi

`patches/@elevenlabs+client+1.28.0.patch`, kilitli ElevenLabs istemcisinin iki başlangıç davranışını düzeltir: `initialMicMuted` seçeneği ile mikrofon kaynağı ilk yayınından önce sessize alınır; WebSocket el sıkışması 25 saniyeyi aşarsa gerçek bağlantı kapatılır. `npm ci` sonundaki `patch-package --error-on-fail` adımı yamayı uygular. SDK yükseltilirken bu davranışlar tekrar doğrulanmalı; yama sessizce atlanmamalıdır. Mikrofon yayını ve yarım kalan bağlantı davranışları gerçek SDK sınıfları üzerinde taklit fiziksel aygıt/bağlantıyla test edilir. Bunlar iPhone üzerinde yapılmış kayıt testleri değildir.
