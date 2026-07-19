const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function handle401() {
  // Clear stale token and redirect to login
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
}

async function handleResponseError(res: Response, endpoint: string) {
  // Handle 401 Unauthorized — stale or invalid token
  if (res.status === 401) {
    console.warn(`[API Auth] 401 on ${endpoint} — clearing token and redirecting to login`);
    handle401();
    throw new Error('Session expired. Please log in again.');
  }

  const text = await res.text();
  console.log(`[API Error] POST/GET ${endpoint} Status:`, res.status);
  console.log(`[API Error] Headers:`, [...res.headers.entries()]);
  console.log(`[API Error] Body:`, text);

  let errorDetail = 'API Request Failed';
  try {
    const errorObj = JSON.parse(text);
    errorDetail = errorObj.error || errorObj.detail || errorDetail;
    if (errorObj.exception_type) {
      console.error(`[API Exception Type]:`, errorObj.exception_type);
    }
    if (errorObj.traceback) {
      console.error(`[API Error Traceback]:`, errorObj.traceback);
    }
  } catch (e) {
    console.warn("Response body is not JSON:", text);
  }
  throw new Error(errorDetail);
}

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
      return handleResponseError(res, endpoint);
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
      return handleResponseError(res, endpoint);
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
        return handleResponseError(res, endpoint);
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
