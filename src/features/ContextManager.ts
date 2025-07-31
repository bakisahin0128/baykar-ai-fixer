/* ==========================================================================
   DOSYA 3: src/features/ContextManager.ts
   
   SORUMLULUK: Editörden seçilen kod veya yüklenen dosya gibi geçici
   bağlamları yönetir.
   GÜNCELLEME: Dosya yükleme mantığı, mevcut dosyaları silmek yerine
              yenilerini ekleyecek şekilde değiştirildi.
   ========================================================================== */

import * as vscode from 'vscode';
import * as path from 'path';

export class ContextManager {
    public activeEditorUri?: vscode.Uri;
    public activeSelection?: vscode.Selection;
    public activeContextText?: string;
    
    public uploadedFileContexts: Array<{
        uri: vscode.Uri;
        content: string;
        fileName: string;
    }> = [];

    public setEditorContext(uri: vscode.Uri, selection: vscode.Selection, text: string, webview: vscode.Webview) {
        this.clearAll(webview, false); 
        this.activeEditorUri = uri;
        this.activeSelection = selection;
        this.activeContextText = text;
        webview.postMessage({
            type: 'contextSet',
            payload: `Talimatınız seçili koda uygulanacaktır...`
        });
    }

    /**
     * GÜNCELLENDİ: Artık dosyaları silmiyor, mevcutların üzerine ekliyor.
     * Fonksiyonun adı setFileContext -> addFilesToContext olarak değiştirildi.
     */
    public async addFilesToContext(webview: vscode.Webview) {
        const fileUriArray = await vscode.window.showOpenDialog({ 
            canSelectMany: true, 
            openLabel: 'Dosyaları Ekle',
            title: 'Analiz için dosya seçin (Toplam 5 adet)'
        });

        if (!fileUriArray || fileUriArray.length === 0) {
            return; // Kullanıcı dosya seçmekten vazgeçti
        }

        if (this.uploadedFileContexts.length + fileUriArray.length > 5) {
            vscode.window.showErrorMessage('En fazla 5 dosya ekleyebilirsiniz.');
            return;
        }

        for (const uri of fileUriArray) {
            // Aynı dosyanın tekrar eklenmesini engelle
            if (this.uploadedFileContexts.some(f => f.uri.fsPath === uri.fsPath)) {
                vscode.window.showWarningMessage(`'${path.basename(uri.fsPath)}' dosyası zaten ekli.`);
                continue;
            }

            const fileBytes = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(fileBytes).toString('utf8');
            const fileName = path.basename(uri.fsPath);
            this.uploadedFileContexts.push({ uri, content, fileName });
        }
        
        const fileNames = this.uploadedFileContexts.map(f => f.fileName);
        webview.postMessage({ type: 'fileContextSet', fileNames: fileNames });
    }
    
    public removeFileContext(fileNameToRemove: string, webview: vscode.Webview) {
        this.uploadedFileContexts = this.uploadedFileContexts.filter(f => f.fileName !== fileNameToRemove);
        
        const fileNames = this.uploadedFileContexts.map(f => f.fileName);
        
        if (fileNames.length > 0) {
            webview.postMessage({ type: 'fileContextSet', fileNames: fileNames });
        } else {
            // Hiç dosya kalmadıysa, 'clearContext' yerine 'clearFileContext' göndererek
            // sadece dosya etiketlerini temizlemesini sağlayabiliriz.
            webview.postMessage({ type: 'clearFileContext' });
        }
    }

    public getUploadedFilesSize(): number {
        if (this.uploadedFileContexts.length === 0) {
            return 0;
        }
        return this.uploadedFileContexts.reduce((total, file) => total + file.content.length, 0);
    }

    public clearAll(webview: vscode.Webview, notifyWebview: boolean = true) {
        this.activeEditorUri = undefined;
        this.activeSelection = undefined;
        this.activeContextText = undefined;
        this.uploadedFileContexts = [];
        if (notifyWebview) {
            webview.postMessage({ type: 'clearContext' });
        }
    }
}