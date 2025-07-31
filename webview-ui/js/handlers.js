/* ==========================================================================
   OLAY YÖNETİCİLERİ (EVENT HANDLERS)
   Kullanıcı etkileşimlerini ve eklentiden gelen mesajları yönetir.
   DÜZELTME: 'contextSet' mesajı artık sohbet baloncuğu ve yükleniyor
             animasyonu göstermeyecek.
   ========================================================================== */

import * as DOM from './dom.js';
import * as UI from './ui.js';
import * as VsCode from './vscode.js';
import { populateHistory } from './components/history.js';
import { loadConfig } from './components/settings.js';

let pendingDiffData = null;

/**
 * Textarea'nın yüksekliğini içeriğine göre ayarlar.
 * @param {HTMLTextAreaElement} textarea - Yüksekliği ayarlanacak textarea elementi.
 */
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto'; // Yüksekliği sıfırla ki küçülebilsin
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function handleSendMessage() {
    if (UI.getAiRespondingState()) return;
    const text = DOM.input.value;
    if (text.trim() === '') return;

    UI.addUserMessage(text);
    DOM.input.value = '';
    
    autoResizeTextarea(DOM.input);
    UI.recalculateTotalAndUpdateUI();

    VsCode.postMessage('askAI', text);
    UI.setInputEnabled(false);
}

function handleApproveChange() {
    if (pendingDiffData) {
        VsCode.postMessage('approveChange', { diff: pendingDiffData });
        DOM.approveChangeButton.disabled = true;
        DOM.rejectChangeButton.disabled = true;
        DOM.approveChangeButton.textContent = 'Uygulanıyor...';
    }
}

function handleRejectOrCloseChange() {
    pendingDiffData = null;
    UI.hideDiffView();
}


export function initEventHandlers() {
    DOM.sendButton.addEventListener('click', handleSendMessage);

    DOM.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    });

    DOM.input.addEventListener('input', () => {
        autoResizeTextarea(DOM.input);
        UI.recalculateTotalAndUpdateUI();
    });

    DOM.newChatButton.addEventListener('click', () => {
        if (UI.getAiRespondingState()) return;
        VsCode.postMessage('newChat');
    });

    DOM.attachFileButton.addEventListener('click', () => {
        if (UI.getAiRespondingState()) return;
        VsCode.postMessage('requestFileUpload');
    });

    DOM.approveChangeButton.addEventListener('click', handleApproveChange);
    DOM.rejectChangeButton.addEventListener('click', handleRejectOrCloseChange);
    DOM.closeDiffButton.addEventListener('click', handleRejectOrCloseChange);
}

export function initMessageListener() {
    VsCode.onMessage(message => {
        const data = message.payload ?? message.value;
        
        switch (message.type) {
            case 'addResponse':
                UI.showAiResponse(data);
                VsCode.postMessage('requestContextSize');
                break;
            
            case 'updateContextSize':
                UI.setContextSize(data.conversationSize, data.filesSize);
                break;
            
            case 'showDiff':
                pendingDiffData = data; 
                UI.showDiffView(data);
                break;

            case 'changeApproved':
                handleRejectOrCloseChange(); 
                // Önceki addUserMessage yerine, UI'da özel bir AI mesajı gösterme fonksiyonu kullanmak daha doğru olur.
                // Şimdilik bu şekilde bırakıyorum, ancak gelecekte UI.addAiMessage gibi bir fonksiyon daha mantıklı olabilir.
                UI.addUserMessage("Değişiklik başarıyla uygulandı!");
                DOM.approveChangeButton.disabled = false;
                DOM.rejectChangeButton.disabled = false;
                DOM.approveChangeButton.textContent = 'Değişikliği Onayla';
                break;

            case 'fileContextSet': 
                UI.displayFileTags(message.fileNames); 
                VsCode.postMessage('requestContextSize');
                break;
            case 'clearContext':
            case 'clearFileContext':
                UI.clearFileTag(); 
                break;
            case 'loadConfig':
                loadConfig(data);
                break;
            case 'loadHistory':
                populateHistory(data);
                break;
            case 'clearChat':
                UI.clearChat();
                autoResizeTextarea(DOM.input);
                break;
            case 'loadConversation':
                UI.loadConversation(data);
                break;

            // DÜZELTME: 'contextSet' mesajı artık sadece placeholder'ı güncelliyor.
            case 'contextSet': 
                 DOM.input.placeholder = data;
                 DOM.input.focus(); // Kullanıcının direkt yazmaya başlaması için input'a odaklan
                 break;
        }
    });
}