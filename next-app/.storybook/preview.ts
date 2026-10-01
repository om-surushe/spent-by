import type { Preview } from '@storybook/react-vite';
import '../src/styles/index.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    viewport: {
      viewports: {
        mobile: { name: 'Mobile 390px', styles: { width: '390px', height: '844px' } },
        tablet: { name: 'Tablet 768px', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop 1440px', styles: { width: '1440px', height: '1000px' } }
      }
    }
  },
  tags: ['autodocs']
};

export default preview;
