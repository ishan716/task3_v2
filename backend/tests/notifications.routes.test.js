const request = require('supertest');
const express = require('express');

jest.mock('../middlewares/verifyUser', () => (req, res, next) => {
  req.user = { user_id: 1 };
  next();
});

jest.mock('../untils/notify', () => ({
  createNotificationForAllUsers: jest.fn(),
}));

jest.mock('../db', () => ({
  from: jest.fn(),
}));

const supabase = require('../db');
const { createNotificationForAllUsers } = require('../untils/notify');
const notificationsModule = require('../routes/notifications.routes');
const notificationsRouter = notificationsModule;
const { resolveNumericUserId } = notificationsModule;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.cookies = req.cookies || {};
    next();
  });
  app.use('/api/notifications', notificationsRouter);
  return app;
}

describe('resolveNumericUserId helper', () => {
  it('returns numeric value from query string', () => {
    const req = { query: { userId: ' 42 ' }, cookies: {} };
    expect(resolveNumericUserId(req)).toBe(42);
  });

  it('falls back to cookie when query is absent', () => {
    const req = { query: {}, cookies: { userId: '15' } };
    expect(resolveNumericUserId(req)).toBe(15);
  });

  it('returns null for invalid inputs', () => {
    const cases = [{ query: { userId: 'abc' } }, { query: { userId: '-3' } }, { query: {}, cookies: { userId: '0' } }];
    cases.forEach((req) => {
      req.cookies = req.cookies || {};
      expect(resolveNumericUserId(req)).toBeNull();
    });
  });
});

describe('Notifications routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('returns formatted notifications for a user', async () => {
    const sampleRows = [
      {
        id: 10,
        notification_id: 21,
        is_read: false,
        seen_at: null,
        notifications: {
          id: 21,
          title: 'Welcome',
          message: 'Hello there',
          link: '/welcome',
          created_at: '2024-10-01T00:00:00Z',
        },
      },
      {
        id: 11,
        notification_id: null,
        is_read: true,
        seen_at: '2024-10-02T00:00:00Z',
        notifications: {
          id: 22,
          title: 'Reminder',
          message: 'Event soon',
          link: null,
          created_at: '2024-10-02T00:00:00Z',
        },
      },
    ];

    const order = jest.fn().mockResolvedValue({ data: sampleRows, error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });

    supabase.from.mockImplementationOnce(() => ({ select }));

    const res = await request(app).get('/api/notifications?userId=12').expect(200);

    expect(supabase.from).toHaveBeenCalledWith('user_notifications');
    expect(res.body).toEqual({
      items: [
        {
          id: 21,
          notification_id: 21,
          entry_id: 10,
          title: 'Welcome',
          message: 'Hello there',
          link: '/welcome',
          created_at: '2024-10-01T00:00:00Z',
          is_read: false,
          seen_at: null,
        },
        {
          id: 22,
          notification_id: 22,
          entry_id: 11,
          title: 'Reminder',
          message: 'Event soon',
          link: null,
          created_at: '2024-10-02T00:00:00Z',
          is_read: true,
          seen_at: '2024-10-02T00:00:00Z',
        },
      ],
      unseen_count: 1,
    });
  });

  it('short-circuits to empty payload when no user id provided', async () => {
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toEqual({ items: [], unseen_count: 0 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns 500 when supabase fails during fetch', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: new Error('boom') });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });

    supabase.from.mockImplementationOnce(() => ({ select }));

    const res = await request(app).get('/api/notifications?userId=9').expect(500);
    expect(res.body).toEqual({ error: 'Failed to fetch notifications' });
  });

  it('marks a notification as read for the user', async () => {
    const finalEq = jest.fn().mockResolvedValue({ error: null });
    const firstEq = jest.fn().mockReturnValue({ eq: finalEq });
    const update = jest.fn().mockReturnValue({ eq: firstEq });

    supabase.from.mockImplementationOnce(() => ({ update }));

    const res = await request(app).patch('/api/notifications/33/read?userId=7').expect(200);

    expect(update).toHaveBeenCalledWith({
      is_read: true,
      seen_at: expect.any(String),
    });
    expect(firstEq).toHaveBeenCalledWith('user_id', 7);
    expect(finalEq).toHaveBeenCalledWith('notification_id', '33');
    expect(res.body).toEqual({ success: true, message: 'Notification marked as read' });
  });

  it('requires a numeric user id when marking as read', async () => {
    const res = await request(app).patch('/api/notifications/44/read').expect(401);
    expect(res.body).toEqual({ error: 'Valid numeric userId is required' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('creates a notification for all users', async () => {
    createNotificationForAllUsers.mockResolvedValueOnce();

    const res = await request(app)
      .post('/api/notifications')
      .send({ title: 'New Feature', message: 'Check this out', link: '/feature' })
      .expect(201);

    expect(createNotificationForAllUsers).toHaveBeenCalledWith('New Feature', 'Check this out', '/feature');
    expect(res.body).toEqual({ success: true, message: 'Notification sent to all users' });
  });

  it('validates required fields when creating notifications', async () => {
    const res = await request(app).post('/api/notifications').send({ title: '' }).expect(400);
    expect(res.body).toEqual({ error: 'title and message required' });
    expect(createNotificationForAllUsers).not.toHaveBeenCalled();
  });

  it('handles failures when broadcasting notifications', async () => {
    createNotificationForAllUsers.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .post('/api/notifications')
      .send({ title: 'Maintenance', message: 'System offline tonight' })
      .expect(500);

    expect(res.body).toEqual({ error: 'Failed to create notification' });
  });
});

