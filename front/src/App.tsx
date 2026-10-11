import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import Contact from './pages/Contact'
import Search from './pages/Search'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="recherche" element={<Search />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
