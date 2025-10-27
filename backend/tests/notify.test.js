const { createNotificationForAllUsers } = require('../untils/notify');

jest.mock('../db', () => ({
  from: jest.fn(),
}));

const supabase = require('../db');

describe('createNotificationForAllUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts notification records for each user', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: 7, title: 'System Update', message: 'Test message', link: '/details' },
      error: null,
    });
    const selectInserted = jest.fn().mockReturnValue({ single });
    const insertNotification = jest.fn().mockReturnValue({ select: selectInserted });

    const selectUsers = jest.fn().mockResolvedValue({
      data: [{ user_id: 'u1' }, { user_id: 'u2' }],
      error: null,
    });

    const insertUserNotifications = jest.fn().mockResolvedValue({ error: null });

    supabase.from
      .mockImplementationOnce(() => ({ insert: insertNotification }))
      .mockImplementationOnce(() => ({ select: selectUsers }))
      .mockImplementationOnce(() => ({ insert: insertUserNotifications }));

    await createNotificationForAllUsers('System Update', 'Test message', '/details');

    expect(insertNotification).toHaveBeenCalledWith([
      { title: 'System Update', message: 'Test message', link: '/details' },
    ]);
    expect(insertUserNotifications).toHaveBeenCalledWith([
      { user_id: 'u1', notification_id: 7, is_read: false, seen_at: null },
      { user_id: 'u2', notification_id: 7, is_read: false, seen_at: null },
    ]);
  });

  it('skips user notification insert when no users exist', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: 11, title: 'No Users', message: 'Test message', link: null },
      error: null,
    });
    const selectInserted = jest.fn().mockReturnValue({ single });
    const insertNotification = jest.fn().mockReturnValue({ select: selectInserted });

    const selectUsers = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const insertUserNotifications = jest.fn().mockResolvedValue({ error: null });

    supabase.from
      .mockImplementationOnce(() => ({ insert: insertNotification }))
      .mockImplementationOnce(() => ({ select: selectUsers }))
      .mockImplementationOnce(() => ({ insert: insertUserNotifications }));

    await createNotificationForAllUsers('No Users', 'Test message');

    expect(insertNotification).toHaveBeenCalled();
    expect(insertUserNotifications).not.toHaveBeenCalled();
  });
});
