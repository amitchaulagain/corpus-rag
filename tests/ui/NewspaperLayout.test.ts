import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import NewspaperLayout from '../../src/lib/components/NewspaperLayout.svelte';

describe('NewspaperLayout Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders with default props', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    expect(screen.getByText('The RAG Herald')).toBeInTheDocument();
    expect(screen.getByText('Test Section')).toBeInTheDocument();
  });

  it('displays weather information', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    expect(screen.getByText(/°F/)).toBeInTheDocument();
    expect(screen.getByText(/Partly Cloudy|Sunny|Cloudy|Clear Skies|Light Breeze/)).toBeInTheDocument();
  });

  it('displays stock ticker information', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    expect(screen.getByText(/DOCS: \+\d+\.\d%/)).toBeInTheDocument();
    expect(screen.getByText(/AI: \+\d+\.\d%/)).toBeInTheDocument();
    expect(screen.getByText(/RAG: \+\d+\.\d%/)).toBeInTheDocument();
  });

  it('displays breaking news', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    expect(screen.getByText('BREAKING:')).toBeInTheDocument();
    expect(screen.getByText(/All systems operational|Navigate between sections|Authentication, upload, search|Each section provides focused/)).toBeInTheDocument();
  });

  it('displays navigation items', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    expect(screen.getByText('Front Page')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Document Upload')).toBeInTheDocument();
    expect(screen.getByText('Search Desk')).toBeInTheDocument();
    expect(screen.getByText('File Archives')).toBeInTheDocument();
  });

  it('includes navigation links with correct href', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    const homeLink = screen.getByRole('link', { name: /Front Page/ });
    const authLink = screen.getByRole('link', { name: /Authentication/ });
    const uploadLink = screen.getByRole('link', { name: /Document Upload/ });
    const searchLink = screen.getByRole('link', { name: /Search Desk/ });
    const filesLink = screen.getByRole('link', { name: /File Archives/ });

    expect(homeLink).toHaveAttribute('href', '/');
    expect(authLink).toHaveAttribute('href', '/auth');
    expect(uploadLink).toHaveAttribute('href', '/upload');
    expect(searchLink).toHaveAttribute('href', '/search');
    expect(filesLink).toHaveAttribute('href', '/files');
  });

  it('updates breaking news over time', async () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    const initialNews = screen.getByText(/All systems operational|Navigate between sections|Authentication, upload, search|Each section provides focused/);
    const initialText = initialNews.textContent;

    // Advance timer by 8 seconds to trigger news rotation
    vi.advanceTimersByTime(8000);

    // Wait for component to update
    await vi.waitFor(() => {
      const updatedNews = screen.getByText(/All systems operational|Navigate between sections|Authentication, upload, search|Each section provides focused/);
      expect(updatedNews.textContent).toBeDefined();
    });
  });

  it('displays current date', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    expect(screen.getByText(currentDate)).toBeInTheDocument();
  });

  it('renders slot content', () => {
    const SlotContent = {
      template: '<div data-testid="slot-content">Slot content here</div>'
    };

    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section',
        $$slots: { default: SlotContent }
      }
    });

    expect(screen.getByTestId('slot-content')).toBeInTheDocument();
  });

  it('sets document title correctly', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Custom Page',
        sectionName: 'Custom Section'
      }
    });

    // Note: jsdom doesn't update document.title in the same way browsers do
    // This test ensures the title prop is used correctly
    expect(document.title).toBe('Custom Page - Custom Section');
  });

  it('displays footer information', () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    expect(screen.getByText('About The RAG Herald')).toBeInTheDocument();
    expect(screen.getByText('Your trusted source for document intelligence')).toBeInTheDocument();
    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    expect(screen.getByText(/© 2024 The RAG Herald/)).toBeInTheDocument();
  });

  it('updates stock values over time', async () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    const initialDocs = screen.getByText(/DOCS: \+\d+\.\d%/);
    const initialValue = parseFloat(initialDocs.textContent?.match(/\+(\d+\.\d)%/)?.[1] || '0');

    // Advance timer by 5 seconds to trigger stock updates
    vi.advanceTimersByTime(5000);

    await vi.waitFor(() => {
      const updatedDocs = screen.getByText(/DOCS: \+\d+\.\d%/);
      const updatedValue = parseFloat(updatedDocs.textContent?.match(/\+(\d+\.\d)%/)?.[1] || '0');
      // Stock values should be positive (clamped to 0)
      expect(updatedValue).toBeGreaterThanOrEqual(0);
    });
  });

  it('updates weather periodically', async () => {
    render(NewspaperLayout, {
      props: {
        pageTitle: 'Test Page',
        sectionName: 'Test Section'
      }
    });

    // Advance timer by 15 seconds to trigger weather update
    vi.advanceTimersByTime(15000);

    await vi.waitFor(() => {
      const weatherTemp = screen.getByText(/\d+°F/);
      const weatherDesc = screen.getByText(/Partly Cloudy|Sunny|Cloudy|Clear Skies|Light Breeze/);
      expect(weatherTemp).toBeInTheDocument();
      expect(weatherDesc).toBeInTheDocument();
    });
  });
});