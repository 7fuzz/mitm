import { useEffect, useRef } from 'react';

export type TabType = 'history' | 'intercept' | 'repeater' | 'options' | 'utilities' | 'workspace';

interface ShortcutOptions {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  simpleMode: boolean;
}

/**
 * Keyboard shortcuts handler
 * 1. g-prefix (Gmail/GitHub style): g+h (History), g+i (Intercept), etc.
 * 2. Bracket cycling: [ (Previous Tab), ] (Next Tab)
 */
export function useKeyboardShortcuts({ activeTab, onTabChange, simpleMode }: ShortcutOptions) {
  const waitingForSecondKey = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ignore if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      const isTyping = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        target.closest('.monaco-editor'); 
      
      if (isTyping) return;

      const key = e.key.toLowerCase();

      // --- BRACKET CYCLING ---
      if (!waitingForSecondKey.current && (key === '[' || key === ']')) {
        const tabs: TabType[] = ['history', 'intercept', 'repeater'];
        if (!simpleMode) {
          tabs.push('workspace', 'utilities');
        }
        tabs.push('options');

        const currentIndex = tabs.indexOf(activeTab);
        if (currentIndex === -1) return;

        let nextIndex;
        if (key === '[') {
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else {
          nextIndex = (currentIndex + 1) % tabs.length;
        }

        e.preventDefault();
        onTabChange(tabs[nextIndex]);
        return;
      }

      // --- G-PREFIX ---
      if (!waitingForSecondKey.current) {
        if (key === 'g') {
          waitingForSecondKey.current = true;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            waitingForSecondKey.current = false;
          }, 800);
        }
        return;
      }

      if (waitingForSecondKey.current) {
        let targetTab: TabType | null = null;

        switch (key) {
          case 'h': targetTab = 'history'; break;
          case 'i': targetTab = 'intercept'; break;
          case 'r': targetTab = 'repeater'; break;
          case 'o': targetTab = 'options'; break;
          case 'w': if (!simpleMode) targetTab = 'workspace'; break;
          case 'u': if (!simpleMode) targetTab = 'utilities'; break;
        }

        if (targetTab) {
          e.preventDefault();
          onTabChange(targetTab);
        }

        waitingForSecondKey.current = false;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeTab, onTabChange, simpleMode]);
}
