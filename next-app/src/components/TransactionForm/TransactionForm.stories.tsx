import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EMPTY_TRANSACTION } from '../../constants';
import type { TransactionData } from '../../types';
import { TransactionForm } from './TransactionForm';

function StoryHarness() {
  const [form, setForm] = useState<TransactionData>({ ...EMPTY_TRANSACTION, amount: 500, reason: 'Lunch' });
  return (
    <TransactionForm
      form={form}
      editingId={null}
      busy={false}
      showImport={false}
      importText=""
      onFormChange={setForm}
      onSubmit={(event) => event.preventDefault()}
      onCancelEdit={() => {}}
      onToggleImport={() => {}}
      onExportTransactions={() => {}}
      onExportBackup={() => {}}
      onImportTextChange={() => {}}
      onImportTransactions={() => {}}
      onCopyImportPrompt={() => {}}
      onLockVault={() => {}}
    />
  );
}

const meta = {
  title: 'Finance/TransactionForm',
  component: TransactionForm,
  render: () => <StoryHarness />
} satisfies Meta<typeof TransactionForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } };
