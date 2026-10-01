import './VaultSetup.css';

type VaultSetupProps = {
  draftPhrase: string;
  generatedPhrase: string;
  savedPhrase: boolean;
  busy: boolean;
  onDraftPhraseChange: (value: string) => void;
  onGeneratePhrase: () => void;
  onSavedPhraseChange: (value: boolean) => void;
  onCreateVault: () => void;
  onRecoverFromCloud: () => void;
};

export function VaultSetup({
  draftPhrase,
  generatedPhrase,
  savedPhrase,
  busy,
  onDraftPhraseChange,
  onGeneratePhrase,
  onSavedPhraseChange,
  onCreateVault,
  onRecoverFromCloud
}: VaultSetupProps) {
  return (
    <section className="vault-setup">
      <article className="card">
        <h2>Create new vault</h2>
        <p className="subtle">Generate one recovery phrase for encryption, sync, and recovery. We cannot reset it.</p>
        <button className="button" onClick={onGeneratePhrase}>Generate phrase</button>
        {generatedPhrase ? (
          <>
            <div className="phrase-box">{generatedPhrase}</div>
            <label className="check">
              <input type="checkbox" checked={savedPhrase} onChange={(event) => onSavedPhraseChange(event.target.checked)} />
              I saved these 24 words.
            </label>
            <button className="button primary" disabled={!savedPhrase || busy} onClick={onCreateVault}>Create vault</button>
          </>
        ) : null}
      </article>

      <article className="card">
        <h2>Recover existing cloud vault</h2>
        <p className="subtle">Use this on a fresh browser or device to restore your encrypted transactions and private settings.</p>
        <textarea rows={5} value={draftPhrase} onChange={(event) => onDraftPhraseChange(event.target.value)} placeholder="paste your 24 words" />
        <div className="actions top-gap">
          <button className="button primary" disabled={!draftPhrase.trim() || busy} onClick={onRecoverFromCloud}>Recover from cloud</button>
        </div>
      </article>
    </section>
  );
}
