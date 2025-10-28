// filepath: c:\Users\ishan\OneDrive\Desktop\demo\ecom\frontend\task3_v2\backend\tests\auth.test.js
const request = require('supertest');
const express = require('express');

// Mount the actual routers and middleware
const userAuthRoutes = require('../routes/auth/userAuthRoutes');
const adminAuthRoutes = require('../routes/auth/adminAuthRoutes');
const verifyToken = require('../middlewares/verifyUser');

// Use the real jsonwebtoken to validate middleware behaviour
const jwt = require('jsonwebtoken');

// Mock supabase client and bcrypt used by controllers
jest.mock('../db', () => ({ from: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

const supabase = require('../db');
const bcrypt = require('bcrypt');

// Helper to create an isolated express app per test suite
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', userAuthRoutes);
  app.use('/api/auth/admin', adminAuthRoutes);
  // Simple protected route to test token middleware
  app.get('/protected', verifyToken, (req, res) => {
    res.json({ ok: true, user: req.user });
  });
  return app;
}

// Utility to create a standard mock response from supabase select->eq->maybeSingle
function mockSupabaseMaybeSingle({ data, error } = { data: null, error: null }) {
  const maybeSingle = jest.fn().mockResolvedValue({ data, error });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  return { select, eq, maybeSingle };
}

// Utility to mock an insert returning .select()
function mockSupabaseInsertReturning(data) {
  const selectInserted = jest.fn().mockResolvedValue({ data, error: null });
  const insert = jest.fn().mockReturnValue({ select: selectInserted });
  return { insert, selectInserted };
}

describe('Auth flows (user/admin) and token-protected route', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    app = createApp();
  });

  describe('User registration and login', () => {
    it('registers a user successfully', async () => {
      // 1st call: check existing user -> none
      const existing = mockSupabaseMaybeSingle({ data: null, error: null });
      // 2nd call: insert user -> returns created user
      const createdUser = [{ user_id: 1, user_name: 'Alice', email: 'alice@example.com' }];
      const insertMock = mockSupabaseInsertReturning(createdUser);

      supabase.from
        .mockImplementationOnce(() => ({ select: existing.select }))
        .mockImplementationOnce(() => ({ insert: insertMock.insert }));

      bcrypt.hash.mockResolvedValue('hashed-pass');

      const res = await request(app)
        .post('/api/auth/register')
        .send({ user_name: 'Alice', email: 'Alice@Example.com', password: 'Secret123' })
        .expect(201);

      expect(bcrypt.hash).toHaveBeenCalledWith('Secret123', 10);
      expect(res.body).toMatchObject({
        message: 'User registered successfully',
        user: {
          user_id: 1,
          user_name: 'Alice',
          email: 'alice@example.com',
          role: 'user',
        },
        token: expect.any(String),
      });
      // Verify the token can be decoded with our secret
      const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
      expect(payload).toMatchObject({ user_id: 1, email: 'alice@example.com', role: 'user' });
    });

    it('logs in a user successfully', async () => {
      const userRecord = {
        user_id: 42,
        user_name: 'Bob',
        email: 'bob@example.com',
        password: 'hashed-pass',
      };
      const found = mockSupabaseMaybeSingle({ data: userRecord, error: null });
      supabase.from.mockImplementationOnce(() => ({ select: found.select }));

      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'Bob@Example.com', password: 'Secret123' })
        .expect(200);

      expect(bcrypt.compare).toHaveBeenCalledWith('Secret123', 'hashed-pass');
      expect(res.body).toMatchObject({
        message: 'Login successful',
        user: {
          user_id: 42,
          user_name: 'Bob',
          email: 'bob@example.com',
          role: 'user',
        },
        token: expect.any(String),
      });
    });
  });

  describe('Admin login', () => {
    it('logs in an admin successfully', async () => {
      const adminRecord = { id: 7, email: 'admin@example.com', password: 'hashed-admin' };
      const found = mockSupabaseMaybeSingle({ data: adminRecord, error: null });
      supabase.from.mockImplementationOnce(() => ({ select: found.select }));

      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@example.com', password: 'StrongPass!1' })
        .expect(200);

      expect(res.body).toMatchObject({
        message: 'Login successful',
        admin: { id: 7, email: 'admin@example.com', role: 'admin' },
        token: expect.any(String),
      });
    });
  });

  describe('Accessing protected route', () => {
    it('denies access when no token is provided', async () => {
      const res = await request(app).get('/protected').expect(403);
      expect(res.body).toEqual({ message: 'Token required' });
    });

    it('denies access with an invalid token', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
      expect(res.body).toEqual({ message: 'Invalid or expired token' });
    });

    it('grants access with a valid token', async () => {
      const token = jwt.sign(
        { user_id: 99, email: 'test@example.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
      );

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({ ok: true });
      expect(res.body.user).toMatchObject({ user_id: 99, email: 'test@example.com', role: 'user' });
    });
  });
});

