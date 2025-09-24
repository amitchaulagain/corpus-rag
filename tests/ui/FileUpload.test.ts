import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FileUpload from '../../src/lib/components/FileUpload.svelte';

// Mock fetch
global.fetch = vi.fn();

describe('FileUpload Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Mock successful upload by default
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { filename: 'test-file.txt', size: 1234 }
      })
    });
  });

  it('renders upload zone', () => {
    render(FileUpload);

    expect(screen.getByText(/Drop files here|Upload files|Select files/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Browse|Select Files|Choose Files/ })).toBeInTheDocument();
  });

  it('handles file selection via button click', async () => {
    render(FileUpload);

    const fileInput = screen.getByRole('button', { name: /Browse|Select Files|Choose Files/ });

    // Create a mock file
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    // Mock the file input change event
    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('handles drag and drop', async () => {
    const { component } = render(FileUpload);

    const uploadZone = screen.getByText(/Drop files here|Upload files|Select files/).closest('div');

    const file = new File(['test content'], 'dropped-file.txt', { type: 'text/plain' });

    // Mock drag enter
    await fireEvent.dragEnter(uploadZone!, {
      dataTransfer: {
        files: [file],
        types: ['Files'],
      },
    });

    // Mock drop
    await fireEvent.drop(uploadZone!, {
      dataTransfer: {
        files: [file],
        types: ['Files'],
      },
    });

    expect(screen.getByText('dropped-file.txt')).toBeInTheDocument();
  });

  it('shows drag over state', async () => {
    render(FileUpload);

    const uploadZone = screen.getByText(/Drop files here|Upload files|Select files/).closest('div');

    await fireEvent.dragEnter(uploadZone!, {
      dataTransfer: {
        types: ['Files'],
      },
    });

    // Should add visual feedback (class change, style change, etc.)
    expect(uploadZone).toHaveClass(/drag-over|dragging|active/);
  });

  it('removes drag over state on drag leave', async () => {
    render(FileUpload);

    const uploadZone = screen.getByText(/Drop files here|Upload files|Select files/).closest('div');

    // Drag enter first
    await fireEvent.dragEnter(uploadZone!, {
      dataTransfer: {
        types: ['Files'],
      },
    });

    // Then drag leave
    await fireEvent.dragLeave(uploadZone!);

    expect(uploadZone).not.toHaveClass(/drag-over|dragging|active/);
  });

  it('uploads files successfully', async () => {
    const { component } = render(FileUpload);

    // Listen for upload events
    const uploadProgressEvent = vi.fn();
    const uploadCompleteEvent = vi.fn();
    component.$on('uploadProgress', uploadProgressEvent);
    component.$on('uploadComplete', uploadCompleteEvent);

    const file = new File(['test content'], 'upload-test.txt', { type: 'text/plain' });

    // Add file to component
    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    // Find and click upload button
    const uploadButton = screen.getByRole('button', { name: /Upload|Submit/ });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    // Should emit upload complete event
    expect(uploadCompleteEvent).toHaveBeenCalled();
  });

  it('handles upload errors', async () => {
    // Mock failed upload
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({
        success: false,
        error: 'Upload failed'
      })
    });

    const { component } = render(FileUpload);

    const uploadErrorEvent = vi.fn();
    component.$on('uploadError', uploadErrorEvent);

    const file = new File(['test content'], 'error-test.txt', { type: 'text/plain' });

    // Add file and attempt upload
    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    const uploadButton = screen.getByRole('button', { name: /Upload|Submit/ });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(uploadErrorEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            error: expect.any(String),
          }),
        })
      );
    });
  });

  it('validates file types', async () => {
    render(FileUpload, {
      props: {
        acceptedTypes: ['.txt', '.pdf']
      }
    });

    const invalidFile = new File(['content'], 'test.exe', { type: 'application/exe' });

    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [invalidFile],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    expect(screen.getByText(/Invalid file type|File type not supported/)).toBeInTheDocument();
  });

  it('validates file size limits', async () => {
    render(FileUpload, {
      props: {
        maxFileSize: 1024 // 1KB limit
      }
    });

    // Create a large file (2KB)
    const largeContent = 'x'.repeat(2048);
    const largeFile = new File([largeContent], 'large.txt', { type: 'text/plain' });

    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [largeFile],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    expect(screen.getByText(/File too large|Size limit exceeded/)).toBeInTheDocument();
  });

  it('handles multiple file selection', async () => {
    render(FileUpload, {
      props: {
        multiple: true
      }
    });

    const file1 = new File(['content 1'], 'file1.txt', { type: 'text/plain' });
    const file2 = new File(['content 2'], 'file2.txt', { type: 'text/plain' });

    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file1, file2],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    expect(screen.getByText('file1.txt')).toBeInTheDocument();
    expect(screen.getByText('file2.txt')).toBeInTheDocument();
  });

  it('allows removing selected files', async () => {
    render(FileUpload);

    const file = new File(['test content'], 'removable.txt', { type: 'text/plain' });

    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    expect(screen.getByText('removable.txt')).toBeInTheDocument();

    // Find and click remove button
    const removeButton = screen.getByRole('button', { name: /Remove|Delete|×/ });
    await user.click(removeButton);

    expect(screen.queryByText('removable.txt')).not.toBeInTheDocument();
  });

  it('shows upload progress', async () => {
    render(FileUpload);

    const file = new File(['test content'], 'progress-test.txt', { type: 'text/plain' });

    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    const uploadButton = screen.getByRole('button', { name: /Upload|Submit/ });
    await user.click(uploadButton);

    // Should show progress indicator
    expect(screen.getByText(/Uploading|Progress|%/)).toBeInTheDocument();
  });

  it('displays file information', async () => {
    render(FileUpload);

    const file = new File(['test content'], 'info-test.txt', { type: 'text/plain' });

    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    expect(screen.getByText('info-test.txt')).toBeInTheDocument();
    expect(screen.getByText(/\d+\s*(B|KB|MB)/)).toBeInTheDocument(); // File size
  });

  it('handles network errors during upload', async () => {
    // Mock network error
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const { component } = render(FileUpload);

    const uploadErrorEvent = vi.fn();
    component.$on('uploadError', uploadErrorEvent);

    const file = new File(['test content'], 'network-error.txt', { type: 'text/plain' });

    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    const uploadButton = screen.getByRole('button', { name: /Upload|Submit/ });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(uploadErrorEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            error: expect.stringContaining('Network error'),
          }),
        })
      );
    });
  });

  it('disables upload button when no files selected', () => {
    render(FileUpload);

    const uploadButton = screen.getByRole('button', { name: /Upload|Submit/ });
    expect(uploadButton).toBeDisabled();
  });

  it('enables upload button when files are selected', async () => {
    render(FileUpload);

    const file = new File(['test content'], 'enable-test.txt', { type: 'text/plain' });

    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'files', {
        value: [file],
        writable: false,
      });

      await fireEvent.change(inputElement);
    }

    const uploadButton = screen.getByRole('button', { name: /Upload|Submit/ });
    expect(uploadButton).not.toBeDisabled();
  });
});