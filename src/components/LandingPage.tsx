import { useState } from 'react';
import { Menu, X, Clock, Receipt, FileText, Grid3x3, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { AuthForm } from './AuthForm';

export function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLoginClick = () => {
    setShowAuthForm(true);
    setIsMenuOpen(false);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement contact form submission
    alert('Thank you for your interest! We will be in touch shortly.');
    setContactEmail('');
    setContactMessage('');
  };

  if (showAuthForm) {
    return (
      <div className="gradient-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <button
              onClick={() => setShowAuthForm(false)}
              className="absolute top-4 left-4 p-2 text-gray-600 hover:text-gray-800 transition"
            >
              <X size={24} />
            </button>
            <h1 className="text-3xl font-bold text-gray-800 mb-8">RYGROVE</h1>
            <AuthForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
            RYGROVE
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-700 hover:text-blue-600 transition">Features</a>
            <a href="#benefits" className="text-gray-700 hover:text-blue-600 transition">For Your Team</a>
            <a href="#contact" className="text-gray-700 hover:text-blue-600 transition">Contact</a>
            <button
              onClick={handleLoginClick}
              className="text-gray-700 hover:text-blue-600 transition font-medium"
            >
              Employee Log In
            </button>
          </nav>

          {/* Hamburger Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 text-gray-600 hover:text-gray-800 transition"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <nav className="md:hidden bg-white border-t border-gray-200 px-4 py-4">
            <ul className="space-y-3">
              <li>
                <a
                  href="#features"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#benefits"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  For Your Team
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Contact
                </a>
              </li>
              <li className="border-t border-gray-200 pt-3">
                <button
                  onClick={handleLoginClick}
                  className="w-full text-left px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
                >
                  Employee Log In
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      {/* Hero Section */}
      <section className="gradient-bg py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-800 mb-6">
            Manage Operations. <span className="text-blue-600">Maximize Profitability.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-4 max-w-2xl mx-auto">
            Rygrove is the all-in-one platform for contractors and small businesses to track time, manage expenses, generate invoices, and plan projects—all in one place.
          </p>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Stop wasting time on spreadsheets. Get visibility into profitability. Get paid faster.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleLoginClick}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
            >
              Employee Log In
            </button>
            <a
              href="#contact"
              className="bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-3 px-8 rounded-lg transition"
            >
              Schedule Demo
            </a>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-12">
            The Problem With Manual Processes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition">
              <div className="text-3xl mb-3">⏱️</div>
              <h3 className="font-semibold text-gray-800 mb-2">Hours Spent on Admin</h3>
              <p className="text-gray-600">
                Manual time entry, spreadsheet management, and invoice creation drain hours from your actual business.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition">
              <div className="text-3xl mb-3">💸</div>
              <h3 className="font-semibold text-gray-800 mb-2">Invisible Profitability</h3>
              <p className="text-gray-600">
                Without clear time and expense tracking, you don't know which projects are actually profitable.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition">
              <div className="text-3xl mb-3">📄</div>
              <h3 className="font-semibold text-gray-800 mb-2">Late Payments</h3>
              <p className="text-gray-600">
                Manual invoicing means delayed billing, slower payments, and cash flow problems.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-12">
            Everything You Need to Run Your Business
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Time Tracking */}
            <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition">
              <Clock className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Time Tracking</h3>
              <p className="text-gray-600 mb-4">
                Log work hours with flexible scheduling, classify work types, and track lunch breaks.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Full & partial day logging</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Work type classification</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Admin override capability</li>
              </ul>
            </div>

            {/* Expense & Receipts */}
            <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition">
              <Receipt className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Expense Management</h3>
              <p className="text-gray-600 mb-4">
                Track expenses with receipt uploads, automatic categorization, and full audit trail.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Receipt image storage</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Category management</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Invoice integration</li>
              </ul>
            </div>

            {/* Invoicing */}
            <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition">
              <FileText className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Professional Invoicing</h3>
              <p className="text-gray-600 mb-4">
                Generate invoices from tracked time and expenses. Get paid faster with polished, detailed billing.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Automated calculations</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> PDF export</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Tax & line item support</li>
              </ul>
            </div>

            {/* Project Planning */}
            <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition">
              <Grid3x3 className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Project Planning</h3>
              <p className="text-gray-600 mb-4">
                Visualize timelines with interactive Gantt charts, assign tasks, and track progress in real-time.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Drag-and-drop scheduling</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Color-coded categories</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Team collaboration notes</li>
              </ul>
            </div>

            {/* Labor Cost Insights */}
            <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition">
              <TrendingUp className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Profitability Insights</h3>
              <p className="text-gray-600 mb-4">
                Understand project profitability at a glance with labor cost calculations and analytics.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Automatic cost calculations</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Dashboard analytics</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Custom rate management</li>
              </ul>
            </div>

            {/* Team Management */}
            <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition">
              <Users className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Team Management</h3>
              <p className="text-gray-600 mb-4">
                Control access with role-based permissions. Admin, supervisor, and employee roles with granular controls.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Role-based access</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Profile management</li>
                <li className="flex items-center"><CheckCircle size={16} className="text-green-600 mr-2" /> Activity monitoring</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases / Benefits by Role */}
      <section id="benefits" className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-12">
            Built for Your Entire Team
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition border-l-4 border-blue-600">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">👔 Business Owners</h3>
              <p className="text-gray-600 mb-4">
                Know exactly which projects are profitable. See labor costs, expenses, and margins in real-time. Make data-driven decisions about pricing and resource allocation.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Profitability per project</li>
                <li>✓ Labor cost visibility</li>
                <li>✓ Team utilization rates</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition border-l-4 border-blue-600">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">📋 Project Managers</h3>
              <p className="text-gray-600 mb-4">
                Visualize timelines, delegate tasks, and track progress instantly. Stay on schedule, communicate clearly with your team, and manage scope changes.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Gantt chart visualization</li>
                <li>✓ Task assignment & tracking</li>
                <li>✓ Team notes & collaboration</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition border-l-4 border-blue-600">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">💼 Accountants/Bookkeepers</h3>
              <p className="text-gray-600 mb-4">
                Automate expense tracking with receipt documentation. Categorize costs instantly. Export data for tax filings and financial reporting.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Receipt image storage</li>
                <li>✓ Expense categorization</li>
                <li>✓ CSV/XLSX export</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition border-l-4 border-blue-600">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">👨‍💼 Employees/Contractors</h3>
              <p className="text-gray-600 mb-4">
                Simple, fast time logging. Track expenses and get reimbursed quickly. Transparent communication with your team about projects and timelines.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Quick time entry</li>
                <li>✓ Expense reimbursement</li>
                <li>✓ Project visibility</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Contact / Demo CTA Section */}
      <section id="contact" className="py-16 md:py-24 bg-blue-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">
              Ready to Take Control of Your Operations?
            </h2>
            <p className="text-center text-blue-100 mb-12">
              Join contractors and small businesses already using Rygrove to streamline operations and maximize profitability.
            </p>

            <form onSubmit={handleContactSubmit} className="bg-white rounded-lg p-8 shadow-xl">
              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                  placeholder="your@email.com"
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-2">
                  Tell us about your business (optional)
                </label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                  placeholder="What industry are you in? How many team members?"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition transform hover:-translate-y-0.5"
              >
                Schedule Demo / Get Started
              </button>
              <p className="text-center text-gray-600 text-sm mt-4">
                We'll be in touch within 24 hours.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="text-white font-bold text-lg mb-4">RYGROVE</div>
              <p className="text-gray-400">
                All-in-one operations management for contractors and small businesses.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#benefits" className="hover:text-white transition">For Your Team</a></li>
                <li><button onClick={handleLoginClick} className="hover:text-white transition">Employee Log In</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#contact" className="hover:text-white transition">Contact Us</a></li>
                <li><a href="mailto:support@rygrove.com" className="hover:text-white transition">support@rygrove.com</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 text-center text-sm">
            <p>&copy; 2026 RYGROVE. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
