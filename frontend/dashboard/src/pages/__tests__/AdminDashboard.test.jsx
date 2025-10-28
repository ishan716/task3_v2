import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider } from '../../theme/ThemeProvider.jsx';
import AdminDashboard from '../AdminDashboard.jsx';

vi.mock('../../api', () => ({
  apiGet: vi.fn(),
  apiJSON: vi.fn(),
  apiDelete: vi.fn(),
}));

import { apiDelete, apiGet, apiJSON } from '../../api';

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <ThemeProvider>
        <AdminDashboard />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('AdminDashboard', () => {
  it('loads events and categories on mount', async () => {
    const now = Date.now();

    const sampleEvent = {
      event_id: 1,
      event_title: 'Campus Hackathon',
      description: '24 hour build',
      location: 'Main Hall',
      start_time: new Date(now + 60 * 60 * 1000).toISOString(),
      end_time: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      categories: [{ category_id: 5, category_name: 'Technology' }],
      interested_count: 12,
    };

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/admin/events') {
        return { items: [sampleEvent] };
      }
      if (path === '/api/interests/categories') {
        return [{ category_id: 5, category_name: 'Technology' }];
      }
      throw new Error(`Unhandled GET path: ${path}`);
    });

    renderDashboard();

    const eventCell = await screen.findByText('Campus Hackathon');
    expect(eventCell).toBeInTheDocument();

    const eventRow = eventCell.closest('tr');
    expect(eventRow).not.toBeNull();
    const rowScope = within(eventRow);
    expect(rowScope.getByText('Upcoming')).toBeInTheDocument();
    expect(rowScope.getByText('Technology')).toBeInTheDocument();

    expect(
      screen.getByRole('checkbox', { name: 'Technology' })
    ).toBeInTheDocument();

    expect(apiGet).toHaveBeenCalledWith('/api/admin/events');
    expect(apiGet).toHaveBeenCalledWith('/api/interests/categories');
  });

  it('shows an error message when events fail to load', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/admin/events') {
        throw new Error('Network error');
      }
      if (path === '/api/interests/categories') {
        return [];
      }
      throw new Error(`Unhandled GET path: ${path}`);
    });

    renderDashboard();

    expect(
      await screen.findByText('Failed to load events.')
    ).toBeInTheDocument();
  });

  it('submits a new event and reloads the events list', async () => {
    const user = userEvent.setup();

    const eventsResponses = [
      { items: [] },
      {
        items: [
          {
            event_id: 10,
            event_title: 'Club Fair',
            description: 'Welcome to campus',
            location: 'Atrium',
            start_time: '2024-06-01T15:00:00.000Z',
            end_time: '2024-06-01T18:00:00.000Z',
            categories: [{ category_id: 1, category_name: 'Orientation' }],
            interested_count: 4,
          },
        ],
      },
    ];

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/admin/events') {
        return eventsResponses.shift() ?? { items: [] };
      }
      if (path === '/api/interests/categories') {
        return [
          { category_id: 1, category_name: 'Orientation' },
          { category_id: 2, category_name: 'Sports' },
        ];
      }
      throw new Error(`Unhandled GET path: ${path}`);
    });

    apiJSON.mockResolvedValue({ success: true });

    renderDashboard();

    const titleInput = await screen.findByLabelText('Event Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Club Fair');

    await user.type(screen.getByLabelText('Description'), 'Welcome to campus');
    await user.type(screen.getByLabelText('Location'), 'Atrium');

    await user.type(screen.getByLabelText('Start Time'), '2024-06-01T10:00');
    await user.type(screen.getByLabelText('End Time'), '2024-06-01T13:00');

    await user.click(screen.getByLabelText('Orientation'));

    await user.click(screen.getByRole('button', { name: 'Create Event' }));

    await waitFor(() =>
      expect(apiJSON).toHaveBeenCalledWith(
        'POST',
        '/api/admin/events',
        expect.objectContaining({
          event_title: 'Club Fair',
          description: 'Welcome to campus',
          location: 'Atrium',
          categories: ['1'],
          start_time: expect.any(String),
          end_time: expect.any(String),
        })
      )
    );

    expect(apiGet).toHaveBeenCalledWith('/api/admin/events');

    expect(await screen.findByText('Club Fair')).toBeInTheDocument();
  });

  it('populates the form when editing an event', async () => {
    const sampleEvent = {
      event_id: 7,
      event_title: 'Leadership Workshop',
      description: 'Grow your skills',
      location: 'Room 201',
      start_time: '2024-03-10T14:00:00.000Z',
      end_time: '2024-03-10T16:00:00.000Z',
      categories: [{ category_id: 3, category_name: 'Development' }],
      interested_count: 20,
    };

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/admin/events') {
        return { items: [sampleEvent] };
      }
      if (path === '/api/interests/categories') {
        return [{ category_id: 3, category_name: 'Development' }];
      }
      throw new Error(`Unhandled GET path: ${path}`);
    });

    renderDashboard();

    const editButton = await screen.findByRole('button', { name: 'Edit' });
    await userEvent.click(editButton);

    await waitFor(() =>
      expect(screen.getByLabelText('Event Title')).toHaveValue(
        'Leadership Workshop'
      )
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Description')).toHaveValue(
        'Grow your skills'
      )
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Location')).toHaveValue('Room 201')
    );

    const startInput = await screen.findByLabelText('Start Time');
    const expectedStart = (() => {
      const date = new Date(sampleEvent.start_time);
      const offset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - offset * 60000);
      return local.toISOString().slice(0, 16);
    })();

    await waitFor(() => expect(startInput).toHaveValue(expectedStart));
    await waitFor(() =>
      expect(screen.getByLabelText('Development')).toBeChecked()
    );
  });

  it('asks for confirmation before deleting an event', async () => {
    const user = userEvent.setup();
    const sampleEvent = {
      event_id: 2,
      event_title: 'Budget Review',
      start_time: '2024-05-01T10:00:00.000Z',
      end_time: '2024-05-01T11:00:00.000Z',
      categories: [],
      interested_count: 6,
    };

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/admin/events') {
        return { items: [sampleEvent] };
      }
      if (path === '/api/interests/categories') {
        return [];
      }
      throw new Error(`Unhandled GET path: ${path}`);
    });

    apiDelete.mockResolvedValue({ deleted: true });

    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementation(() => true);

    renderDashboard();

    const deleteButton = await screen.findByRole('button', { name: 'Delete' });
    await user.click(deleteButton);

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith('/api/admin/events/2')
    );

    confirmSpy.mockRestore();
  });
});
