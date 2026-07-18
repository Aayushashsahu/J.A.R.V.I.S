const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = {
  async get(endpoint: string) {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'API Request Failed');
    }
    return res.json();
  },
  async post(endpoint: string, body: any) {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || 'API Request Failed');
    }
    return res.json();
  },
  async postFormData(endpoint: string, formData: FormData) {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const file = formData.get('file');
    const fileMeta = file instanceof File ? {
      name: file.name,
      size: file.size,
      type: file.type
    } : 'unknown';

    console.log(`[API Request] POST ${endpoint}`, {
      endpoint,
      file: fileMeta,
      headers
    });
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData
      });
      
      console.log(`[API Response] POST ${endpoint} status: ${res.status}`);

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        console.error(`[API Error Response] POST ${endpoint} body:`, error);
        throw new Error(error.detail || 'API Request Failed');
      }
      
      const data = await res.json();
      console.log(`[API Success] POST ${endpoint} body:`, data);
      return data;
    } catch (err: any) {
      console.error(`[API Network/Fetch Error] POST ${endpoint}:`, err);
      throw err;
    }
  }
};
