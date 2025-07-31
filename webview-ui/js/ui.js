/* ==========================================================================
   ARAYÜZ (UI) YÖNETİM MODÜLÜ (NİHAİ SÜRÜM)
   - Efekt seçimi için ikon butonu yerine toggle switch kullanıldı.
   - YENİ: Karakter sayacı ve limit kontrolü mantığı eklendi.
   - DÜZELTME: Limit aşıldığında dosya kaldırma sorunu giderildi.
   - DÜZELTME: Limit aşıldığında daha fazla yazı yazılması engellendi.
   ========================================================================== */

import * as DOM from './dom.js';
import { postMessage } from './vscode.js';

// --- STATE (DURUM) YÖNETİMİ ---
let isAiResponding = false;
let isDiffViewActive = false;
let currentAnimationEffect = localStorage.getItem('animationEffect') || 'diffusion';

// Karakter Sayacı ve Limit için Durum Yönetimi
const CONTEXT_LIMIT = 10000;
let conversationSize = 0;
let filesSize = 0;
let isLimitExceeded = false;

/**
 * Animasyon efektini değiştirir ve tercihi kaydeder.
 */
export function toggleAnimationEffect() {
    currentAnimationEffect = DOM.effectToggleSwitch.checked ? 'diffusion' : 'streaming';
    localStorage.setItem('animationEffect', currentAnimationEffect);
}

/**
 * Toggle'ın görsel durumunu mevcut efekte göre günceller.
 */
function updateEffectToggle() {
    if (!DOM.effectToggleSwitch) return;
    DOM.effectToggleSwitch.checked = currentAnimationEffect === 'diffusion';
}

/**
 * UI ilk yüklendiğinde toggle'ın doğru durumda başlamasını sağlar.
 */
export function initUI() {
    updateEffectToggle();
    recalculateTotalAndUpdateUI(); 
}

// ==========================================================================
// Karakter Sayacı Mantığı
// ==========================================================================

/**
 * Eklentiden gelen bağlam boyutlarını (geçmiş, dosyalar) ayarlar ve UI'ı günceller.
 * @param {number} newConversationSize - Sohbet geçmişinin karakter boyutu.
 * @param {number} newFilesSize - Ekli dosyaların toplam karakter boyutu.
 */
export function setContextSize(newConversationSize, newFilesSize) {
    conversationSize = newConversationSize;
    filesSize = newFilesSize;
    recalculateTotalAndUpdateUI();
}

/**
 * Tüm kaynaklardan (giriş, geçmiş, dosyalar) toplam karakter sayısını hesaplar ve UI'ı günceller.
 */
export function recalculateTotalAndUpdateUI() {
    const promptSize = DOM.input.value.length;
    let totalSize = conversationSize + filesSize + promptSize;

    // DÜZELTME: Limiti aşan metni anında kırp.
    if (totalSize > CONTEXT_LIMIT) {
        const overage = totalSize - CONTEXT_LIMIT;
        DOM.input.value = DOM.input.value.slice(0, DOM.input.value.length - overage);
        // Değer değiştiği için prompt boyutunu yeniden al
        totalSize = conversationSize + filesSize + DOM.input.value.length;
    }

    isLimitExceeded = totalSize >= CONTEXT_LIMIT;

    DOM.characterCounter.textContent = `${totalSize} / ${CONTEXT_LIMIT}`;
    DOM.characterCounter.classList.toggle('limit-exceeded', isLimitExceeded);
    
    updateInputAndButtonState();
}

/**
 * Limitin aşılıp aşılmadığına göre giriş elemanlarının durumunu ayarlar.
 */
function updateInputAndButtonState() {
    const isUiBlocked = isAiResponding || isDiffViewActive;

    // Kullanıcıya metni silme şansı vermek için input'u sadece AI meşgulken kilitliyoruz.
    // Yazma engellemesi yukarıdaki `recalculateTotalAndUpdateUI` fonksiyonunda yapılıyor.
    DOM.input.disabled = isUiBlocked;

    const canSend = !isUiBlocked && DOM.input.value.trim().length > 0 && !isLimitExceeded;
    DOM.sendButton.disabled = !canSend;
    DOM.sendButton.style.opacity = canSend ? '1' : '0.5';
    DOM.sendButton.style.cursor = canSend ? 'pointer' : 'not-allowed';

    const canAttach = !isUiBlocked && !isLimitExceeded;
    DOM.attachFileButton.disabled = !canAttach;
    DOM.attachFileButton.style.opacity = canAttach ? '1' : '0.5';
    DOM.attachFileButton.style.cursor = canAttach ? 'pointer' : 'not-allowed';

    if (isUiBlocked) {
        if (isAiResponding) {
            DOM.input.placeholder = 'İvme yanıtlıyor, lütfen bekleyin...';
        } else if (isDiffViewActive) {
            DOM.input.placeholder = 'Lütfen önerilen değişikliği onaylayın veya reddedin.';
        }
    } else if (isLimitExceeded) {
        DOM.input.placeholder = 'Karakter limitine ulaşıldı. Devam etmek için metin silin.';
    } else {
        const fileTags = DOM.fileContextArea.querySelectorAll('.file-tag');
        DOM.input.placeholder = fileTags.length > 0
            ? `${fileTags.length} dosya hakkında bir talimat girin...`
            : 'Bir soru sorun veya dosya ekleyin...';
    }
}


