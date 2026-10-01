import type { Meta, StoryObj } from '@storybook/react-vite';
import { mockTransactions } from '../../stories/mockData';
import { Ledger } from './Ledger';

const meta = {
  title: 'Finance/Ledger',
  component: Ledger,
  args: {
    visibleRecords: mockTransactions,
    search: '',
    month: 'All',
    months: ['2026-09'],
    onSearchChange: () => {},
    onMonthChange: () => {},
    onEdit: () => {},
    onDelete: () => {}
  }
} satisfies Meta<typeof Ledger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { visibleRecords: [] } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } };
