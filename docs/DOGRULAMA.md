# Paket doğrulaması · 2 Ekim 2026

- TypeScript (`npm run typecheck`): başarılı.
- ESLint (`npm run lint`): başarılı.
- Katalog, favoriler ve indirme güvenliği testleri: 3 test dosyası, 11 senaryo başarılı.
- Expo iOS JavaScript/Hermes bundle export: başarılı. Bu, Apple tarafından imzalanmış IPA değildir.
- Expo web export: başarılı; iPhone izinlerini doğrulamaz.
- 390×844 yerel Chromium önizlemesi: ana ekran, arama, favorilerin yenilemede korunması, boş arama, onam kapısı, geri dönüş/yeniden giriş ve rehber doğrulandı. Yatay taşma veya JavaScript hatası görülmedi.
- Windows kurulum scripti: PowerShell 7.4.6 ile sözdizimi kontrolü ve 12 çevrimdışı komut/token testi başarılı. Script PowerShell 5.1 uyumlu yazıldı; gerçek Windows 5.1 ortamında çalıştırılmadı.
- Sekiz ajan adresi: canlı HTTP 200; sayfa başlıkları ve açıklamaları doğrulandı.
- Expo config yerel çözümleme: başarılı.
- Expo Doctor: 19/21 kontrol başarılı. Expo config şeması için `exp.host` DNS erişimi, React Native Directory için dış servis yanıtı bu ortamda başarısız oldu. Bu iki çevrimiçi kontrol Windows kurulumunda tekrar çalışır; hatalar gizlenmedi.

Gerçek iPhone mikrofonu, dosya seçicisi, devam eden görüşmeye yükleme, iOS paylaşım ekranı, Apple imzası ve TestFlight gönderimi bu ortamda çalıştırılmadı. [Cihaz testini](CIHAZ_TESTI.md) ilk preview build üzerinde uygulayın.

Expo proje UUID'si ve Apple hesabı bu pakete eklenmedi. Windows kurulum aracı mevcut projeyi UUID ile bağlar; tokenı yalnız belirtilen yerel dosyadan okur.
