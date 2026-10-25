import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import Contact from './pages/Contact'
import Search from './pages/Search'
import Lines from './pages/Lines'
import Line from './pages/Line'
import Stop from './pages/Stop'
import About from './pages/About'
import Support from './pages/Support'
import Thanks from './pages/Thanks'
import Login from './pages/Login'
import Admin from './pages/Admin'
import NotFound from './components/NotFound'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="recherche" element={<Search />} />
        <Route path="rejoindre" element={<Search />} />
        <Route path="lignes" element={<Lines />} />
        <Route path="lignes/:slug" element={<Line />} />
        <Route path="arrets/:slug" element={<Stop />} />
        <Route path="a-propos" element={<About />} />
        <Route path="soutenir" element={<Support />} />
        <Route path="soutenir/merci" element={<Thanks />} />
        <Route path="contact" element={<Contact />} />
        <Route path="connexion" element={<Login />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
