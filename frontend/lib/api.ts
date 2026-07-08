const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = {
  async get(endpoint: string) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error('API Request Failed');
    return res.json();
  },
  async post(endpoint: string, body: any) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'API Request Failed');
    }
    return res.json();
  },
  async postFormData(endpoint: string, formData: FormData) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    if (!res.ok) throw new Error('API Request Failed');
    return res.json();
  }
};
