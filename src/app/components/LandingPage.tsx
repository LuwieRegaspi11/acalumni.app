// =====================================================================
// LANDING PAGE — the public, logged-out marketing homepage ("/" route).
// Contains its own header/nav (see the PUBLIC SITE HEADER marker below)
// and its own color constants (see the PUBLIC SITE COLORS marker below)
// — these are separate from
// the logged-in dashboard, which lives in DashboardLayout.tsx.
// =====================================================================

// -- React & routing ---------------------------------------------------
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

// -- Icons (lucide-react) ------------------------------------------------
import {
  GraduationCap, Users, TrendingUp, Calendar,
  Shield, Award, ChevronRight, ChevronLeft,
  Phone, Mail, MapPin, Globe, Facebook, Twitter, Youtube,
  ArrowRight, Menu, X, Clock, Star, Heart, Monitor,
  Briefcase, Coffee, Landmark
} from 'lucide-react';

// -- Local image assets --------------------------------------------------
import asianCollegeLogo from '../../imports/asiancollege_logo.jpeg';
import headerLogo from '@/imports/asiancollege_logo.jpeg';
import heroGraduation1 from '../../imports/hero-graduation-1.jpeg';
import heroCampusStudents from '../../imports/hero-campus-students.jpeg';
import heroGraduation2 from '../../imports/hero-graduation-2.jpeg';

// PUBLIC SITE COLORS — edit these to change the landing page's
// header, buttons, and accent colors everywhere on this page.
// (These mirror the global brand colors in src/styles/theme.css —
// change both places if you want the color to match site-wide.)
const NAVY   = '#1B3A6B';
const BLUE   = '#2B5BA8';
const LBLUE  = '#5B9BD5';
const RED    = '#CC2200';
const PURPLE = '#a855f7';
const YELLOW = '#eab308';
const PANEL  = `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 55%, ${LBLUE} 100%)`;

const HERO_SLIDES = [
  {
    image: heroGraduation1,
    tag: 'Welcome to Asian College',
    title: 'Excellence in\nEducation Since 1972',
    subtitle: 'Shaping future leaders in Dumaguete City through quality education, innovation, and holistic development.',
    cta: 'Explore Programs',
    ctaSecondary: 'Alumni Portal',
  },
  {
    image: heroCampusStudents,
    tag: 'Alumni Network',
    title: 'Stay Connected\nWith Your Alma Mater',
    subtitle: 'Join thousands of Asian College alumni and be part of a thriving community dedicated to giving back.',
    cta: 'Register as Alumni',
    ctaSecondary: 'Sign In',
  },
  {
    image: heroGraduation2,
    tag: 'Tracer & Donation',
    title: 'Track, Engage &\nGive Back',
    subtitle: 'Help us build the future of education by participating in alumni tracer surveys and supporting student scholarships.',
    cta: 'Donate Now',
    ctaSecondary: 'Learn More',
  },
];

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Programs', href: '#programs' },
  { label: 'News & Events', href: '#news' },
  { label: 'Alumni', href: '#alumni' },
  { label: 'Contact', href: '#contact' },
];

const PROGRAMS = [
  {
    dept: 'CSE',
    label: 'Computer Science & Engineering',
    icon: <Monitor className="w-8 h-8" />,
    gradient: `linear-gradient(135deg, ${PURPLE}, #c084fc)`,
    lightBg: '#F5F0FE',
    borderColor: PURPLE,
    badgeBg: '#ede4fc',
    badgeText: PURPLE,
    courses: ['Bachelor of Multimedia Arts', 'BS in Computer Engineering', 'BS in Computer Science', 'BS in Information Technology'],
  },
  {
    dept: 'CTHM',
    label: 'Tourism & Hospitality Management',
    icon: <Coffee className="w-8 h-8" />,
    gradient: `linear-gradient(135deg, ${RED}, #e53e3e)`,
    lightBg: '#FDF0EE',
    borderColor: RED,
    badgeBg: '#fde0db',
    badgeText: RED,
    courses: ['BS in Hospitality Management', 'BS in Tourism Management'],
  },
  {
    dept: 'BAA',
    label: 'Business Administration & Accountancy',
    icon: <Briefcase className="w-8 h-8" />,
    gradient: `linear-gradient(135deg, ${YELLOW}, #fde047)`,
    lightBg: '#FEFCE8',
    borderColor: YELLOW,
    badgeBg: '#fef3c7',
    badgeText: '#a16207',
    courses: ['BS in Accountancy', 'BS in Business Administration Major in Marketing Management', 'BS in Business Administration Major in Financial Management'],
  },
];

