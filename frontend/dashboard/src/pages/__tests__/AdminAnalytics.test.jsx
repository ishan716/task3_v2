import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider } from '../../theme/ThemeProvider.jsx';
import AdminAnalytics from '../AdminAnalytics.jsx';

vi.mock('../../api', () => ({
  API: 'https://example.test',
  apiGet: vi.fn(),
}));

import { API, apiGet } from '../../api';

function renderAnalytics() {
  return render(
    <MemoryRouter initialEntries={['/admin/analytics']}>
      <ThemeProvider>
        <AdminAnalytics />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('AdminAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders analytics summary once data loads', async () => {
    const analyticsResponse = {
      filters: {
        start: '2024-01-01T00:00:00.000Z',
        end: '2024-06-01T00:00:00.000Z',
        categories: [1, 2],
      },
      summary: {
        totalEvents: 42,
        totalInterested: 200,
        averageInterest: 4.7,
      },
      statusBreakdown: {
        Upcoming: 10,
        Ongoing: 3,
        Past: 29,
        Unknown: 0,
      },
      categories: [{ category: 'Technology', count: 12 }],
      topEvents: [
        {
          event_id: 9,
          event_title: 'Innovation Day',
          start_time: '2024-03-12T14:00:00.000Z',
          end_time: '2024-03-12T16:00:00.000Z',
          status: 'Upcoming',
          interested_count: 58,
        },
      ],
      timeline: [
        {
          month: '2024-01',
          eventCount: 6,
          interestedCount: 24,
        },
      ],
    };

    const categoryResponse = [
      { category_id: 1, category_name: 'Technology' },
      { category_id: 2, category_name: 'Sports' },
    ];

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/interests/categories') {
        return categoryResponse;
      }
      if (path.startsWith('/api/admin/analytics')) {
        expect(path).toContain('start=');
        expect(path).toContain('end=');
        return analyticsResponse;
      }
      throw new Error(`Unhandled path ${path}`);
    });

    renderAnalytics();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('/api/admin/analytics'));
    });

    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('4.7')).toBeInTheDocument();

    const statusCard = screen.getByText('Event Status Breakdown').closest('section');
    expect(statusCard).not.toBeNull();
    const statusScope = within(statusCard);
    expect(statusScope.getByText('Upcoming')).toBeInTheDocument();
    expect(statusScope.getByText('10')).toBeInTheDocument();

    expect(
      screen.getByText((content) => content.includes('Categories:') && content.includes('Technology') && content.includes('Sports'))
    ).toBeInTheDocument();
  });

  it('shows a validation error when start date is after end date', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/interests/categories') {
        return [];
      }
      if (path.startsWith('/api/admin/analytics')) {
        return {
          filters: {
            start: '2024-02-01T00:00:00.000Z',
            end: '2024-02-28T00:00:00.000Z',
            categories: [],
          },
          summary: { totalEvents: 0, totalInterested: 0, averageInterest: 0 },
          statusBreakdown: { Upcoming: 0, Ongoing: 0, Past: 0, Unknown: 0 },
          categories: [],
          topEvents: [],
          timeline: [],
        };
      }
      throw new Error(`Unhandled path ${path}`);
    });

    const user = userEvent.setup();
    renderAnalytics();

    const startLabel = await screen.findByText('Start Date');
    const endLabel = screen.getByText('End Date');
    const startInput = startLabel.parentElement?.querySelector('input');
    const endInput = endLabel.parentElement?.querySelector('input');

    if (!startInput || !endInput) {
      throw new Error('Expected date inputs to be present');
    }

    await user.clear(startInput);
    await user.type(startInput, '2024-06-10');
    await user.clear(endInput);
    await user.type(endInput, '2024-06-01');

    await user.click(screen.getByRole('button', { name: 'Apply Filters' }));

    expect(await screen.findByText('Start date must be before end date.')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it('exports analytics with applied filters and auth header', async () => {
    const analyticsResponse = {
      filters: {
        start: '2024-01-01T00:00:00.000Z',
        end: '2024-02-28T00:00:00.000Z',
        categories: [1, 2],
      },
      summary: { totalEvents: 5, totalInterested: 12, averageInterest: 2.4 },
      statusBreakdown: { Upcoming: 2, Ongoing: 1, Past: 2, Unknown: 0 },
      categories: [],
      topEvents: [],
      timeline: [],
    };

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/interests/categories') {
        return [
          { category_id: 1, category_name: 'Technology' },
          { category_id: 2, category_name: 'Sports' },
        ];
      }
      if (path.startsWith('/api/admin/analytics')) {
        return analyticsResponse;
      }
      throw new Error(`Unhandled path ${path}`);
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['id,total'])),
    });
    global.fetch = fetchMock;
    window.URL.createObjectURL = vi.fn(() => 'blob://analytics');
    window.URL.revokeObjectURL = vi.fn();

    window.localStorage.setItem('accessToken', 'sample-token');

    const user = userEvent.setup();
    renderAnalytics();

    const exportButton = await screen.findByRole('button', { name: 'Export CSV' });
    expect(exportButton).toBeEnabled();

    await user.click(exportButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe(
      `${API}/api/admin/analytics?start=2024-01-01&end=2024-02-28&categories=1%2C2&format=csv`
    );
    expect(requestInit).toMatchObject({
      credentials: 'include',
      headers: {
        Authorization: 'Bearer sample-token',
      },
    });

    expect(window.URL.createObjectURL).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled()
    );
  });
});
