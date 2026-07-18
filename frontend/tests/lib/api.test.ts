import { api } from '../../lib/api';

describe('api', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = jest.fn();

    // Mock localStorage
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('get', () => {
    it('should successfully make a GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      (global.localStorage.getItem as jest.Mock).mockReturnValue('mock-token');

      const result = await api.get('/test-endpoint');

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/test-endpoint', {
        headers: {
          Authorization: 'Bearer mock-token',
        },
      });
      expect(result).toEqual(mockData);
    });

    it('should throw an error if the response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      await expect(api.get('/test-endpoint')).rejects.toThrow('API Request Failed');
    });
  });

  describe('post', () => {
    it('should successfully make a POST request', async () => {
      const mockData = { id: 1, name: 'Test' };
      const body = { name: 'Test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      (global.localStorage.getItem as jest.Mock).mockReturnValue('mock-token');

      const result = await api.post('/test-endpoint', body);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/test-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify(body),
      });
      expect(result).toEqual(mockData);
    });

    it('should throw an error with API detail if the response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Custom error message' }),
      });

      await expect(api.post('/test-endpoint', {})).rejects.toThrow('Custom error message');
    });

    it('should throw a default error if the response is not ok and no detail is provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      await expect(api.post('/test-endpoint', {})).rejects.toThrow('API Request Failed');
    });
  });

  describe('postFormData', () => {
    it('should successfully make a POST request with FormData', async () => {
      const mockData = { success: true };
      const formData = new FormData();
      formData.append('file', 'test.txt');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      (global.localStorage.getItem as jest.Mock).mockReturnValue('mock-token');

      const result = await api.postFormData('/test-endpoint', formData);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/test-endpoint', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock-token',
        },
        body: formData,
      });
      expect(result).toEqual(mockData);
    });

    it('should throw an error if the response is not ok', async () => {
      const formData = new FormData();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      await expect(api.postFormData('/test-endpoint', formData)).rejects.toThrow('API Request Failed');
    });
  });
});