const NEWS = [
  {
    date: 'June 5, 2026',
    category: 'Alumni',
    title: 'Annual Alumni Homecoming 2026 Registration Now Open',
    excerpt: 'Join us for the grand Alumni Homecoming celebration this July. Reconnect with classmates and celebrate milestones together.',
    img: heroGraduation2,
    catColor: NAVY,
  },
  {
    date: 'May 28, 2026',
    category: 'Donation',
    title: 'Scholarship Fund Reaches ₱500,000 Milestone',
    excerpt: 'Thanks to generous donations from alumni, the Asian College Scholarship Fund has reached a record high this year.',
    img: heroGraduation1,
    catColor: RED,
  },
  {
    date: 'May 15, 2026',
    category: 'Events',
    title: 'Batch Representative System Successfully Launched',
    excerpt: 'Asian College officially launches its batch representative verification system to streamline alumni database management.',
    img: heroCampusStudents,
    catColor: LBLUE,
  },
];

const STATS = [
  { value: '1,247+', label: 'Registered Alumni', icon: <Users className="w-7 h-7" /> },
  { value: '36+',    label: 'Years of Excellence', icon: <Award className="w-7 h-7" /> },
  { value: '3',      label: 'Departments', icon: <Landmark className="w-7 h-7" /> },
  { value: '10+',    label: 'Degree Programs', icon: <GraduationCap className="w-7 h-7" /> },
  { value: '₱500K+', label: 'Donations Raised', icon: <Heart className="w-7 h-7" /> },
];

