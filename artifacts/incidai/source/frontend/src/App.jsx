/**
 * Main App Component
 * 
 * Sets up React Router for navigation between pages:
 * - Dashboard: Overview and statistics
 * - Tickets: List and manage tickets
 * - New Ticket: Create new ticket with AI classification
 * - Analyze: AI-powered ticket analysis
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, Ticket, PlusCircle, Brain, Menu } from 'lucide-react';
import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import TicketList from './pages/TicketList';
import NewTicket from './pages/NewTicket';
import AnalyzeTicket from './pages/AnalyzeTicket';
import './index.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-primary">ITSM AI</h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            <NavLink to="/" icon={<LayoutDashboard size={20} />} open={sidebarOpen}>
              Dashboard
            </NavLink>
            <NavLink to="/tickets" icon={<Ticket size={20} />} open={sidebarOpen}>
              Tickets
            </NavLink>
            <NavLink to="/new-ticket" icon={<PlusCircle size={20} />} open={sidebarOpen}>
              New Ticket
            </NavLink>
            <NavLink to="/analyze" icon={<Brain size={20} />} open={sidebarOpen}>
              AI Analyze
            </NavLink>
          </nav>

          {/* Footer */}
          {sidebarOpen && (
            <div className="px-6 py-4 border-t border-gray-200 text-xs text-gray-500">
              AI-Powered ITSM
              <br />
              Hackathon 2024
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/new-ticket" element={<NewTicket />} />
            <Route path="/analyze" element={<AnalyzeTicket />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

/**
 * Navigation Link Component
 */
function NavLink({ to, icon, children, open }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-primary transition-colors"
    >
      {icon}
      {open && <span className="font-medium">{children}</span>}
    </Link>
  );
}

export default App;
