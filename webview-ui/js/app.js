/* ==========================================================================
   ANA UYGULAMA GİRİŞ NOKTASI (app.js)
   Tüm modülleri başlatır ve uygulamayı çalıştırır.
   ========================================================================== */

import { configureLibraries } from './config.js';
import * as UI from './ui.js';
import * as DOM from './dom.js';
import { initSettings } from './components/settings.js';
import { initHistory } from './components/history.js';
import { initEventHandlers, initMessageListener } from './handlers.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("İvme Chat UI Başlatılıyor...");
    
    configureLibraries();
    
    // UI'ı başlat (toggle durumunu ayarlar)
    UI.initUI();
    
    initSettings();
    initHistory();
    initEventHandlers();
    initMessageListener();

    // YENİ: Efekt değiştirme anahtarı için olay dinleyicisi
    DOM.effectToggleSwitch.addEventListener('change', () => {
        UI.toggleAnimationEffect();
    });

    console.log("İvme Chat UI Hazır.");
});