const QUICK_LINKS = [
  { label: 'Alumni Registration', icon: <GraduationCap className="w-5 h-5" />, action: 'register' },
  { label: 'Tracer Survey',       icon: <TrendingUp className="w-5 h-5" />,    action: 'login' },
  { label: 'Make a Donation',     icon: <Heart className="w-5 h-5" />,         action: 'login' },
  { label: 'Event Calendar',      icon: <Calendar className="w-5 h-5" />,      action: 'login' },
  { label: 'Alumni Directory',    icon: <Users className="w-5 h-5" />,         action: 'login' },
  { label: 'Admin Portal',        icon: <Shield className="w-5 h-5" />,        action: 'login' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide]   = useState(0);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [scrolled, setScrolled]           = useState(false);
  const [activeProgram, setActiveProgram] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrentSlide(s => (s + 1) % HERO_SLIDES.length), 5500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const slide = HERO_SLIDES[currentSlide];

  return (
    <div className="min-h-screen bg-white" id="home">

      {/* -- Top utility bar -- */}
      <div className="text-white text-xs py-2 px-4" style={{ background: NAVY }}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> (035) 523-5373</span>
            <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> admin@asiancollege.edu.ph</span>
            <span className="hidden md:flex items-center gap-1.5"><Clock className="w-3 h-3" /> Mon–Fri: 8:00 AM – 5:00 PM</span>
          </div>
          <div className="flex items-center gap-3">
            <Facebook className="w-3.5 h-3.5 cursor-pointer hover:opacity-70 transition-opacity" />
            <Twitter  className="w-3.5 h-3.5 cursor-pointer hover:opacity-70 transition-opacity" />
            <Youtube  className="w-3.5 h-3.5 cursor-pointer hover:opacity-70 transition-opacity" />
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> asiancollege.edu.ph</span>
          </div>
        </div>
      </div>

      {/* ===============================================================
          PUBLIC SITE HEADER (logo + top nav bar) starts here.
          This is the header for the logged-out landing page only.
          The logged-in dashboard header is a separate file:
          src/app/components/shared/DashboardLayout.tsx
         =============================================================== */}
      <header className={`sticky top-0 z-50 transition-all duration-300 bg-white ${scrolled ? 'shadow-lg' : 'shadow-sm'}`}>
        {/* Navy accent line */}
        <div className="h-0.5 w-full" style={{ background: PANEL }} />
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <img src={headerLogo} alt="Asian College" className="w-12 h-12 object-contain" />
            <div>
              <div className="font-extrabold text-base leading-tight" style={{ color: RED }}>Asian</div>
              <div className="font-extrabold text-base leading-tight -mt-1" style={{ color: NAVY }}>College</div>
              <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: LBLUE }}>Alumni Tracer & Donation System</div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-white rounded-md transition-all duration-200 relative group"
                style={{ '--hover-bg': NAVY } as any}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = NAVY; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-bold rounded-lg border-2 transition-all duration-200"
              style={{ color: NAVY, borderColor: NAVY }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = NAVY; (e.currentTarget as HTMLElement).style.color = 'white'; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = NAVY; }}
            >
              Sign In
            </button>
            <button onClick={() => navigate('/register')}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-md hover:shadow-lg hover:opacity-90 transition-all duration-200"
              style={{ background: PANEL }}
            >
              Register Now
            </button>
          </div>

          {/* Mobile toggle */}
          <button className="lg:hidden p-2 text-gray-600" onClick={() => setMenuOpen(!menuOpen)}
            style={{ color: NAVY }}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu — smooth slide toggle */}
        <div
          className="lg:hidden overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: menuOpen ? '400px' : '0px', opacity: menuOpen ? 1 : 0 }}
        >
          <div className="bg-white border-t px-4 py-3 shadow-lg space-y-1">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg transition-all duration-200"
                style={{
                  transitionDelay: menuOpen ? `${i * 40}ms` : '0ms',
                }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = NAVY; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
                onClick={() => setMenuOpen(false)}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: LBLUE }} />
                {link.label}
              </a>
            ))}
            <div className="pt-2 pb-1 flex gap-2 border-t mt-2" style={{ borderColor: '#e5e7eb' }}>
              <button
                onClick={() => { navigate('/login'); setMenuOpen(false); }}
                className="flex-1 py-2.5 text-sm font-bold rounded-lg border-2 transition-all"
                style={{ color: NAVY, borderColor: NAVY }}
              >
                Sign In
              </button>
              <button
                onClick={() => { navigate('/register'); setMenuOpen(false); }}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-lg transition-all hover:opacity-90"
                style={{ background: PANEL }}
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* -- Hero Slider -- */}
      <section className="relative h-[580px] md:h-[660px] overflow-hidden">
        {HERO_SLIDES.map((s, i) => (
          <div key={i} className={`absolute inset-0 transition-opacity duration-1000 ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
            <img src={s.image} alt={s.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(27,58,107,0.88) 0%, rgba(27,58,107,0.55) 60%, rgba(27,58,107,0.15) 100%)' }} />
          </div>
        ))}

        <div className="relative z-10 h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
          <div key={currentSlide} className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 text-white text-xs font-bold rounded-full mb-5"
              style={{ background: 'rgba(91,155,213,0.35)', border: '1px solid rgba(91,155,213,0.5)' }}>
              <Star className="w-3 h-3 fill-white" /> {slide.tag}
            </span>
            <h1 className="text-4xl md:text-6xl text-white mb-5 leading-tight drop-shadow-lg whitespace-pre-line">
              {slide.title}
            </h1>
            <p className="text-base md:text-lg text-white/80 mb-8 max-w-xl leading-relaxed">
              {slide.subtitle}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => navigate('/register')}
                className="px-6 py-3 text-white text-sm font-bold rounded-lg shadow-xl flex items-center gap-2 hover:opacity-90 hover:shadow-2xl transition-all"
                style={{ background: PANEL }}>
                {slide.cta} <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/login')}
                className="px-6 py-3 text-white text-sm font-bold rounded-lg transition-all hover:bg-white/20"
                style={{ border: '2px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)' }}>
                {slide.ctaSecondary}
              </button>
            </div>
          </div>
        </div>

        {/* Slide controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
          {HERO_SLIDES.map((_, i) => (
            <button key={i} onClick={() => setCurrentSlide(i)}
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: i === currentSlide ? 32 : 8, background: i === currentSlide ? 'white' : 'rgba(255,255,255,0.45)' }}
            />
          ))}
        </div>
        <button className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full text-white hover:bg-white/20 transition-all"
          style={{ background: 'rgba(255,255,255,0.15)' }}
          onClick={() => setCurrentSlide(s => (s - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}>
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full text-white hover:bg-white/20 transition-all"
          style={{ background: 'rgba(255,255,255,0.15)' }}
          onClick={() => setCurrentSlide(s => (s + 1) % HERO_SLIDES.length)}>
          <ChevronRight className="w-6 h-6" />
        </button>
      </section>

      {/* -- Quick Links Bar -- */}
      <section style={{ background: PANEL }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-white/20">
          {QUICK_LINKS.map((ql, i) => (
            <button key={i} onClick={() => navigate(`/${ql.action}`)}
              className="flex flex-col items-center gap-2 py-5 px-3 text-white hover:bg-white/15 transition-all duration-200 group">
              <div className="group-hover:scale-110 transition-transform duration-200">{ql.icon}</div>
              <span className="text-xs font-semibold text-center leading-tight">{ql.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* -- About -- */}
      <section className="py-20 bg-gray-50" id="about">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full mb-4"
                style={{ background: '#dce6f5', color: NAVY }}>
                About Asian College
              </span>
              <h2 className="text-3xl md:text-4xl text-gray-900 mb-6 leading-tight">
                A Legacy of Excellence in<br />
                <span style={{ color: NAVY }}>Dumaguete City</span>
              </h2>
              <p className="text-gray-600 leading-relaxed mb-5">
                Asian College has been a beacon of quality education in Dumaguete City since 1972. Committed to academic excellence and holistic student development, we have produced thousands of graduates who are now making a difference in their respective fields across the Philippines and beyond.
              </p>
              <p className="text-gray-600 leading-relaxed mb-8">
                Our Alumni Tracer and Donation Management System connects our growing alumni network, enabling meaningful engagement, career tracking, and community-driven scholarship programs that empower the next generation of Asian College students.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: <Shield className="w-5 h-5" />, text: 'CHED Recognized Institution', color: NAVY },
                  { icon: <Award className="w-5 h-5" />, text: 'Award-Winning Programs', color: BLUE },
                  { icon: <Globe className="w-5 h-5" />, text: 'Globally Competitive Graduates', color: LBLUE },
                  { icon: <Star className="w-5 h-5" />, text: 'Excellence Since 1972', color: RED },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                    <div style={{ color: item.color }}>{item.icon}</div>
                    <span className="text-sm font-medium text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img
                src={heroGraduation1}
                alt="Graduation" className="rounded-2xl shadow-2xl w-full object-cover h-80 md:h-[440px]"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-5 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: PANEL }}>
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold" style={{ color: NAVY }}>1,247+</div>
                    <div className="text-xs text-gray-500">Registered Alumni</div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-5 -right-5 rounded-xl shadow-xl p-5 text-white" style={{ background: PANEL }}>
                <div className="text-2xl font-extrabold">36+</div>
                <div className="text-xs opacity-80">Years of Excellence</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -- Stats Bar -- */}
      <section className="py-16" style={{ background: PANEL }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {STATS.map((s, i) => (
              <div key={i} className="text-center group">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 group-hover:bg-white/25 transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <div className="text-white">{s.icon}</div>
                </div>
                <div className="text-3xl font-extrabold text-white mb-1">{s.value}</div>
                <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Programs -- */}
      <section className="py-20 bg-white" id="programs">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full mb-4"
              style={{ background: '#dce6f5', color: NAVY }}>
              Academic Departments
            </span>
            <h2 className="text-3xl md:text-4xl text-gray-900 mb-4">
              Discover Our <span style={{ color: NAVY }}>Programs</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Choose from a range of CHED-recognized programs designed to equip you with the skills and knowledge needed for today's competitive world.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {PROGRAMS.map((p, i) => (
              <button key={i} onClick={() => setActiveProgram(i)}
                className="px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200"
                style={activeProgram === i
                  ? { background: p.gradient, color: 'white', boxShadow: '0 4px 14px rgba(27,58,107,0.3)' }
                  : { background: '#f1f5f9', color: '#64748b' }}>
                {p.dept}
              </button>
            ))}
          </div>

          {/* Active card */}
          {(() => {
            const p = PROGRAMS[activeProgram];
            return (
              <div className="rounded-2xl p-8 md:p-12 border-l-8 shadow-lg transition-all duration-300"
                style={{ background: p.lightBg, borderLeftColor: p.borderColor }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                  <div>
                    <div className="inline-flex p-4 rounded-xl text-white mb-4 shadow-lg" style={{ background: p.gradient }}>
                      {p.icon}
                    </div>
                    <span className="inline-block px-3 py-1 text-xs font-bold rounded-full ml-3"
                      style={{ background: p.badgeBg, color: p.badgeText }}>
                      {p.dept}
                    </span>
                    <h3 className="text-2xl text-gray-900 mt-3 mb-3">{p.label}</h3>
                    <p className="text-gray-600 mb-6">
                      Our {p.dept} department provides world-class education with industry-aligned curriculum, hands-on training, and professional development opportunities.
                    </p>
                    <button onClick={() => navigate('/register')}
                      className="px-6 py-3 text-white rounded-lg font-bold shadow-md hover:shadow-xl hover:opacity-90 transition-all flex items-center gap-2"
                      style={{ background: p.gradient }}>
                      Join as {p.dept} Alumni <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Offered Programs</h4>
                    <div className="space-y-3">
                      {p.courses.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-3 bg-white rounded-lg p-4 shadow-sm">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.borderColor }} />
                          <span className="text-gray-700 text-sm font-medium">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* -- News & Events -- */}
      <section className="py-20 bg-gray-50" id="news">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <div>
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full mb-4"
                style={{ background: '#dce6f5', color: NAVY }}>
                Latest Updates
              </span>
              <h2 className="text-3xl md:text-4xl text-gray-900">
                News & <span style={{ color: NAVY }}>Events</span>
              </h2>
            </div>
            <button onClick={() => navigate('/login')}
              className="flex items-center gap-2 text-sm font-bold hover:opacity-75 transition-opacity"
              style={{ color: NAVY }}>
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {NEWS.map((n, i) => (
              <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
                <div className="relative h-48 overflow-hidden">
                  <img src={n.img} alt={n.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 text-white text-xs font-bold rounded-md" style={{ background: n.catColor }}>
                      {n.category}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                    <Calendar className="w-3 h-3" /> {n.date}
                  </div>
                  <h3 className="text-gray-900 mb-3 leading-snug group-hover:transition-colors" style={{}}
                    onMouseOver={e => (e.currentTarget.style.color = NAVY)}
                    onMouseOut={e => (e.currentTarget.style.color = '')}>
                    {n.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{n.excerpt}</p>
                  <div className="mt-4 flex items-center gap-1 text-sm font-semibold" style={{ color: NAVY }}>
                    Read More <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Alumni CTA -- */}
      <section className="py-20 bg-white" id="alumni">
        <div className="max-w-7xl mx-auto px-6">
          <div className="rounded-3xl overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 60%, ${LBLUE} 100%)` }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute w-80 h-80 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', top: '-15%', right: '-5%' }} />
              <div className="absolute w-56 h-56 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', bottom: '-10%', left: '-5%' }} />
              <div className="absolute inset-0 opacity-5"
                style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
            </div>
            <div className="relative z-10 p-10 md:p-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.9)' }}>
                  <GraduationCap className="w-3.5 h-3.5" /> Alumni Portal
                </div>
                <h2 className="text-3xl md:text-4xl text-white mb-5 leading-tight">
                  Join the Asian College<br />
                  <span style={{ color: '#a8c8f0' }}>Alumni Network</span>
                </h2>
                <p className="leading-relaxed mb-8 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Register now to update your career information, connect with batchmates, participate in surveys, and give back through donations that help current students.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => navigate('/register')}
                    className="px-6 py-3 text-sm font-bold rounded-lg shadow-lg flex items-center gap-2 hover:opacity-90 transition-all"
                    style={{ background: 'white', color: NAVY }}>
                    Register as Alumni <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => navigate('/login')}
                    className="px-6 py-3 text-sm font-bold text-white rounded-lg hover:bg-white/20 transition-all"
                    style={{ border: '2px solid rgba(255,255,255,0.5)' }}>
                    Sign In
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: <Users className="w-6 h-6" />, label: 'Alumni Directory', desc: 'Find & connect with batchmates' },
                  { icon: <TrendingUp className="w-6 h-6" />, label: 'Tracer Survey', desc: 'Share your career journey' },
                  { icon: <Heart className="w-6 h-6" />, label: 'Donations', desc: 'Support student scholarships' },
                  { icon: <Calendar className="w-6 h-6" />, label: 'Events', desc: 'Homecomings & reunions' },
                  { icon: <Shield className="w-6 h-6" />, label: 'Batch Reps', desc: 'Peer-verification system' },
                  { icon: <Award className="w-6 h-6" />, label: 'Analytics', desc: 'Alumni engagement statistics' },
                ].map((item, i) => (
                  <div key={i} onClick={() => navigate('/login')}
                    className="rounded-xl p-4 cursor-pointer transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
                    onMouseOut={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                  >
                    <div style={{ color: '#a8c8f0' }}>{item.icon}</div>
                    <div className="text-white text-sm font-bold mt-2 mb-1">{item.label}</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -- Contact -- */}
      <section className="py-20 bg-gray-50" id="contact">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full mb-4"
              style={{ background: '#dce6f5', color: NAVY }}>
              Get In Touch
            </span>
            <h2 className="text-3xl md:text-4xl text-gray-900 mb-4">
              Contact <span style={{ color: NAVY }}>Us</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">Reach out to the Alumni Admin Office for any concerns or inquiries about the Alumni Tracer System.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Phone className="w-7 h-7" />, label: 'Phone', value: '(035) 523-5373', sub: 'Mon–Fri: 8:00 AM – 5:00 PM', bg: '#EEF2FA', border: '#dce6f5', iconColor: NAVY },
              { icon: <Mail className="w-7 h-7" />, label: 'Email', value: 'admin@asiancollege.edu.ph', sub: 'Response within 24 hours', bg: '#FDF0EE', border: '#fde0db', iconColor: RED },
              { icon: <MapPin className="w-7 h-7" />, label: 'Address', value: 'Dr. V. Locsin Street', sub: 'Dumaguete City, Philippines 6200', bg: '#EDF5FB', border: '#d6ecf8', iconColor: LBLUE },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-8 text-center hover:shadow-lg transition-all duration-300"
                style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-md mb-5">
                  <div style={{ color: c.iconColor }}>{c.icon}</div>
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{c.label}</h4>
                <p className="font-semibold text-gray-900 mb-1">{c.value}</p>
                <p className="text-sm text-gray-500">{c.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Footer -- */}
      <footer className="text-white pt-16 pb-6" style={{ background: NAVY }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <img src={asianCollegeLogo} alt="Asian College" className="w-12 h-12 object-contain rounded-lg bg-white/10 p-1" />
                <div>
                  <div className="font-extrabold text-lg text-white leading-tight">Asian College</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Dumaguete City, Philippines</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Building stronger alumni connections, tracking careers, and empowering the next generation through education and community support.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ background: '#1877F2' }}>
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="#" className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ background: '#1DA1F2' }}>
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ background: '#FF0000' }}>
                  <Youtube className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest mb-5 pb-3" style={{ color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                Quick Links
              </h4>
              <ul className="space-y-2.5">
                {['About Asian College', 'Alumni Registration', 'Alumni Directory', 'Tracer Survey', 'Event Calendar', 'Donate Now'].map(l => (
                  <li key={l}>
                    <button onClick={() => navigate('/login')}
                      className="text-sm flex items-center gap-2 group transition-colors hover:text-white"
                      style={{ color: 'rgba(255,255,255,0.55)' }}>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" style={{ color: LBLUE }} />
                      {l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Departments */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest mb-5 pb-3" style={{ color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                Departments
              </h4>
              <ul className="space-y-4">
                {PROGRAMS.map(p => (
                  <li key={p.dept}>
                    <div className="text-sm font-bold text-white">{p.dept}</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.label}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest mb-5 pb-3" style={{ color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                Contact Info
              </h4>
              <ul className="space-y-3">
                {[
                  { icon: <MapPin className="w-4 h-4" />, text: 'Dr. V. Locsin Street, Dumaguete City, Philippines 6200' },
                  { icon: <Phone className="w-4 h-4" />, text: '(035) 523-5373' },
                  { icon: <Mail className="w-4 h-4" />, text: 'admin@asiancollege.edu.ph' },
                  { icon: <Globe className="w-4 h-4" />, text: 'asiancollege.edu.ph' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <div className="flex-shrink-0 mt-0.5" style={{ color: LBLUE }}>{item.icon}</div>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
            <p>© 2026 Asian College – Dumaguete Campus (Official). All rights reserved.</p>
            <p>RA 10173 & RA 10175 Compliant · Data Privacy Protected</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
