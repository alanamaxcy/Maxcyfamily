import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

const container = document.getElementById('root')
if (!container) throw new Error('No #root element in the page')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
