import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWindowsStore } from '../store/useWindowsStore';
import { initPopoutSync } from '../lib/popoutManager';

interface PopoutPortalProps {
  windowId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const PopoutPortal: React.FC<PopoutPortalProps> = ({
  windowId,
  title,
  onClose,
  children,
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const popupRef = useRef<Window | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Atualiza título imperativamente sem recriar a janela popup
  useEffect(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.document.title = `${title} — Nebula Workspace`;
    }
  }, [title]);

  useEffect(() => {
    initPopoutSync();

    // Open a new browser window
    const popup = window.open(
      '',
      `nebula-popout-${windowId}`,
      'width=960,height=680,menubar=no,toolbar=no,location=no,status=no'
    );

    if (!popup) {
      alert('Pop-up bloqueado pelo navegador. Por favor, permita pop-ups para usar a janela destacada.');
      onCloseRef.current();
      return;
    }

    popupRef.current = popup;
    popup.document.title = `${title} — Nebula Workspace`;

    // Copy all style sheets and style elements from parent window
    const copyStyles = () => {
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
        popup.document.head.appendChild(el.cloneNode(true));
      });

      // Background & dark styling
      popup.document.body.style.margin = '0';
      popup.document.body.style.padding = '0';
      popup.document.body.style.background = '#050d1a';
      popup.document.body.style.color = '#e6f0ff';
      popup.document.body.style.overflow = 'hidden';
      popup.document.body.style.fontFamily = 'Inter, system-ui, sans-serif';
    };

    copyStyles();

    // Sincronização dinâmica de novos estilos e fontes com MutationObserver
    const styleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node.nodeName === 'STYLE' ||
              (node.nodeName === 'LINK' && (node as HTMLLinkElement).rel === 'stylesheet'))
          ) {
            try {
              popup.document.head.appendChild(node.cloneNode(true));
            } catch {
              // Janela pode ter sido fechada
            }
          }
        });
      }
    });

    styleObserver.observe(document.head, { childList: true, subtree: true });

    // Create mount root inside popup document
    const mountEl = popup.document.createElement('div');
    mountEl.id = `nebula-popout-mount-${windowId}`;
    mountEl.style.width = '100vw';
    mountEl.style.height = '100vh';
    mountEl.style.display = 'flex';
    mountEl.style.flexDirection = 'column';
    mountEl.style.background = '#091326';
    popup.document.body.appendChild(mountEl);
    setContainer(mountEl);

    // Close handler
    const handleUnload = () => {
      onCloseRef.current();
      useWindowsStore.getState().markPopped(windowId, false);
    };

    popup.addEventListener('beforeunload', handleUnload);

    return () => {
      styleObserver.disconnect();
      popup.removeEventListener('beforeunload', handleUnload);
      if (!popup.closed) {
        popup.close();
      }
      setContainer(null);
    };
  }, [windowId]);

  if (!container) return null;

  return createPortal(children, container);
};
