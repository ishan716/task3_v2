const request = require('supertest');
const express = require('express');

jest.mock('../db', () => ({
  from: jest.fn(),
}));

const supabase = require('../db');
const userInterestsRouter = require('../routes/userinterests.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/interests', userInterestsRouter);
  return app;
}

describe('User interests routes', () => {
  const cookie = ['userId=test-user'];
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('returns user interests with category details', async () => {
    const selectedInterest = jest.fn().mockResolvedValue({
      data: [{ category_id: 'music' }, { category_id: 'tech' }],
      error: null,
    });
    const selectInterests = jest.fn().mockReturnValue({ eq: selectedInterest });

    const inOperator = jest.fn().mockResolvedValue({
      data: [
        { category_id: 'music', category_name: 'Music' },
        { category_id: 'tech', category_name: 'Tech' },
      ],
      error: null,
    });
    const selectCategories = jest.fn().mockReturnValue({ in: inOperator });

    supabase.from
      .mockImplementationOnce(() => ({ select: selectInterests }))
      .mockImplementationOnce(() => ({ select: selectCategories }));

    const res = await request(app).get('/api/interests/me').set('Cookie', cookie).expect(200);

    expect(selectedInterest).toHaveBeenCalledWith('user_id', 'test-user');
    expect(inOperator).toHaveBeenCalledWith('category_id', ['music', 'tech']);
    expect(res.body).toEqual({
      user_id: 'test-user',
      categories: [
        { category_id: 'music', category_name: 'Music' },
        { category_id: 'tech', category_name: 'Tech' },
      ],
    });
  });

  it('returns empty array when user has no interests', async () => {
    const selectedInterest = jest.fn().mockResolvedValue({ data: [], error: null });
    const selectInterests = jest.fn().mockReturnValue({ eq: selectedInterest });

    supabase.from.mockImplementationOnce(() => ({ select: selectInterests }));

    const res = await request(app).get('/api/interests/me').set('Cookie', cookie).expect(200);

    expect(res.body).toEqual({ user_id: 'test-user', categories: [] });
  });

  it('saves interests by replacing previous selections', async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const deleteBuilder = jest.fn().mockReturnValue({ eq: deleteEq });
    const insert = jest.fn().mockResolvedValue({ error: null });

    supabase.from
      .mockImplementationOnce(() => ({ delete: deleteBuilder }))
      .mockImplementationOnce(() => ({ insert }));

    const res = await request(app)
      .post('/api/interests/me')
      .set('Cookie', cookie)
      .send({ categories: ['music', 'tech', 'music'] })
      .expect(200);

    expect(deleteEq).toHaveBeenCalledWith('user_id', 'test-user');
    expect(insert).toHaveBeenCalledWith([
      { user_id: 'test-user', category_id: 'music' },
      { user_id: 'test-user', category_id: 'tech' },
    ]);
    expect(res.body).toEqual({ user_id: 'test-user', saved: ['music', 'tech'] });
  });

  it('returns 500 when delete step fails during save', async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: new Error('delete failed') });
    const deleteBuilder = jest.fn().mockReturnValue({ eq: deleteEq });

    supabase.from.mockImplementationOnce(() => ({ delete: deleteBuilder }));

    const res = await request(app)
      .post('/api/interests/me')
      .set('Cookie', cookie)
      .send({ categories: ['music'] })
      .expect(500);

    expect(res.body).toEqual({ error: 'delete failed' });
  });

  it('clears interests on DELETE', async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const deleteBuilder = jest.fn().mockReturnValue({ eq: deleteEq });

    supabase.from.mockImplementationOnce(() => ({ delete: deleteBuilder }));

    const res = await request(app).delete('/api/interests/me').set('Cookie', cookie).expect(200);

    expect(deleteEq).toHaveBeenCalledWith('user_id', 'test-user');
    expect(res.body).toEqual({ user_id: 'test-user', deleted: true });
  });

  it('lists available categories', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        { category_id: 'music', category_name: 'Music' },
        { category_id: 'tech', category_name: 'Tech' },
      ],
      error: null,
    });
    const selectCategories = jest.fn().mockReturnValue({ order });

    supabase.from.mockImplementationOnce(() => ({ select: selectCategories }));

    const res = await request(app).get('/api/interests/categories').expect(200);

    expect(order).toHaveBeenCalledWith('category_name', { ascending: true });
    expect(res.body).toEqual([
      { category_id: 'music', category_name: 'Music' },
      { category_id: 'tech', category_name: 'Tech' },
    ]);
  });
});

