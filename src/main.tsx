import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from './locales'
import { installServerApiKeyFetch } from './utils/serverKey'
import './index.css'
import App from './App.tsx'

// Attach the optional server access key (ADMIN_API_KEY) to /api requests.
installServerApiKeyFetch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
