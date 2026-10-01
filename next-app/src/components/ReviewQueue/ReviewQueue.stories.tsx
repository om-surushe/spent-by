import type { Meta, StoryObj } from '@storybook/react-vite';
import { mockTransactions } from '../../stories/mockData';
import { ReviewQueue } from './ReviewQueue';

const meta = {
  title: 'Finance/ReviewQueue',
  component: ReviewQueue,
  args: {
    records: mockTransactions,
    busy: false,
    onEdit: () => {},
    onMarkReviewed: () => {}
  }
} satisfies Meta<typeof ReviewQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithFlaggedTransactions: Story = {};
export const Empty: Story = { args: { records: mockTransactions.filter((record) => !record.data.needsReview) } };
