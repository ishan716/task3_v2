const request = require('supertest');
const express = require('express');

jest.mock('../middlewares/verifyUser', () => (req, res, next) => {
  req.user = { user_id: 1 };
  next();
});

jest.mock('../db', () => ({
  from: jest.fn(),
}));

const supabase = require('../db');
const eventListRouter = require('../routes/eventlist.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/events', eventListRouter);
  return app;
}

describe('Event list routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('flattens event categories when fetching events', async () => {
    const rawEvents = [
      {
        event_id: 1,
        event_title: 'Summer Fest',
        description: 'Music all day',
        start_time: '2025-06-01T12:00:00Z',
        end_time: '2025-06-01T22:00:00Z',
        location: 'Beach',
        event_categories: [
          { category_id: 'unused', category: { category_id: 'music', category_name: 'Music' } },
          null,
          { category_id: 'unused2', category: null },
          { category_id: 'unused3', category: { category_id: 'food', category_name: 'Food' } },
        ],
      },
      {
        event_id: 2,
        event_title: 'Empty Event',
        description: '',
        start_time: '2025-07-10T12:00:00Z',
        end_time: '2025-07-10T14:00:00Z',
        location: 'Hall',
        event_categories: [],
      },
    ];

    const order = jest.fn().mockResolvedValue({ data: rawEvents, error: null });
    const select = jest.fn().mockReturnValue({ order });
    supabase.from.mockImplementationOnce(() => ({ select }));

    const res = await request(app).get('/api/events').expect(200);

    expect(supabase.from).toHaveBeenCalledWith('events');
    expect(order).toHaveBeenCalledWith('start_time', { ascending: true });
    expect(res.body).toEqual([
      {
        ...rawEvents[0],
        categories: [
          { category_id: 'music', category_name: 'Music' },
          { category_id: 'food', category_name: 'Food' },
        ],
      },
      {
        ...rawEvents[1],
        categories: [],
      },
    ]);
  });

  it('returns 500 when supabase fails', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: new Error('db offline') });
    const select = jest.fn().mockReturnValue({ order });
    supabase.from.mockImplementationOnce(() => ({ select }));

    const res = await request(app).get('/api/events').expect(500);

    expect(res.body).toEqual({ error: 'db offline' });
  });
});

