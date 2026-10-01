import type { Meta, StoryObj } from '@storybook/react-vite';
import { mockVaultMeta } from '../../stories/mockData';
import { DashboardSidebar } from './DashboardSidebar';

const meta = {
  title: 'Finance/DashboardSidebar',
  component: DashboardSidebar,
  args: {
    vaultMeta: mockVaultMeta,
    activeCount: 12,
    totalSpent: 28450,
    categoryTotals: { Needs: 18000, Wants: 4450, Family: 5000, Miscellaneous: 1000 },
    budgets: { Needs: 25000, Wants: 8000, Family: 10000, Miscellaneous: 5000 },
    budgetDraft: { Needs: 25000, Wants: 8000, Family: 10000, Miscellaneous: 5000 },
    busy: false,
    onBudgetDraftChange: () => {},
    onSaveBudgets: (event) => event.preventDefault(),
    onCreateCloudVault: () => {},
    onSyncNow: () => {},
    onPullCloud: () => {}
  }
} satisfies Meta<typeof DashboardSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } };
