# Şahika native iOS doğrulaması — 15 Ekim 2026

- SDK 57 yapılandırması mevcut EAS projesi `e34f32e9-0aae-42cc-875e-91685b9fb62f`, owner `kemalsutcus-team`, slug `yapay-mevzular` ve bundle `com.yapaymevzular.app` ile eşleşir.
- TypeScript ve ESLint kontrolleri geçti.
- Mevcut katalog/indirme testleri ile oturum, mikrofon yayını ve bağlantı zaman aşımı kontrollerini kapsayan 24 test geçti.
- Kaynaktaki tam ajan/dal için kimlik doğrulamasız kısa ömürlü ses oturumu anahtarı HTTP 200 ile alındı; anahtar kaydedilmedi veya kaynak koda eklenmedi. Bu kontrol sesli görüşme testi değildir.
- Metro iOS Hermes paketi üretildi. Web platformu mevcut Şahika WebView/web karşılığını kullanır.
- Gerçek iPhone mikrofon/hoparlör, fiziksel kesinti ve kurulum kabul testleri henüz yapılmadı. [Cihaz kabul adımları](SAHIKA_IOS.md).

EAS bulut derlemesinin durumu ayrıca Expo panelindeki ilgili derleme kaydından izlenir. Bu dosya App Store veya TestFlight yayını yapıldığını belirtmez.
