/* ==========================================================================
   DOSYA 5: src/core/utils.ts (GÜNCELLENMİŞ DOSYA)
   
   SORMLULUK: Proje genelinde kullanılacak yardımcı fonksiyonları barındırır.
   YENİ: cleanLLMJsonBlock fonksiyonu daha akıllı hale getirildi.
   ========================================================================== */

export function cleanLLMCodeBlock(rawResponse: string): string {
    const cleaned = rawResponse.replace(/^```(?:\w+)?\s*\n|```\s*$/g, '');
    return cleaned.trim();
}

/**
 * YENİ ve GÜÇLENDİRİLMİŞ FONKSİYON
 * Modelden gelen yanıtın içinden JSON metnini daha güvenilir bir şekilde çıkarır.
 * Önce markdown bloğunu arar, bulamazsa ilk '{' ve son '}' arasındaki metni alır.
 * @param rawResponse Modelden gelen ham metin.
 * @returns Temizlenmiş JSON string'i.
 */
export function cleanLLMJsonBlock(rawResponse: string): string {
    // 1. Önce standart markdown bloğunu ara
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1].trim();
    }

    // 2. Markdown bloğu yoksa, ilk açılan ve son kapanan süslü parantezi bul
    const firstBrace = rawResponse.indexOf('{');
    const lastBrace = rawResponse.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
        // Parantezler arasındaki metni alıp temizle
        return rawResponse.substring(firstBrace, lastBrace + 1).trim();
    }

    // 3. Hiçbir şey bulunamazsa, orijinal yanıtı (muhtemelen hatalı) geri döndür
    return rawResponse.trim();
}

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}