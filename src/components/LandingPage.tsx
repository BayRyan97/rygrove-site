import { useEffect, useState } from 'react';
import {
  Menu,
  X,
  Hammer,
  Paintbrush,
  Ruler,
  Wrench,
  HardHat,
  Home,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
import { useForm, ValidationError } from '@formspree/react';
import { AuthForm } from './AuthForm';

interface LandingPageProps {
  isAuthenticated?: boolean;
}

interface ServiceCard {
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
}

const serviceCards: ServiceCard[] = [
  {
    title: 'Site Work and Foundations',
    description:
      'Solid starts for long-lasting builds with prep, layout, and foundation work handled by experienced crews.',
    bullets: [
      'New builds and structural additions',
      'Concrete and footing coordination',
      'Built for durability and code compliance',
    ],
    icon: HardHat,
  },
  {
    title: 'Framing and Carpentry',
    description:
      'Precision carpentry for both structural framing and finish details that define the final look.',
    bullets: [
      'Walls, headers, and structural corrections',
      'Crown molding and interior trim',
      'Clean lines and jobsite professionalism',
    ],
    icon: Hammer,
  },
  {
    title: 'Interior and Exterior Painting',
    description:
      'Complete surface prep and high-quality paint application for durable finishes that hold up over time.',
    bullets: [
      'Surface repair, caulking, and priming',
      'Residential and commercial finishes',
      'Color guidance and finish matching',
    ],
    icon: Paintbrush,
  },
  {
    title: 'Renovations and Build-outs',
    description:
      'From partial remodels to full-space transformations, we manage sequencing to keep your project moving.',
    bullets: [
      'Kitchens, baths, basements, and additions',
      'Residential and light commercial projects',
      'Milestone scheduling and updates',
    ],
    icon: Home,
  },
  {
    title: 'Finish Work That Stands Out',
    description:
      'We take pride in the details that clients see every day, from trim transitions to final touchups.',
    bullets: [
      'Door, window, and trim installations',
      'Crown molding and decorative carpentry',
      'Punch-list completion with care',
    ],
    icon: Ruler,
  },
  {
    title: 'Licensed Trade Coordination',
    description:
      'Need electrical or plumbing scope? We coordinate vetted partners so you still get one accountable team.',
    bullets: [
      'Trusted electrical and plumbing subcontractors',
      'Coordinated scheduling across trades',
      'Single point of communication',
    ],
    icon: Wrench,
  },
];

export function LandingPage({ isAuthenticated = false }: LandingPageProps) {
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

  const [contactFormState, submitContactForm] = useForm('xaewnzao');

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    submitContactForm(e);
  };

  useEffect(() => {
    if (contactFormState.succeeded) {
      setContactEmail('');
      setContactMessage('');
    }
  }, [contactFormState.succeeded]);

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

  const coreContent = (
    <>
      <section className="gradient-bg py-16 md:py-24 min-h-[70vh] flex items-center justify-center">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-3">
            Full-Scope Construction. <span className="text-blue-600">Built Right Since 1999.</span>
          </h1>
          <p className="text-base md:text-lg text-gray-700 mb-3">
            Rygrove is a family-built construction company established in 1999. From foundation work to crown molding to final paint, we deliver skilled craftsmanship through every phase.
          </p>
          <p className="text-sm md:text-base text-gray-700 mb-6">
            When specialty trades are needed, we coordinate trusted licensed partners for electrical and plumbing so your project stays on track from start to finish.
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
              className="bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold py-3 px-8 rounded-lg transition"
            >
              Request Consultation
            </a>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-8">
            Why Homeowners and Property Owners Choose Rygrove
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition">
              <h3 className="font-semibold text-gray-800 mb-2">One Team, Whole Project</h3>
              <p className="text-gray-600">
                We handle rough and finish scopes so you are not juggling multiple crews for every stage.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition">
              <h3 className="font-semibold text-gray-800 mb-2">Craftsmanship and Detail</h3>
              <p className="text-gray-600">
                Foundations, framing, trim, molding, and paint are all completed with consistent quality standards.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition">
              <h3 className="font-semibold text-gray-800 mb-2">Trusted Since 1999</h3>
              <p className="text-gray-600">
                Founded by your father and built on reputation, Rygrove has served clients for decades with reliable delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-8">
            Our Construction Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {serviceCards.map((service) => {
              const Icon = service.icon;

              return (
                <div key={service.title} className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition">
                  <Icon className="text-blue-600 mb-4" size={32} />
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">{service.title}</h3>
                  <p className="text-gray-600 mb-4">{service.description}</p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    {service.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center">
                        <CheckCircle size={16} className="text-green-600 mr-2" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-12 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-8">
            The Rygrove Difference
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition border-l-4 border-blue-600">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Family Legacy</h3>
              <p className="text-gray-600 mb-4">
                Founded by your father in 1999, Rygrove was built on pride in workmanship, honest dealing, and projects done right.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Established reputation in the community</li>
                <li>✓ Consistent standards across every job</li>
                <li>✓ Respect for your property and timeline</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition border-l-4 border-blue-600">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Start-to-Finish Capability</h3>
              <p className="text-gray-600 mb-4">
                We carry projects from structural work to finish carpentry and painting under one coordinated plan.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Fewer handoff delays</li>
                <li>✓ Better quality control</li>
                <li>✓ Clear milestones and communication</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition border-l-4 border-blue-600">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Practical Problem Solving</h3>
              <p className="text-gray-600 mb-4">
                Every property is different. We assess what is in front of us and deliver solutions that are solid, safe, and built to last.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Field-tested construction judgment</li>
                <li>✓ Clean execution without shortcuts</li>
                <li>✓ Transparent updates as work progresses</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition border-l-4 border-blue-600">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Trusted Trade Partners</h3>
              <p className="text-gray-600 mb-4">
                For scopes we do not self-perform, like electrical and plumbing, we bring in qualified partners while maintaining project control.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Licensed and vetted specialists</li>
                <li>✓ Integrated scheduling with our crew</li>
                <li>✓ Accountability through one lead contractor</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  if (isAuthenticated) {
    return <div className="bg-white">{coreContent}</div>;
  }

  return (
    <div className="bg-white">
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
            RYGROVE
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-700 hover:text-blue-600 transition">Services</a>
            <a href="#benefits" className="text-gray-700 hover:text-blue-600 transition">Why Rygrove</a>
            <a href="#contact" className="text-gray-700 hover:text-blue-600 transition">Contact</a>
            <button
              onClick={handleLoginClick}
              className="text-gray-700 hover:text-blue-600 transition font-medium"
            >
              Employee Log In
            </button>
          </nav>

          <button
            onClick={toggleMenu}
            className="md:hidden p-2 text-gray-600 hover:text-gray-800 transition"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <nav className="md:hidden bg-white border-t border-gray-200 px-4 py-4">
            <ul className="space-y-3">
              <li>
                <a
                  href="#features"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Services
                </a>
              </li>
              <li>
                <a
                  href="#benefits"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Why Rygrove
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

      {coreContent}

      <section id="contact" className="py-12 md:py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Planning a Build, Remodel, or Finish Project?
            </h2>
            <p className="text-center text-blue-100 mb-8">
              Tell us what you are planning and we will reach out to discuss scope, timeline, and next steps.
            </p>

            {contactFormState.succeeded ? (
              <div className="bg-white rounded-lg p-8 shadow-xl text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h3>
                <p className="text-gray-600">
                  We have received your request and will be in touch shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="bg-white rounded-lg p-8 shadow-xl">
                <div className="mb-6">
                  <label htmlFor="contact-email" className="block text-gray-700 font-semibold mb-2">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-900"
                    placeholder="your@email.com"
                  />
                  <ValidationError
                    prefix="Email"
                    field="email"
                    errors={contactFormState.errors}
                    className="text-red-600 text-sm mt-2"
                  />
                </div>

                <div className="mb-6">
                  <label htmlFor="contact-message" className="block text-gray-700 font-semibold mb-2">
                    Tell us about your project (optional)
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-900"
                    placeholder="Property type, project goals, location, and timing"
                  />
                  <ValidationError
                    prefix="Message"
                    field="message"
                    errors={contactFormState.errors}
                    className="text-red-600 text-sm mt-2"
                  />
                </div>

                <button
                  type="submit"
                  disabled={contactFormState.submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {contactFormState.submitting ? 'Sending...' : 'Request a Consultation'}
                </button>
                <p className="text-center text-gray-600 text-sm mt-4">
                  We aim to respond within 24 hours.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-gray-800 text-gray-300 py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="text-white font-bold text-lg mb-4">RYGROVE</div>
              <p className="text-gray-400">
                Full-service construction and finishing company, proudly building since 1999.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Services</a></li>
                <li><a href="#benefits" className="hover:text-white transition">Why Rygrove</a></li>
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