// ==========================================================================
// Mevcut Fonksiyonların Güncellenmesi (Bu bölümde değişiklik yok)
// ==========================================================================

export function showAiResponse(responseText) {
    const loadingElement = document.getElementById('ai-loading-placeholder');
    if (!loadingElement) return;

    loadingElement.querySelector('.avatar-wrapper')?.classList.remove('loading');
    const contentElement = loadingElement.querySelector('div:not(.avatar-wrapper)');
    contentElement.innerHTML = '';
    loadingElement.id = '';

    const chunks = responseText.split(/(```[\s\S]*?```)/g).filter(Boolean);

    async function processChunks() {
        for (const chunk of chunks) {
            const isCode = chunk.startsWith('```');

            if (isCode) {
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                pre.appendChild(code);
                contentElement.appendChild(pre);
                
                const langMatch = chunk.match(/```(\w*)\n/);
                code.className = `language-${langMatch ? langMatch[1] : 'plaintext'} hljs`;
                const rawCode = chunk.replace(/```\w*\n/, '').replace(/```$/, '');
                
                if (currentAnimationEffect === 'diffusion') {
                    await runCodeDiffusionEffect(code, rawCode);
                } else {
                    await runStreamingEffect(code, rawCode, true);
                }
                
                hljs.highlightElement(code);
                addCopyButtonsToCodeBlocks(contentElement);

            } else { 
                const paragraphs = chunk.split(/\n{2,}/g).filter(p => p.trim() !== '');
                for(const paraText of paragraphs) {
                    const paraElement = document.createElement('p');
                    contentElement.appendChild(paraElement);
                    if (currentAnimationEffect === 'diffusion') {
                        await runTextDiffusionEffect(paraElement, paraText.trim());
                    } else {
                        await runStreamingEffect(paraElement, paraText.trim(), false);
                    }
                }
            }
            DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
        }
        isAiResponding = false;
        recalculateTotalAndUpdateUI();
        DOM.input.focus();
    }
    processChunks();
}

function runTextDiffusionEffect(element, originalText) {
    return new Promise(resolve => {
        let step = 0;
        const maxSteps = 10, speed = 40;
        element.classList.add('diffusing-paragraph');
        const getRandomChar = () => String.fromCharCode(Math.floor(Math.random() * (94 - 33 + 1)) + 33);
        
        if (originalText.trim() === '') return resolve();

        const interval = setInterval(() => {
            if (step >= maxSteps) {
                clearInterval(interval);
                element.innerHTML = marked.parse(originalText);
                element.classList.remove('diffusing-paragraph');
                setTimeout(resolve, 100);
                return;
            }
            element.textContent = Array.from(originalText, c => /\s/.test(c) ? c : getRandomChar()).join('');
            step++;
        }, speed);
    });
}

async function runCodeDiffusionEffect(codeElement, rawCode) {
    const lines = rawCode.split('\n');
    for (const line of lines) {
        const lineDiv = document.createElement('div');
        codeElement.appendChild(lineDiv);
        await runDiffusionEffectForLine(lineDiv, line);
    }
    codeElement.textContent = rawCode;
}

function runDiffusionEffectForLine(element, originalLine) {
    return new Promise(resolve => {
        let step = 0;
        const maxSteps = 8, speed = 30;
        const getRandomChar = () => String.fromCharCode(Math.floor(Math.random() * (94 - 33 + 1)) + 33);
        if (originalLine.trim() === '') {
            element.textContent = originalLine;
            return resolve();
        }
        const interval = setInterval(() => {
            if (step >= maxSteps) {
                clearInterval(interval);
                element.textContent = originalLine;
                setTimeout(resolve, 10);
                return;
            }
            element.textContent = Array.from(originalLine, c => /\s/.test(c) ? c : getRandomChar()).join('');
            step++;
        }, speed);
    });
}

function runStreamingEffect(element, originalText, isCode) {
    return new Promise(resolve => {
        let i = 0;
        const speed = isCode ? 10 : 20;
        let buffer = '';
        function type() {
            if (i < originalText.length) {
                buffer += originalText.charAt(i);
                element.textContent = buffer;
                i++;
                DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
                setTimeout(type, speed);
            } else {
                if (!isCode) element.innerHTML = marked.parse(originalText);
                resolve();
            }
        }
        type();
    });
}

export const getAiRespondingState = () => isAiResponding || isDiffViewActive;

export function setInputEnabled(enabled) {
    isAiResponding = !enabled;
    recalculateTotalAndUpdateUI();
}

function addCopyButtonsToCodeBlocks(element) {
    element.querySelectorAll('pre:not(.copy-button-added)').forEach(preElement => {
        const container = document.createElement('div');
        container.className = 'code-block-container';

        const parent = preElement.parentNode;
        if(parent) parent.replaceChild(container, preElement);
        container.appendChild(preElement);
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Kopyala';
        copyButton.addEventListener('click', () => {
            const codeToCopy = preElement.querySelector('code').textContent;
            navigator.clipboard.writeText(codeToCopy).then(() => {
                copyButton.textContent = 'Kopyalandı!';
                setTimeout(() => { copyButton.textContent = 'Kopyala'; }, 2000);
            });
        });
        container.appendChild(copyButton);
        preElement.classList.add('copy-button-added');
    });
}

function createMessageElement(role, content) {
    if (DOM.welcomeContainer.classList.contains('hidden') === false) {
        DOM.welcomeContainer.classList.add('hidden');
        DOM.chatContainer.classList.remove('hidden');
    }

    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}-message fade-in`;

    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'avatar-wrapper';
    const iconElement = document.createElement('img');
    iconElement.className = 'avatar-icon';
    iconElement.src = role === 'user' ? DOM.USER_ICON_URI : DOM.AI_ICON_URI;
    avatarWrapper.appendChild(iconElement);
    messageElement.appendChild(avatarWrapper);

    const contentElement = document.createElement('div');
    contentElement.innerHTML = content;
    messageElement.appendChild(contentElement);

    DOM.chatContainer.appendChild(messageElement);
    DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
    return messageElement;
}

export function addUserMessage(text) {
    const p = document.createElement('p');
    p.textContent = text;
    createMessageElement('user', p.outerHTML);
    conversationSize += text.length; 
    recalculateTotalAndUpdateUI();
    showAiLoadingIndicator();
}

export function showAiLoadingIndicator() {
    if (document.getElementById('ai-loading-placeholder')) return;
    const messageElement = createMessageElement('assistant', '');
    messageElement.id = 'ai-loading-placeholder';
    
    const avatarWrapper = messageElement.querySelector('.avatar-wrapper');
    avatarWrapper.classList.add('loading');
    
    const contentDiv = messageElement.querySelector('div:not(.avatar-wrapper)');
    contentDiv.innerHTML = '<i>İvme düşünüyor...</i>';
}

export function displayFileTags(fileNames) {
    DOM.fileContextArea.innerHTML = '';
    fileNames.forEach(fileName => {
        const tagElement = document.createElement('div');
        tagElement.className = 'file-tag';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = fileName;
        tagElement.appendChild(nameSpan);
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-file-button';
        removeButton.title = 'Dosyayı Kaldır';
        removeButton.dataset.fileName = fileName;
        removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"></path></svg>`;
        
        removeButton.addEventListener('click', (event) => {
            if (isAiResponding || isDiffViewActive) return;
            const fileToRemove = event.currentTarget.dataset.fileName;
            postMessage('removeFileContext', { fileName: fileToRemove });
        });
        
        tagElement.appendChild(removeButton);
        DOM.fileContextArea.appendChild(tagElement);
    });
    recalculateTotalAndUpdateUI();
}

export function clearFileTag() {
    DOM.fileContextArea.innerHTML = '';
    filesSize = 0;
    recalculateTotalAndUpdateUI();
}

export function clearChat() {
    DOM.chatContainer.innerHTML = '';
    DOM.chatContainer.classList.add('hidden');
    DOM.welcomeContainer.classList.remove('hidden');
    conversationSize = 0;
    filesSize = 0;
    DOM.input.value = '';
    recalculateTotalAndUpdateUI();
    hideDiffView();
}

export function loadConversation(messages) {
    clearChat();
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    if (conversationMessages.length > 0) {
        DOM.welcomeContainer.classList.add('hidden');
        DOM.chatContainer.classList.remove('hidden');
        let newConversationSize = 0;
        conversationMessages.forEach(msg => {
            const content = (msg.role === 'assistant') ? marked.parse(msg.content) : `<p>${msg.content}</p>`;
            createMessageElement(msg.role, content);
            newConversationSize += msg.content.length;
        });
        setContextSize(newConversationSize, filesSize);
    } else {
        setContextSize(0, filesSize);
    }
}

function createSmartDiffHtml(oldText, newText) {
    const diff = Diff.diffWords(oldText, newText);
    let html = '';
    diff.forEach(part => {
        const colorClass = part.added ? 'diff-added' :
                           part.removed ? 'diff-removed' : 'diff-unchanged';
        const value = part.value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

        html += `<span class="${colorClass}">${value}</span>`;
    });
    return html;
}

export function showDiffView(diffData) {
    const loadingElement = document.getElementById('ai-loading-placeholder');
    if (loadingElement) {
       loadingElement.remove();
    }
    
    const smartDiffHtml = createSmartDiffHtml(diffData.originalCode, diffData.modifiedCode);
    DOM.unifiedDiffCodeBlock.innerHTML = smartDiffHtml;

    DOM.diffContainer.classList.remove('hidden');
    isDiffViewActive = true;
    recalculateTotalAndUpdateUI();
}

export function hideDiffView() {
    DOM.diffContainer.classList.add('hidden');
    DOM.unifiedDiffCodeBlock.innerHTML = '';
    isDiffViewActive = false;
    recalculateTotalAndUpdateUI();
}