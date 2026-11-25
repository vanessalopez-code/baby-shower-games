import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { GameProvider } from './context/GameContext'
import Home from './pages/Home'
import Admin from './pages/Admin'
import AdminPriceIsRight from './pages/AdminPriceIsRight'
import GamePriceIsRight from './pages/GamePriceIsRight'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <GameProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/price-is-right" element={<AdminPriceIsRight />} />
          <Route path="/game/price-is-right" element={<GamePriceIsRight />} />
        </Routes>
      </GameProvider>
    </BrowserRouter>
  </StrictMode>
)
