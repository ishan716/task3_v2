const request = require('supertest');
const express = require('express');

jest.mock('../db', () => ({
  from: jest.fn(),
}));

jest.mock('../middlewares/verifyUser', () => {
  const middleware = (req, _res, next) => {
    if (middleware.currentUser) {
      req.user = middleware.currentUser;
    }
    next();
  };
  middleware.currentUser = { user_id: 'user-1' };
  middleware.setUser = (user) => {
    middleware.currentUser = user;
  };
  return middleware;
});

const supabase = require('../db');
const verifyUser = require('../middlewares/verifyUser');
const interestsRouter = require('../routes/interests.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', interestsRouter);
  return app;
}

describe('Interests recommended events', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    supabase.from.mockReset();
    verifyUser.setUser({ user_id: 'user-1' });
    app = createApp();
  });

  it('returns recommended events enriched with categories based on user interests', async () => {
    const myInterestsEq = jest.fn().mockResolvedValue({
      data: [{ category_id: 'music' }, { category_id: 'tech' }],
      error: null,
    });
    const myInterestsSelect = jest.fn().mockReturnValue({ eq: myInterestsEq });

    const mapSelect = jest.fn().mockResolvedValue({
      data: [
        { event_id: 1, category_id: 'music' },
        { event_id: 1, category_id: 'art' },
        { event_id: 2, category_id: 'tech' },
        { event_id: 3, category_id: 'food' },
      ],
      error: null,
    });

    const eventsOrder = jest.fn().mockResolvedValue({
      data: [
        {
          event_id: 1,
          event_title: 'Jazz Night',
          start_time: '2025-04-01T18:00:00Z',
          end_time: '2025-04-01T21:00:00Z',
          description: 'Smooth jazz evening',
          location: 'Main Hall',
        },
        {
          event_id: 2,
          event_title: 'Tech Expo',
          start_time: '2025-05-10T10:00:00Z',
          end_time: '2025-05-10T16:00:00Z',
          description: 'Latest gadgets showcase',
          location: 'Convention Center',
        },
      ],
      error: null,
    });
    const eventsIn = jest.fn().mockReturnValue({ order: eventsOrder });
    const eventsSelect = jest.fn().mockReturnValue({ in: eventsIn });

    const categoriesIn = jest.fn().mockResolvedValue({
      data: [
        { category_id: 'music', category_name: 'Music' },
        { category_id: 'art', category_name: 'Art' },
        { category_id: 'tech', category_name: 'Technology' },
      ],
      error: null,
    });
    const categoriesSelect = jest.fn().mockReturnValue({ in: categoriesIn });

    supabase.from
      .mockImplementationOnce(() => ({ select: myInterestsSelect }))
      .mockImplementationOnce(() => ({ select: mapSelect }))
      .mockImplementationOnce(() => ({ select: eventsSelect }))
      .mockImplementationOnce(() => ({ select: categoriesSelect }));

    const res = await request(app).get('/api/events/recommended').expect(200);

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'interested_category');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'event_categories');
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'events');
    expect(supabase.from).toHaveBeenNthCalledWith(4, 'categories');

    expect(res.body).toEqual({
      items: [
        {
          event_id: 1,
          event_title: 'Jazz Night',
          start_time: '2025-04-01T18:00:00Z',
          end_time: '2025-04-01T21:00:00Z',
          description: 'Smooth jazz evening',
          location: 'Main Hall',
          categories: [
            { category_id: 'music', category_name: 'Music' },
            { category_id: 'art', category_name: 'Art' },
          ],
        },
        {
          event_id: 2,
          event_title: 'Tech Expo',
          start_time: '2025-05-10T10:00:00Z',
          end_time: '2025-05-10T16:00:00Z',
          description: 'Latest gadgets showcase',
          location: 'Convention Center',
          categories: [
            { category_id: 'tech', category_name: 'Technology' },
          ],
        },
      ],
      total: 2,
    });
  });

  it('short-circuits when the user has no saved interests', async () => {
    const myInterestsEq = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const myInterestsSelect = jest.fn().mockReturnValue({ eq: myInterestsEq });
    supabase.from.mockImplementationOnce(() => ({ select: myInterestsSelect }));

    const res = await request(app).get('/api/events/recommended').expect(200);

    expect(res.body).toEqual({ items: [], total: 0 });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('requires authentication for recommended events', async () => {
    verifyUser.setUser(null);

    const res = await request(app).get('/api/events/recommended').expect(401);

    expect(res.body).toEqual({ error: 'Authentication required' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('updates recommended events when interests change', async () => {
    // First call: interests = ['music'] -> recommends event 1
    const interestsEqA = jest.fn().mockResolvedValue({
      data: [{ category_id: 'music' }],
      error: null,
    });
    const interestsSelectA = jest.fn().mockReturnValue({ eq: interestsEqA });

    const mapSelectA = jest.fn().mockResolvedValue({
      data: [{ event_id: 1, category_id: 'music' }],
      error: null,
    });

    const eventsOrderA = jest.fn().mockResolvedValue({
      data: [
        {
          event_id: 1,
          event_title: 'Jazz Night',
          start_time: '2025-04-01T18:00:00Z',
          end_time: '2025-04-01T21:00:00Z',
          description: 'Smooth jazz evening',
          location: 'Main Hall',
        },
      ],
      error: null,
    });
    const eventsInA = jest.fn().mockReturnValue({ order: eventsOrderA });
    const eventsSelectA = jest.fn().mockReturnValue({ in: eventsInA });

    const categoriesInA = jest.fn().mockResolvedValue({
      data: [{ category_id: 'music', category_name: 'Music' }],
      error: null,
    });
    const categoriesSelectA = jest.fn().mockReturnValue({ in: categoriesInA });

    // Second call: interests = ['tech'] -> recommends event 2
    const interestsEqB = jest.fn().mockResolvedValue({
      data: [{ category_id: 'tech' }],
      error: null,
    });
    const interestsSelectB = jest.fn().mockReturnValue({ eq: interestsEqB });

    const mapSelectB = jest.fn().mockResolvedValue({
      data: [{ event_id: 2, category_id: 'tech' }],
      error: null,
    });

    const eventsOrderB = jest.fn().mockResolvedValue({
      data: [
        {
          event_id: 2,
          event_title: 'Tech Expo',
          start_time: '2025-05-10T10:00:00Z',
          end_time: '2025-05-10T16:00:00Z',
          description: 'Latest gadgets showcase',
          location: 'Convention Center',
        },
      ],
      error: null,
    });
    const eventsInB = jest.fn().mockReturnValue({ order: eventsOrderB });
    const eventsSelectB = jest.fn().mockReturnValue({ in: eventsInB });

    const categoriesInB = jest.fn().mockResolvedValue({
      data: [{ category_id: 'tech', category_name: 'Technology' }],
      error: null,
    });
    const categoriesSelectB = jest.fn().mockReturnValue({ in: categoriesInB });

    // Wire supabase.from calls for both requests (4 per request)
    supabase.from
      // First GET sequence
      .mockImplementationOnce(() => ({ select: interestsSelectA }))
      .mockImplementationOnce(() => ({ select: mapSelectA }))
      .mockImplementationOnce(() => ({ select: eventsSelectA }))
      .mockImplementationOnce(() => ({ select: categoriesSelectA }))
      // Second GET sequence (after interests changed)
      .mockImplementationOnce(() => ({ select: interestsSelectB }))
      .mockImplementationOnce(() => ({ select: mapSelectB }))
      .mockImplementationOnce(() => ({ select: eventsSelectB }))
      .mockImplementationOnce(() => ({ select: categoriesSelectB }));

    const first = await request(app).get('/api/events/recommended').expect(200);
    expect(first.body.items.map((e) => e.event_id)).toEqual([1]);
    expect(first.body.total).toBe(1);

    const second = await request(app).get('/api/events/recommended').expect(200);
    expect(second.body.items.map((e) => e.event_id)).toEqual([2]);
    expect(second.body.total).toBe(1);
  });
});
