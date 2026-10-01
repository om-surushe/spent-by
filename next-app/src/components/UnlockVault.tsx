import type { VaultMeta } from '../types';

type Props = {
  vaultMeta: VaultMeta;
  draftPhrase: string;
  busy: boolean;
  onDraftPhraseChange: (value: string) => void;
  onUnlock: () => void;
};

export function UnlockVault({ vaultMeta, draftPhrase, busy, onDraftPhraseChange, onUnlock }: Props) {
  return (
    <section className="card narrow">
      <h2>Unlock vault</h2>
      <p className="subtle">Local data exists for vault <code>{vaultMeta.vaultId.slice(0, 12)}…</code>.</p>
      <textarea rows={5} value={draftPhrase} onChange={(event) => onDraftPhraseChange(event.target.value)} placeholder="paste your 24 words" />
      <button className="button primary" disabled={!draftPhrase.trim() || busy} onClick={onUnlock}>Unlock</button>
    </section>
  );
}
