import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function Mini() {
  const [n, setN] = useState(0);
  return <button onClick={()=>setN(n+1)}>Clicks: {n}</button>;
}

const el = document.getElementById('root');
if (!el) throw new Error('Missing #root');
createRoot(el).render(<Mini />);

