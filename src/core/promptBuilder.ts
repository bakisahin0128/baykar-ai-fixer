/**
 * LLM'e, verilen bir kod parçasını (veya dosyanın tamamını) bir talimata göre
 * değiştirmesini ve SADECE değiştirilmiş kodu döndürmesini söyler.
 * (Bu fonksiyon, Hızlı Düzeltme gibi özellikler için hala gerekli olabilir.)
 */
export function createModificationPrompt(instruction: string, codeToModify: string): string {
    return `Sen bir uzman yazılım geliştirme asistanısın. Aşağıdaki "DEĞİŞTİRİLECEK KOD"u, verilen "TALİMAT"a göre değiştir.

TALİMAT: "${instruction}"

DEĞİŞTİRİLECEK KOD:
---
${codeToModify}
---

ÇOK ÖNEMLİ KURAL: Yanıt olarak SADECE VE SADECE, başka hiçbir açıklama, yorum veya markdown formatı eklemeden, değiştirilmiş kodun tamamını ver.
`;
}

/**
 * YENİ: Standart sohbet ve bağlam içeren sohbetler için genel bir prompt.
 * Modelden, kullanıcının niyetine göre ya bir açıklama yapmasını ya da
 * bir kod önerisinde bulunmasını ister. Yanıt formatı serbest bırakılmıştır (Markdown).
 */
export function createGeneralChatPrompt(instruction: string, contexts?: Array<{ fileName?: string, content: string }>): string {
    const contextString = contexts && contexts.length > 0
        ? 'Aşağıdaki kod bağlamını dikkate alarak yanıt ver:\n\n' + contexts.map(c => `--- BAĞLAM: ${c.fileName || 'Seçili Kod'} ---\n${c.content}\n---`).join('\n\n')
        : '';

    return `Sen Baykar bünyesinde çalışan, uzman bir yazılım geliştirme asistanısın.
Kullanıcının talimatını analiz et ve yanıtını Markdown formatında, okunabilirliği artırmak için listeler, kalın metinler ve kod parçacıkları gibi zengin formatlar kullanarak oluştur.

${contextString}

Kullanıcı Talimatı: "${instruction}"
`;
}


export function createFixErrorPrompt(errorMessage: string, lineNumber: number, fullCode: string): string {
    return `Aşağıdaki Python kodunda belirtilen hatayı düzelt. Sadece ve sadece, başka hiçbir açıklama veya yorum eklemeden, düzeltilmiş Python kodunun tamamını yanıt olarak ver.

HATA BİLGİSİ:
- Hata Mesajı: "${errorMessage}"
- Satır Numarası: ${lineNumber}

DÜZELTİLECEK KODUN TAMAMI:
---
${fullCode}
---`;
}