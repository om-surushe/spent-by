import type { Meta, StoryObj } from '@storybook/react-vite';
import { VaultSetup } from './VaultSetup';

const meta = {
  title: 'Finance/VaultSetup',
  component: VaultSetup,
  args: {
    draftPhrase: '',
    generatedPhrase: '',
    savedPhrase: false,
    busy: false,
    onDraftPhraseChange: () => {},
    onGeneratePhrase: () => {},
    onSavedPhraseChange: () => {},
    onCreateVault: () => {},
    onRecoverFromCloud: () => {}
  }
} satisfies Meta<typeof VaultSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const GeneratedPhrase: Story = {
  args: {
    generatedPhrase: 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray'
  }
};
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } };
