import * as vscode from 'vscode';
import { ApiServiceManager } from '../services/ApiServiceManager';
import { ConversationManager } from './ConversationManager';
import { createGeneralChatPrompt } from '../core/promptBuilder';
import { ChatMessage } from '../types/index';
import { EXTENSION_ID, SETTINGS_KEYS } from '../core/constants';

export class MessageHandler {
    constructor(
        private readonly conversationManager: ConversationManager,
        private readonly apiManager: ApiServiceManager
    ) {}

    /**
     * Hem standart hem de bağlam içeren tüm sohbet isteklerini işleyen ana fonksiyon.
     * @param userMessage Kullanıcının girdiği talimat.
     * @param webview Mesajların gönderileceği webview referansı.
     * @param contexts (İsteğe bağlı) Dosya veya seçili kod bağlamları.
     */
    private async executeChat(userMessage: string, webview: vscode.Webview, contexts?: Array<{ fileName?: string, content: string }>) {
        this.conversationManager.addMessage('user', userMessage);

        try {
            const isContextualChat = contexts && contexts.length > 0;
            let aiResponse: string;

            if (isContextualChat) {
                // Bağlam varsa, tek seferlik bir prompt ile API'ye gidilir.
                const prompt = createGeneralChatPrompt(userMessage, contexts);
                aiResponse = await this.apiManager.generateContent(prompt);
            } else {
                // Bağlam yoksa, standart sohbet geçmişi kullanılır.
                const activeConversation = this.conversationManager.getActive();
                if (!activeConversation) throw new Error("Aktif konuşma bulunamadı.");

                const config = vscode.workspace.getConfiguration(EXTENSION_ID);
                const historyLimit = config.get<number>(SETTINGS_KEYS.conversationHistoryLimit, 2);
                
                const systemPrompt = activeConversation.messages.find(m => m.role === 'system');
                const currentMessages = activeConversation.messages.filter(m => m.role !== 'system');
                const limitedMessages = currentMessages.slice(-(historyLimit * 2 + 1));
                const messagesForApi: ChatMessage[] = systemPrompt ? [systemPrompt, ...limitedMessages] : limitedMessages;
                
                aiResponse = await this.apiManager.generateChatContent(messagesForApi);
            }
            
            this.conversationManager.addMessage('assistant', aiResponse);
            webview.postMessage({ type: 'addResponse', payload: aiResponse });

        } catch (error: any) {
            console.error("Chat API Error:", error);
            this.conversationManager.removeLastMessage();
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.";
            webview.postMessage({ type: 'addResponse', payload: `**Hata:** ${errorMessage}` });
        }
    }

    /**
     * Standart (bağlamsız) bir sohbet mesajını işler.
     */
    public async handleStandardChat(userMessage: string, webview: vscode.Webview) {
        await this.executeChat(userMessage, webview);
    }

    /**
     * Dosya veya seçili kod gibi bir bağlam içeren sohbet mesajını işler.
     */
    public async handleContextualChat(instruction: string, contexts: Array<{ uri: vscode.Uri; content: string; fileName?: string; }>, webview: vscode.Webview) {
        const promptContexts = contexts.map(c => ({ 
            fileName: c.fileName, 
            content: c.content 
        }));
        await this.executeChat(instruction, webview, promptContexts);
    }
}