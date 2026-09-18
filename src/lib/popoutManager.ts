/**
 * popoutManager.ts — v2.6
 * 
 * Gerenciador de janelas pop-out (browser windows) para o Nebula Workspace.
 * 
 * Como funciona:
 * 1. Uma janela Nebula é "destacada" via window.open().
 * 2. A nova aba recebe os estilos injetados dinamicamente (CSS do documento principal).
 * 3. Estado sincronizado bidirecionalmente via BroadcastChannel.
 * 4. O componente React é renderizado via createPortal no documento da nova janela.
 */

import { useWindowsStore } from '../store/useWindowsStore';

const CHANNEL_NAME = 'nebula-state-sync';
let channel: BroadcastChannel | null = null;

export interface PopoutMessage {
  type: 'WINDOW_STATE' | 'CLOSE_POPOUT' | 'PING';
  windowId?: string;
  payload?: unknown;
}

/**
 * Inicializa o BroadcastChannel para sincronização de estado bidirecional.
 * Deve ser chamado uma vez na inicialização do app.
 */
export function initPopoutSync() {
  if (typeof BroadcastChannel === 'undefined') return;
  if (channel) return;

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<PopoutMessage>) => {
    const msg = event.data;
    if (msg.type === 'CLOSE_POPOUT' && msg.windowId) {
      // Pop-out fechado — marcar como não-popped na janela principal
      useWindowsStore.getState().markPopped(msg.windowId, false);
    }
  };
}

/**
 * Injeta todos os estilos do documento principal (tags <style> e <link rel="stylesheet">)
 * no <head> da janela pop-out. Necessário para que Tailwind CSS funcione na nova aba.
 */
function injectStylesIntoWindow(targetWin: Window) {
  const sourceStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
  sourceStyles.forEach((node) => {
    targetWin.document.head.appendChild(node.cloneNode(true));
  });

  // Também define o tema escuro no body
  targetWin.document.body.style.background = '#050d1a';
  targetWin.document.body.style.color = '#e6f0ff';
  targetWin.document.body.style.margin = '0';
  targetWin.document.body.style.padding = '0';
  targetWin.document.body.style.fontFamily = 'Inter, system-ui, sans-serif';
}

/**
 * Abre uma janela Nebula em uma nova aba do browser.
 * Retorna a nova instância de Window, ou null se bloqueada pelo browser.
 */
export function openPopout(windowId: string, windowType: string): Window | null {
  const url = new URL(globalThis.location.href);
  url.searchParams.set('nebula_popout', windowId);
  url.searchParams.set('nebula_type', windowType);

  const popoutWin = globalThis.open(
    url.toString(),
    `nebula-popout-${windowId}`,
    'width=960,height=700,menubar=no,toolbar=no,location=no,status=no'
  );

  if (!popoutWin) {
    console.warn('[Nebula PopOut] Bloqueado pelo browser. Certifique-se de que pop-ups estão permitidos para este site.');
    return null;
  }

  // Aguardar carregamento e injetar estilos
  popoutWin.addEventListener('load', () => {
    injectStylesIntoWindow(popoutWin);
  });

  // Quando a aba pop-out fechar, notificar a janela principal
  popoutWin.addEventListener('beforeunload', () => {
    if (channel) {
      channel.postMessage({ type: 'CLOSE_POPOUT', windowId } as PopoutMessage);
    }
    useWindowsStore.getState().markPopped(windowId, false);
  });

  return popoutWin;
}

/**
 * Fecha o BroadcastChannel de sincronização (cleanup).
 */
export function destroyPopoutSync() {
  channel?.close();
  channel = null;
}

/**
 * Verifica se a página atual é uma janela pop-out
 * (detecta o parâmetro ?nebula_popout= na URL).
 */
export function getPopoutParams(): { windowId: string; windowType: string } | null {
  const params = new URLSearchParams(globalThis.location.search);
  const windowId = params.get('nebula_popout');
  const windowType = params.get('nebula_type');
  if (windowId && windowType) return { windowId, windowType };
  return null;
}
