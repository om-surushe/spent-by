import type { Meta, StoryObj } from '@storybook/react-vite';
import { mockVaultMeta } from '../../stories/mockData';
import { UnlockVault } from './UnlockVault';

const meta = {
  title: 'Finance/UnlockVault',
  component: UnlockVault,
  args: {
    vaultMeta: mockVaultMeta,
    draftPhrase: '',
    busy: false,
    onDraftPhraseChange: () => {},
    onUnlock: () => {}
  }
} satisfies Meta<typeof UnlockVault>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } };
