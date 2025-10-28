const { registerUser, loginUser } = require('../controllers/userController');

jest.mock('../db', () => ({
  from: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

const supabase = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

function createMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('userController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('registerUser', () => {
    it('returns 400 when required fields are missing', async () => {
      const req = { body: { user_name: 'alice', email: 'alice@example.com' } };
      const res = createMockRes();

      await registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'All fields are required' });
    });

    it('stops with 400 when the email is already registered', async () => {
      const maybeSingle = jest.fn().mockResolvedValue({
        data: { user_id: 1, email: 'existing@example.com' },
        error: null,
      });
      const eq = jest.fn().mockReturnValue({ maybeSingle });
      const select = jest.fn().mockReturnValue({ eq });

      supabase.from.mockImplementationOnce(() => ({ select }));

      const req = {
        body: { user_name: 'alice', email: 'existing@example.com', password: 'Secret123' },
      };
      const res = createMockRes();

      await registerUser(req, res);

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(eq).toHaveBeenCalledWith('email', 'existing@example.com');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email already registered' });
    });

    it('creates the user and returns a token on success', async () => {
      const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
      const eq = jest.fn().mockReturnValue({ maybeSingle });
      const selectExisting = jest.fn().mockReturnValue({ eq });

      const insertedUser = {
        user_id: 12,
        user_name: 'Alice',
        email: 'alice@example.com',
      };
      const selectInserted = jest.fn().mockResolvedValue({
        data: [insertedUser],
        error: null,
      });
      const insert = jest.fn().mockReturnValue({ select: selectInserted });

      supabase.from
        .mockImplementationOnce(() => ({ select: selectExisting }))
        .mockImplementationOnce(() => ({ insert }));

      bcrypt.hash.mockResolvedValue('hashed-password');
      jwt.sign.mockReturnValue('fake-jwt-token');

      const req = {
        body: { user_name: 'Alice', email: 'Alice@Example.com', password: 'Secret123' },
      };
      const res = createMockRes();

      await registerUser(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith('Secret123', 10);
      expect(insert).toHaveBeenCalledWith([
        {
          user_name: 'Alice',
          email: 'alice@example.com',
          password: 'hashed-password',
        },
      ]);
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          user_id: insertedUser.user_id,
          email: insertedUser.email,
          role: 'user',
        },
        'test-secret',
        { expiresIn: '2h' },
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User registered successfully',
        user: {
          user_id: insertedUser.user_id,
          user_name: insertedUser.user_name,
          email: insertedUser.email,
          role: 'user',
        },
        token: 'fake-jwt-token',
      });
    });
  });

  describe('loginUser', () => {
    it('returns 401 when password validation fails', async () => {
      const maybeSingle = jest.fn().mockResolvedValue({
        data: {
          user_id: 99,
          user_name: 'Bob',
          email: 'bob@example.com',
          password: 'hashed-password',
        },
        error: null,
      });
      const eq = jest.fn().mockReturnValue({ maybeSingle });
      const select = jest.fn().mockReturnValue({ eq });

      supabase.from.mockImplementationOnce(() => ({ select }));
      bcrypt.compare.mockResolvedValue(false);

      const req = { body: { email: 'bob@example.com', password: 'WrongPass1' } };
      const res = createMockRes();

      await loginUser(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('WrongPass1', 'hashed-password');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    it('returns 200 and token when credentials are valid', async () => {
      const userRecord = {
        user_id: 42,
        user_name: 'Carol',
        email: 'carol@example.com',
        password: 'hashed-password',
      };
      const maybeSingle = jest.fn().mockResolvedValue({ data: userRecord, error: null });
      const eq = jest.fn().mockReturnValue({ maybeSingle });
      const select = jest.fn().mockReturnValue({ eq });

      supabase.from.mockImplementationOnce(() => ({ select }));
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('login-token');

      const req = { body: { email: 'Carol@example.com', password: 'Passw0rd!' } };
      const res = createMockRes();

      await loginUser(req, res);

      expect(eq).toHaveBeenCalledWith('email', 'carol@example.com');
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          user_id: userRecord.user_id,
          email: userRecord.email,
          role: 'user',
        },
        'test-secret',
        { expiresIn: '2h' },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Login successful',
        user: {
          user_id: userRecord.user_id,
          user_name: userRecord.user_name,
          email: userRecord.email,
          role: 'user',
        },
        token: 'login-token',
      });
    });
  });
});
