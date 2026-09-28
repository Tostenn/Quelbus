import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { IconContext } from '@phosphor-icons/react'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconContext.Provider value={{ weight: 'bold', size: 20 }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </IconContext.Provider>
  </StrictMode>,
)
