import { useState, useRef, useEffect } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const REQUIRED_FIELDS = [
  'firstName', 'lastName',
  'home_address_1', 'home_city', 'home_state', 'home_zip',
  'insurance_provider', 'insurance_plan',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const INSURANCE_PROVIDERS = [
  'Aetna', 'Cigna', 'UnitedHealthcare', 'Blue Cross Blue Shield',
  'Medicare', 'Medicaid', 'Humana', 'Kaiser Permanente', 'Anthem',
];

// ─── Mock Providers ───────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: 1,
    name: 'Dr. Sarah Chen',
    title: 'Licensed Clinical Psychologist',
    specialties: ['Anxiety', 'Depression', 'Trauma & PTSD'],
    approach: 'CBT',
    languages: ['English', 'Mandarin'],
    availability: 'Tomorrow 2PM',
    avatar: 'SC',
    color: '#00BCD4',
  },
  {
    id: 2,
    name: 'Dr. Marcus Rivera',
    title: 'Marriage & Family Therapist',
    specialties: ['Relationship Issues', 'Family Conflict', 'Life Transitions'],
    approach: 'EFT',
    languages: ['English', 'Spanish'],
    availability: 'Today 5PM',
    avatar: 'MR',
    color: '#26C6DA',
  },
  {
    id: 3,
    name: 'Dr. Aisha Okonkwo',
    title: 'Psychiatrist & Therapist',
    specialties: ['Bipolar Disorder', 'ADHD', 'Anxiety'],
    approach: 'Integrative Psychiatry',
    languages: ['English'],
    availability: 'Fri 10AM',
    avatar: 'AO',
    color: '#00ACC1',
  },
  {
    id: 4,
    name: 'James Whitfield, LCSW',
    title: 'Licensed Clinical Social Worker',
    specialties: ['Stress & Burnout', 'Grief & Loss'],
    approach: 'Mindfulness-Based CBT',
    languages: ['English'],
    availability: 'Mon 9AM',
    avatar: 'JW',
    color: '#0097A7',
  },
];

const DEFAULT_MATCHES = [
  { providerId: 1, score: 93, reason: 'Specializes in the symptoms you described with proven outcomes.' },
  { providerId: 2, score: 86, reason: 'Strong fit based on your concerns and scheduling needs.' },
  { providerId: 3, score: 78, reason: 'Available soon with relevant expertise.' },
  { providerId: 4, score: 71, reason: 'Flexible scheduling and mindfulness-based approach.' },
];

// ─── Shared Sub-components ────────────────────────────────────────────────────
function Avatar({ initials, color, size = 40 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Profile Page Components ──────────────────────────────────────────────────
function DonutChart({ percentage, size = 88 }) {
  const r = size * 0.36;
  const circ = 2 * Math.PI * r;
  const center = size / 2;
  const dashOffset = circ - (percentage / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={size * 0.09} />
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke="#FF9800" strokeWidth={size * 0.09}
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.23, fontWeight: 700, color: '#FF9800', lineHeight: 1 }}>
          {percentage}%
        </span>
        <span style={{ fontSize: size * 0.12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>done</span>
      </div>
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{
      background: '#E3F2FD', padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: '8px 8px 0 0', marginTop: 16,
    }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: '#1a237e' }}>{title}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="#1a237e" opacity="0.7">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    </div>
  );
}

