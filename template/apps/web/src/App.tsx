import { createApiClient } from '@__scope__/api-client';
import { useEffect, useState } from 'react';
import { env } from './env.js';

const api = createApiClient(env.VITE_API_URL);

function App() {
  const [health, setHealth] = useState<string>('checking...');

  useEffect(() => {
    api.health
      .$get()
      .then((r) => r.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>__projectName__</h1>
      <p>Web app skeleton, ready to build on.</p>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        API: {env.VITE_API_URL} ({health})
      </p>
    </div>
  );
}

export default App;
