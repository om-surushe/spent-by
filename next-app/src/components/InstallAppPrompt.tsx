import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('finance-vault-install-dismissed') === '1');

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setInstalled(true);
      return;
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      sessionStorage.removeItem('finance-vault-install-dismissed');
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
    setInstallEvent(null);
  }

  if (installed || dismissed || !installEvent) return null;

  return (
    <aside className="install-prompt" aria-label="Install Finance Vault">
      <div className="install-prompt-icon" aria-hidden="true">↙</div>
      <div className="install-prompt-copy">
        <strong>Install Finance Vault</strong>
        <span>Add it to your home screen for a faster, app-like experience.</span>
      </div>
      <button className="button primary install-action" type="button" onClick={() => void install()}>
        Install
      </button>
      <button
        className="install-dismiss"
        type="button"
        aria-label="Dismiss install prompt"
        onClick={() => {
          sessionStorage.setItem('finance-vault-install-dismissed', '1');
          setDismissed(true);
        }}
      >
        ×
      </button>
    </aside>
  );
}