function FormField({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <label style={{ display: 'block', fontSize: 11, color: error ? '#F44336' : '#666', marginBottom: 4, fontWeight: 500 }}>
        {label}{required && <span style={{ color: '#F44336', marginLeft: 2 }}>*</span>}
        {error && <span style={{ marginLeft: 6, fontWeight: 400 }}>— {error}</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', border: '1.5px solid #E0E0E0', borderRadius: 8,
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', color: '#111', background: '#FAFAFA',
};

function errorInputStyle(hasError) {
  return hasError
    ? { ...inputStyle, borderColor: '#F44336', background: '#FFF5F5' }
    : inputStyle;
}

const FIELD_LABELS = {
  firstName: 'First Name', lastName: 'Last Name',
  home_address_1: 'Street Address', home_city: 'City',
  home_state: 'State', home_zip: 'ZIP Code',
  insurance_provider: 'Insurance Provider', insurance_plan: 'Insurance Plan',
};

function ProfilePage({ onStartChat }) {
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('appy_profile') || '{}'); }
    catch { return {}; }
  });
  const [errors, setErrors] = useState({});

  function updateField(field, value) {
    setProfile(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  }

  const filledCount = REQUIRED_FIELDS.filter(f => (profile[f] || '').trim()).length;
  const percentage = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);
  const initials = ((profile.firstName || '')[0] || '') + ((profile.lastName || '')[0] || '');
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Your Name';

  function handleSave() {
    const newErrors = {};
    REQUIRED_FIELDS.forEach(f => {
      if (!(profile[f] || '').trim()) newErrors[f] = 'required';
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to first error section
      const firstField = REQUIRED_FIELDS.find(f => newErrors[f]);
      const sectionMap = {
        firstName: 'demographic', lastName: 'demographic',
        home_address_1: 'address', home_city: 'address', home_state: 'address', home_zip: 'address',
        insurance_provider: 'insurance', insurance_plan: 'insurance',
      };
      const section = sectionMap[firstField];
      document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    localStorage.setItem('appy_profile', JSON.stringify(profile));
    onStartChat(profile);
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F4F6F8', display: 'flex',
      justifyContent: 'center', fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 430, minHeight: '100vh', background: '#fff',
        display: 'flex', flexDirection: 'row', boxShadow: '0 0 40px rgba(0,0,0,0.08)',
      }}>
        {/* Left Sidebar */}
        <div style={{
          width: 68, background: '#1a237e', display: 'flex', flexDirection: 'column',
          alignItems: 'center', paddingTop: 16, gap: 2, flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: '#00BCD4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#fff"/>
            </svg>
          </div>

          {[
            {
              id: 'demographic', label: 'Profile',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
            },
            {
              id: 'address', label: 'Address',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>,
            },
            {
              id: 'insurance', label: 'Insurance',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>,
            },
          ].map(item => (
            <a key={item.id} href={`#section-${item.id}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '9px 4px', borderRadius: 8, textDecoration: 'none',
                color: 'rgba(255,255,255,0.65)', fontSize: 9, gap: 3,
                width: 56, textAlign: 'center', transition: 'all 0.15s',
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Profile Header */}
          <div style={{ background: '#1a237e', color: '#fff', padding: '18px 14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, color: 'rgba(255,255,255,0.55)', marginBottom: 14 }}>
              MY PROFILE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', background: '#00BCD4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: 0.5,
              }}>
                {initials || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>
                  {filledCount} / {REQUIRED_FIELDS.length} required fields filled
                </div>
              </div>
              <DonutChart percentage={percentage} size={80} />
            </div>
          </div>

          {/* Form Sections */}
          <div style={{ padding: '4px 14px 24px', flex: 1 }}>

            {/* Section 1: Personal Info */}
            <div id="section-demographic">
              <SectionHeader title="Personal Information" />
              <div style={{ border: '1px solid #E3F2FD', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '14px 12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormField label="First Name" required error={errors.firstName && 'required'}>
                    <input style={errorInputStyle(errors.firstName)} value={profile.firstName || ''}
                      onChange={e => updateField('firstName', e.target.value)} placeholder="Jane" />
                  </FormField>
                  <FormField label="Last Name" required error={errors.lastName && 'required'}>
                    <input style={errorInputStyle(errors.lastName)} value={profile.lastName || ''}
                      onChange={e => updateField('lastName', e.target.value)} placeholder="Doe" />
                  </FormField>
                </div>
                <FormField label="Date of Birth">
                  <input type="date" style={inputStyle} value={profile.birthDate || ''}
                    onChange={e => updateField('birthDate', e.target.value)} />
                </FormField>
                <FormField label="Gender">
                  <select style={inputStyle} value={profile.gender || ''}
                    onChange={e => updateField('gender', e.target.value)}>
                    <option value="">Select...</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </FormField>
              </div>
            </div>

            {/* Section 2: Address */}
            <div id="section-address">
              <SectionHeader title="Address Information" />
              <div style={{ border: '1px solid #E3F2FD', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '14px 12px' }}>
                <FormField label="Street Address" required error={errors.home_address_1 && 'required'}>
                  <input style={errorInputStyle(errors.home_address_1)} value={profile.home_address_1 || ''}
                    onChange={e => updateField('home_address_1', e.target.value)} placeholder="123 Main St" />
                </FormField>
                <FormField label="City" required error={errors.home_city && 'required'}>
                  <input style={errorInputStyle(errors.home_city)} value={profile.home_city || ''}
                    onChange={e => updateField('home_city', e.target.value)} placeholder="San Francisco" />
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormField label="State" required error={errors.home_state && 'required'}>
                    <select style={errorInputStyle(errors.home_state)} value={profile.home_state || ''}
                      onChange={e => updateField('home_state', e.target.value)}>
                      <option value="">Select...</option>
                      {US_STATES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </FormField>
                  <FormField label="ZIP Code" required error={errors.home_zip && 'required'}>
                    <input style={errorInputStyle(errors.home_zip)} value={profile.home_zip || ''}
                      onChange={e => updateField('home_zip', e.target.value)}
                      placeholder="94102" maxLength={5} />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Section 3: Insurance */}
            <div id="section-insurance">
              <SectionHeader title="Insurance Information" />
              <div style={{ border: '1px solid #E3F2FD', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '14px 12px' }}>
                <FormField label="Insurance Provider" required error={errors.insurance_provider && 'required'}>
                  <select style={errorInputStyle(errors.insurance_provider)} value={profile.insurance_provider || ''}
                    onChange={e => updateField('insurance_provider', e.target.value)}>
                    <option value="">Select...</option>
                    {INSURANCE_PROVIDERS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </FormField>
                <FormField label="Insurance Plan" required error={errors.insurance_plan && 'required'}>
                  <select style={errorInputStyle(errors.insurance_plan)} value={profile.insurance_plan || ''}
                    onChange={e => updateField('insurance_plan', e.target.value)}>
                    <option value="">Select...</option>
                    {['PPO', 'HMO', 'EPO', 'POS'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </FormField>
                <FormField label="Member ID">
                  <input style={inputStyle} value={profile.member_id || ''}
                    onChange={e => updateField('member_id', e.target.value)} placeholder="e.g. ABC123456" />
                </FormField>
              </div>
            </div>

            {/* Validation error summary */}
            {Object.keys(errors).length > 0 && (
              <div style={{
                marginTop: 16, padding: '10px 14px', borderRadius: 8,
                background: '#FFF5F5', border: '1.5px solid #FFCDD2',
                fontSize: 12, color: '#C62828', lineHeight: 1.6,
              }}>
                <strong>Please complete all required fields before starting:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {REQUIRED_FIELDS.filter(f => errors[f]).map(f => (
                    <li key={f}>{FIELD_LABELS[f]}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Save & Start */}
            <button onClick={handleSave} style={{
              width: '100%', marginTop: 14,
              background: percentage === 100 ? '#1a237e' : '#546E7A',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3,
            }}>
              {percentage === 100 ? 'Save & Start Chat ✓' : `Save & Start Chat (${filledCount}/${REQUIRED_FIELDS.length} required filled)`}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus { border-color: #00BCD4 !important; background: #fff !important; outline: none; }
        a:hover > svg, a:hover > span { opacity: 1; }
      `}</style>
    </div>
  );
}

// ─── Chat Page Components ─────────────────────────────────────────────────────
function ProviderCard({ provider, score, reason, isBest }) {
  return (
    <div style={{
      border: isBest ? '2px solid #00BCD4' : '1.5px solid #E0E0E0',
      borderRadius: 14, padding: '14px 16px', background: '#fff',
      marginBottom: 10, position: 'relative',
      boxShadow: isBest ? '0 2px 12px rgba(0,188,212,0.13)' : 'none',
    }}>
      {isBest && (
        <div style={{
          position: 'absolute', top: -12, left: 14, background: '#00BCD4', color: '#fff',
          fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 10px', letterSpacing: 0.5,
        }}>
          Best Match
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Avatar initials={provider.avatar} color={provider.color} size={46} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{provider.name}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 1 }}>{provider.title}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>
            {provider.languages.join(' · ')} &nbsp;|&nbsp; {provider.approach}
          </div>
        </div>
        <div style={{
          background: isBest ? '#00BCD4' : '#F5F5F5', color: isBest ? '#fff' : '#333',
          borderRadius: 20, padding: '4px 10px', fontWeight: 700, fontSize: 15, flexShrink: 0,
        }}>
          {score}%
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {provider.specialties.map((s) => (
          <span key={s} style={{
            background: '#E0F7FA', color: '#00838F', borderRadius: 20,
            padding: '2px 10px', fontSize: 11, fontWeight: 500,
          }}>
            {s}
          </span>
        ))}
      </div>
      {reason && (
        <div style={{
          fontSize: 12, color: '#555', background: '#F9F9F9', borderRadius: 8,
          padding: '6px 10px', marginBottom: 10, lineHeight: 1.5,
        }}>
          {reason}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: '#888' }}>
          Next available: <strong style={{ color: '#333' }}>{provider.availability}</strong>
        </div>
        <button
          style={{
            background: '#111', color: '#fff', border: 'none', borderRadius: 20,
            padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
          onClick={() => alert(`Booking with ${provider.name}...`)}
        >
          Book
        </button>
      </div>
    </div>
  );
}

function MatchResults({ matches }) {
  if (!matches || matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => b.score - a.score);
  return (
    <div style={{ marginTop: 8 }}>
      {sorted.map((m, i) => {
        const provider = PROVIDERS.find((p) => p.id === m.providerId);
        if (!provider) return null;
        return <ProviderCard key={provider.id} provider={provider} score={m.score} reason={m.reason} isBest={i === 0} />;
      })}
    </div>
  );
}

const STATE_LABELS = {
  symptom_collection: { label: 'Step 1 of 2 — Symptoms', color: '#FF9800' },
  insurance_collection: { label: 'Step 2 of 2 — Insurance', color: '#7C4DFF' },
  done: { label: 'Matched!', color: '#00BCD4' },
  emergency: { label: 'Emergency', color: '#F44336' },
};

function StateBadge({ state }) {
  const info = STATE_LABELS[state];
  if (!info) return null;
  return (
    <div style={{
      background: info.color + '1A', color: info.color, fontSize: 11, fontWeight: 600,
      borderRadius: 20, padding: '3px 12px', display: 'inline-block', letterSpacing: 0.3,
    }}>
      {info.label}
    </div>
  );
}

function ChatBubble({ msg }) {
  const isAI = msg.role === 'assistant';
  return (
    <div style={{
      display: 'flex', flexDirection: isAI ? 'row' : 'row-reverse',
      alignItems: 'flex-start', gap: 8, marginBottom: 16,
    }}>
      {isAI && <Avatar initials="AI" color="#00BCD4" size={34} />}
      <div style={{ maxWidth: isAI ? '85%' : '75%' }}>
        {msg.text && (
          <div style={{
            background: isAI ? '#E0F7FA' : '#111',
            color: isAI ? '#004D5A' : '#fff',
            borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
            padding: '10px 14px', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap',
          }}>
            {msg.text}
          </div>
        )}
        {isAI && msg.matches && <MatchResults matches={msg.matches} />}
      </div>
    </div>
  );
}

function ChatPage({ userProfile, onEditProfile }) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [sessionState, setSessionState] = useState('greeting');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const profilePayload = userProfile && Object.keys(userProfile).length > 0 ? userProfile : undefined;

  // Auto-fetch greeting on mount
  useEffect(() => {
    async function fetchGreeting() {
      setLoading(true);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, user_profile: profilePayload }),
        });
        const data = await res.json();
        setSessionState(data.state);
        setMessages([{ id: 0, role: 'assistant', text: data.reply, matches: null }]);
      } catch {
        setMessages([{ id: 0, role: 'assistant', text: 'Could not connect to server. Please make sure the backend is running on port 8000.', matches: null }]);
      } finally {
        setLoading(false);
      }
    }
    fetchGreeting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg = { id: Date.now(), role: 'user', text, matches: null };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_message: text, user_profile: profilePayload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'API error');
      }

      const data = await res.json();
      setSessionState(data.state);
      const matches = data.state === 'done' ? DEFAULT_MATCHES : null;

      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', text: data.reply, matches }]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', text: `Error: ${err.message}`, matches: null }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function getSupportedMimeType() {
    const candidates = [
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/webm', ext: 'webm' },
      { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
      { mime: 'audio/mp4', ext: 'mp4' },
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return { mime: '', ext: 'webm' };
  }

  const inputDisabled = loading || sessionState === 'emergency';

  async function startRecording() {
    if (isRecording || inputDisabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const { mime, ext } = getSupportedMimeType();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const actualMime = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        await transcribeAudio(blob, ext);
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied: ' + err.message);
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setTranscribing(true);
  }

  async function transcribeAudio(blob, ext = 'webm') {
    const apiKey = (import.meta.env.VITE_OPENAI_API_KEY || '').replace(/[^\x20-\x7E]/g, '');
    if (!apiKey) { alert('VITE_OPENAI_API_KEY is not set in .env'); setTranscribing(false); return; }
    const formData = new FormData();
    formData.append('file', new File([blob], `recording.${ext}`, { type: blob.type }));
    formData.append('model', 'whisper-1');
    try {
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
      const text = data.text?.trim();
      if (text) {
        setInput((prev) => (prev ? prev + ' ' + text : text));
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
      }
    } catch (err) {
      alert('Transcription error: ' + err.message);
    } finally {
      setTranscribing(false);
    }
  }

  const firstName = userProfile?.firstName || '';

  return (
    <div style={{
      minHeight: '100vh', background: '#F4F6F8', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 430, minHeight: '100vh', background: '#fff',
        display: 'flex', flexDirection: 'column', boxShadow: '0 0 40px rgba(0,0,0,0.08)',
      }}>
        {/* Header */}
        <div style={{
          background: '#fff', borderBottom: '1.5px solid #F0F0F0',
          padding: '14px 20px 10px', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: '#00BCD4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#fff"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#111', letterSpacing: -0.3 }}>
                Appy Health{firstName ? ` · Hi, ${firstName}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#00BCD4', fontWeight: 500, letterSpacing: 0.4 }}>
                AI PROVIDER MATCHING
              </div>
            </div>
            {/* Edit Profile button */}
            <button
              onClick={onEditProfile}
              title="Edit Profile"
              style={{
                background: '#F5F5F5', border: 'none', borderRadius: 8,
                padding: '6px 10px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 4, fontSize: 12, color: '#555', fontWeight: 500,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#555">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              Profile
            </button>
          </div>
          <StateBadge state={sessionState} />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
          {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Avatar initials="AI" color="#00BCD4" size={34} />
              <div style={{
                background: '#E0F7FA', borderRadius: '4px 16px 16px 16px',
                padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center',
              }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#00BCD4',
                    animation: `bounce 1s ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{
          borderTop: '1.5px solid #F0F0F0', padding: '10px 12px', background: '#fff',
          display: 'flex', gap: 8, alignItems: 'flex-end',
        }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={transcribing ? '🎙 Transcribing...' : input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKey}
            disabled={inputDisabled || transcribing}
            placeholder={
              sessionState === 'emergency' ? 'Please contact emergency services.'
              : isRecording ? '🔴 Recording... tap mic to stop'
              : 'Type or tap mic to speak...'
            }
            style={{
              flex: 1, resize: 'none',
              border: isRecording ? '1.5px solid #F44336' : '1.5px solid #E0E0E0',
              borderRadius: 22, padding: '10px 16px', fontSize: 14, fontFamily: 'inherit',
              outline: 'none', lineHeight: 1.45, overflowY: 'hidden', color: '#111',
              background: inputDisabled || transcribing ? '#F5F5F5' : '#FAFAFA',
              cursor: inputDisabled ? 'not-allowed' : 'text',
            }}
          />

          {/* Mic button */}
          <button
            onMouseDown={startRecording} onMouseUp={stopRecording}
            onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
            disabled={inputDisabled || transcribing}
            title={isRecording ? 'Release to send' : 'Hold to record'}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: isRecording ? '#F44336' : transcribing ? '#FF9800' : '#00BCD4',
              color: '#fff', cursor: inputDisabled || transcribing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              animation: isRecording ? 'pulse 1s infinite' : 'none',
            }}
          >
            {transcribing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="currentColor"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor"/>
              </svg>
            )}
          </button>

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={inputDisabled || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: inputDisabled || !input.trim() ? '#BDBDBD' : '#111',
              color: '#fff', cursor: inputDisabled || !input.trim() ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,67,54,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(244,67,54,0); }
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F4F6F8; }
        textarea:focus { border-color: #00BCD4 !important; background: #fff !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #E0E0E0; border-radius: 4px; }
      `}</style>
    </div>
  );
}

// ─── Main App (View Switcher) ─────────────────────────────────────────────────
export default function App() {
  const [userProfile, setUserProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('appy_profile') || '{}'); }
    catch { return {}; }
  });

  const [view, setView] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem('appy_profile') || '{}');
      if (REQUIRED_FIELDS.every(f => (p[f] || '').trim())) return 'chat';
    } catch {}
    return 'profile';
  });

  function handleStartChat(profile) {
    setUserProfile(profile);
    setView('chat');
  }

  if (view === 'profile') {
    return <ProfilePage onStartChat={handleStartChat} />;
  }

  return (
    <ChatPage
      userProfile={userProfile}
      onEditProfile={() => setView('profile')}
    />
  );
}
