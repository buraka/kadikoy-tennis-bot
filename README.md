# Kadıköy Tenis

Kadıköy Belediyesi tenis kortlarında ([spor.kadikoy.bel.tr](https://spor.kadikoy.bel.tr)) boşalan saatleri 2 dakikada bir kontrol edip iOS uygulamasına push bildirimi gönderir.

## Nasıl çalışır

- `scheduledFunction` (Lambda, 2 dk): tenis kortlarını siteden keşfeder, her kortun takvimini (`/Satis/Rezervasyon`) okur, yeni boşalan slotları bulur.
  - Site üyeye ~2 hafta, ziyaretçiye sadece içinde bulunulan haftayı gösterir. SSM'de `/tennis/KADIKOY_TC` ve `/tennis/KADIKOY_PASSWORD` varsa üye olarak girer; oturum çerezi DynamoDB'de saklanır, sadece düşünce yeniden giriş yapılır.
  - Sonuç herkese açık `slots.json` olarak S3'e yazılır (uygulama buradan okur); yeni slotlar cihazların filtresine göre APNs ile gönderilir.
- `registerDevice` (Function URL): uygulama push token'ını ve filtrelerini (kortlar, sadece akşam/hafta sonu) kaydeder. `GET /go?b=&t=&s=` bir kortun takvimini sitede açar.
- `ios/`: SwiftUI uygulaması (xcodegen).

## Komutlar

```bash
npm test               # parser ve bildirim testleri (gerçek sayfa örnekleriyle)
npm run check          # siteyi canlı tarar (girişsiz)
npm run check:login    # SSM'deki üye bilgileriyle giriş yapıp tarar
npm run deploy         # AWS'ye deploy (profil: tennis, hesap gps-tracker 569378724208)
tools/release-ios.sh   # TestFlight'a yeni derleme (derleme no +1)
```

## Sırlar (SSM, eu-central-1)

`/tennis/APNS_KEY_P8`, `/tennis/APNS_KEY_ID`, `/tennis/APP_SHARED_SECRET`, `/tennis/KADIKOY_TC`, `/tennis/KADIKOY_PASSWORD` — Lambda çalışırken okur. Deploy kullanıcısının yetkileri: `infra/deploy-policy.json`.
