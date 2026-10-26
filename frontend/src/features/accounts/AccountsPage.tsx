import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, clearToken, errorMessage, getToken, setToken } from '../../api/client';

type User = {
  name: string;
  email: string;
  phone: string;
  role: string;
};

type Passenger = {
  id: number;
  name: string;
  age: number;
  gender: string;
};

type ApiUser = {
  user_id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
};

type ApiPassenger = {
  passenger_id: number;
  full_name: string;
  age: number;
  gender: string;
};

const toUser = (user: ApiUser): User => ({
  name: user.full_name,
  email: user.email,
  phone: user.phone ?? '',
  role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
});

const toPassenger = (passenger: ApiPassenger): Passenger => ({
  id: passenger.passenger_id,
  name: passenger.full_name,
  age: passenger.age,
  gender: passenger.gender,
});

const MAX_PASSENGERS = 10;

export default function AccountsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const returnTo = (useLocation().state as { from?: string } | null)?.from;

  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(() => getToken() !== null);

  const [page, setPage] = useState<'login' | 'register' | 'dashboard' | 'profile' | 'passengers'>(
    'login',
  );
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [pName, setPName] = useState('');
  const [pAge, setPAge] = useState('');
  const [pGender, setPGender] = useState('Female');

  // Resume the session when a token from an earlier visit is still valid.
  useEffect(() => {
    if (!getToken()) return;
    api
      .get<ApiUser>('/me')
      .then((res) => setUser(toUser(res.data)))
      .catch(() => clearToken())
      .finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    setPage('dashboard');
    api
      .get<ApiPassenger[]>('/me/passengers')
      .then((res) => setPassengers(res.data.map(toPassenger)))
      .catch(() => setPassengers([]));
  }, [user]);

  function signedIn(token: string, apiUser: ApiUser) {
    setToken(token);
    // Reservations and wallet data cached for a previous user must not leak to this one.
    queryClient.clear();
    setPassword('');
    setUser(toUser(apiUser));
    if (returnTo) navigate(returnTo, { replace: true });
  }

  async function register() {
    setMessage('');

    if (!name.trim() || !email.trim() || !password || !phone.trim()) {
      setMessage('Please fill in all fields.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must contain at least 8 characters.');
      return;
    }
    if (!/^[6-9][0-9]{9}$/.test(phone.trim())) {
      setMessage('Enter a 10-digit Indian mobile number.');
      return;
    }

    try {
      const res = await api.post<{ access_token: string; user: ApiUser }>('/auth/signup', {
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      });
      signedIn(res.data.access_token, res.data.user);
      setMessage('Account created successfully!');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function login() {
    setMessage('');
    try {
      const res = await api.post<{ access_token: string; user: ApiUser }>('/auth/login', {
        email: email.trim(),
        password,
      });
      signedIn(res.data.access_token, res.data.user);
      setPage('dashboard');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  function logout() {
    clearToken();
    queryClient.clear();
    setUser(null);
    setPassengers([]);
    setPage('login');
    setPassword('');
    setMessage('');
  }

  async function updateProfile() {
    if (!user) return;
    if (!name.trim() || !phone.trim()) {
      setMessage('Name and phone number are required.');
      return;
    }
    try {
      const res = await api.patch<ApiUser>('/me', {
        full_name: name.trim(),
        phone: phone.trim(),
      });
      setUser(toUser(res.data));
      setMessage('Profile updated successfully.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  function openProfile() {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone);
    setMessage('');
    setPage('profile');
  }

  async function savePassenger() {
    if (!user) return;
    const age = Number(pAge);

    if (!pName.trim() || !pAge || age < 1 || age > 120) {
      setMessage('Enter a valid passenger name and age (1–120).');
      return;
    }
    if (passengers.length >= MAX_PASSENGERS) {
      setMessage(`You can save a maximum of ${MAX_PASSENGERS} passengers.`);
      return;
    }

    try {
      const res = await api.post<ApiPassenger>('/me/passengers', {
        full_name: pName.trim(),
        age,
        gender: pGender,
      });
      setPassengers((current) => [...current, toPassenger(res.data)]);
      queryClient.invalidateQueries({ queryKey: ['saved_passengers'] });
      setPName('');
      setPAge('');
      setMessage('Passenger added successfully.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function removePassenger(id: number) {
    if (!user) return;
    try {
      await api.delete(`/me/passengers/${id}`);
      setPassengers((current) => current.filter((passenger) => passenger.id !== id));
      queryClient.invalidateQueries({ queryKey: ['saved_passengers'] });
      setMessage('Passenger removed.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone);
    }
  }, [user]);

  // Reads the shared tokens from styles.css (see Design.md), so it follows light and dark mode.
  const styles = `
    .yatrio { width: min(100% - 32px, 64rem); margin: 0 auto; padding: 48px 0 96px; color: var(--ink); }
    .y-nav { display: flex; justify-content: center; margin-bottom: 48px; }
    .y-nav-actions { display: inline-flex; flex-wrap: wrap; justify-content: center; gap: 4px; padding: 4px; background: var(--canvas-soft); border-radius: var(--r-full); }
    .y-nav button { height: 40px; padding: 0 18px; border: 0; border-radius: var(--r-full); background: transparent; color: var(--muted); font-weight: var(--w-strong); }
    .y-nav button:hover { color: var(--ink); }
    .y-nav button.active { background: var(--canvas); color: var(--ink); box-shadow: var(--segment-shadow); }
    .y-main { max-width: 64rem; margin: 0 auto; }
    .y-card { background: var(--canvas); border: 1px solid var(--hairline); border-radius: var(--r-md); padding: 32px; }
    .y-auth { max-width: 30rem; margin: 16px auto 0; padding: 40px; }
    .y-kicker { display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border-radius: var(--r-full); background: var(--canvas-soft); color: var(--ink); font-size: 12px; font-weight: var(--w-strong); }
    .y-title { margin: 16px 0 8px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1; }
    .y-auth .y-title { font-size: 2rem; line-height: 1.13; }
    .y-sub { margin: 0 0 32px; color: var(--muted); font-size: 1.25rem; font-weight: var(--w-light); line-height: 1.38; }
    .y-auth .y-sub { font-size: 1rem; font-weight: var(--w-body); margin-bottom: 28px; }
    .y-form { display: grid; gap: 16px; }
    .y-field label { display: block; font-size: 13px; font-weight: var(--w-strong); color: var(--muted); margin-bottom: 8px; }
    .y-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 20px; border: 1px solid transparent; border-radius: var(--r-full); background: var(--primary); color: var(--on-primary); font-weight: var(--w-strong); font-size: 1rem; }
    .y-btn:hover { background: var(--primary-hover); }
    .y-form > .y-btn { min-height: 48px; margin-top: 8px; }
    .y-btn.secondary { background: var(--canvas); color: var(--ink); border-color: var(--hairline); }
    .y-btn.secondary:hover { border-color: var(--ink); }
    .y-btn.danger { background: var(--canvas); color: var(--danger); border-color: var(--hairline); min-height: 36px; padding: 0 14px; font-size: 14px; }
    .y-btn.danger:hover { border-color: var(--danger); }
    .y-switch { color: var(--muted); font-size: 14px; text-align: center; margin: 24px 0 0; }
    .y-link { border: 0; background: transparent; padding: 0; color: var(--ink); font-weight: var(--w-strong); text-decoration: underline; text-underline-offset: 3px; }
    .y-message { background: var(--canvas-soft); color: var(--ink); padding: 12px 18px; border-radius: var(--r-sm); margin: 4px 0; font-size: 14px; font-weight: var(--w-strong); }
    .y-message.error { background: var(--danger-soft); color: var(--danger); }
    .y-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 8px; }
    .y-stat { padding: 24px; border-radius: var(--r-md); background: var(--canvas-soft); }
    .y-stat strong { display: block; font-size: 2.75rem; font-weight: var(--w-heading); line-height: 1.13; margin: 12px 0 4px; font-variant-numeric: tabular-nums; }
    .y-muted { color: var(--muted); font-size: 14px; }
    .y-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .y-card h2 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 16px; }
    .y-card .y-row h2 { margin: 0; }
    .y-card .y-row p { margin: 4px 0 0; }
    .y-details { display: grid; margin: 24px 0; }
    .y-details > div { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--hairline-soft); }
    .y-details dt { color: var(--muted); }
    .y-details dd { margin: 0; font-weight: var(--w-strong); text-align: right; overflow-wrap: anywhere; }
    .y-list { display: grid; gap: 8px; margin-top: 24px; }
    .y-person { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 12px 12px 14px; border-radius: var(--r-sm); background: var(--canvas-soft); }
    .y-avatar { width: 44px; height: 44px; display: grid; place-items: center; background: var(--primary); color: var(--on-primary); font-weight: var(--w-heading); border-radius: var(--r-squircle); flex-shrink: 0; }
    .y-person-info { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .y-person-info strong { display: block; font-weight: var(--w-strong); }
    .y-person-info small { display: block; color: var(--muted); margin-top: 2px; font-size: 14px; }
    @media (max-width: 560px) { .yatrio { padding-top: 32px; } .y-card, .y-auth { padding: 24px; } }
  `;

  return (
    <div className="yatrio">
      <style>{styles}</style>
      {user && (
        <header className="y-nav">
          <nav className="y-nav-actions" aria-label="Account navigation">
            <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>Dashboard</button>
            <button className={page === 'profile' ? 'active' : ''} onClick={openProfile}>My Profile</button>
            <button className={page === 'passengers' ? 'active' : ''} onClick={() => { setMessage(''); setPage('passengers'); }}>Passengers</button>
            <button onClick={logout}>Log out</button>
          </nav>
        </header>
      )}

      <main className="y-main">
        {restoring && <p className="y-muted" role="status">Restoring your session…</p>}

        {!restoring && !user && page === 'login' && (
          <section className="y-card y-auth">
            <div className="y-kicker">Welcome aboard</div>
            <h1 className="y-title">Sign in to RailYatri</h1>
            <p className="y-sub">Log in to manage your account and saved passengers.</p>
            <form className="y-form" onSubmit={(event) => { event.preventDefault(); login(); }}>
              <div className="y-field"><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              {message && <div className="y-message error" role="alert">{message}</div>}
              <button className="y-btn" type="submit">Sign in →</button>
            </form>
            <p className="y-switch">New to RailYatri? <button className="y-link" onClick={() => { setPage('register'); setMessage(''); }}>Create an account</button></p>
          </section>
        )}

        {!user && page === 'register' && (
          <section className="y-card y-auth">
            <div className="y-kicker">Start your journey</div>
            <h1 className="y-title">Create an account</h1>
            <p className="y-sub">Enter your details to get started with RailYatri.</p>
            <form className="y-form" onSubmit={(event) => { event.preventDefault(); register(); }}>
              <div className="y-field"><label htmlFor="reg-name">Full name</label><input id="reg-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="reg-email">Email address</label><input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="reg-phone">Phone number</label><input id="reg-phone" type="tel" autoComplete="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="reg-password">Password (minimum 8 characters)</label><input id="reg-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                            {message && <div className="y-message error" role="alert">{message}</div>}
              <button className="y-btn" type="submit">Create account →</button>
            </form>
            <p className="y-switch">Already registered? <button className="y-link" onClick={() => { setPage('login'); setMessage(''); }}>Sign in</button></p>
          </section>
        )}

        {user && page === 'dashboard' && (
          <>
            <div className="y-kicker">Your account</div>
            <h1 className="y-title">Welcome, {user.name.split(' ')[0]}.</h1>
            <p className="y-sub">Manage your RailYatri account details and travel companions from one place.</p>
            <div className="y-grid">
              <div className="y-stat"><span className="y-muted">Account status</span><strong>Active</strong><span className="y-muted">Signed in</span></div>
              <div className="y-stat"><span className="y-muted">Your role</span><strong>{user.role}</strong><span className="y-muted">Assigned by RailYatri</span></div>
              <div className="y-stat"><span className="y-muted">Saved passengers</span><strong>{passengers.length}/{MAX_PASSENGERS}</strong><span className="y-muted">Travel companion profiles</span></div>
            </div>
            <div className="y-card" style={{ marginTop: 12 }}>
              <div className="y-row"><div><h2>Account details</h2><p className="y-muted">Your registered contact information</p></div><button className="y-btn secondary" onClick={openProfile}>Edit profile</button></div>
              <dl className="y-details"><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Phone</dt><dd>{user.phone}</dd></div></dl>
              <button className="y-btn" onClick={() => { setPage('passengers'); setMessage(''); }}>Manage saved passengers →</button>
            </div>
          </>
        )}

        {user && page === 'profile' && (
          <section className="y-card y-auth" style={{ maxWidth: 640 }}>
            <div className="y-kicker">Personal information</div>
            <h1 className="y-title">My profile</h1>
            <p className="y-sub">Update the name and phone number associated with your account.</p>
            <form className="y-form" onSubmit={(event) => { event.preventDefault(); updateProfile(); }}>
              <div className="y-field"><label htmlFor="profile-name">Full name</label><input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="profile-email">Email address (read-only)</label><input id="profile-email" type="email" value={user.email} readOnly /></div>
              <div className="y-field"><label htmlFor="profile-phone">Phone number</label><input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              {message && <div className="y-message" role="status">{message}</div>}
              <div className="y-row"><button className="y-btn" type="submit">Save changes</button><button className="y-btn secondary" type="button" onClick={() => { setPage('dashboard'); setMessage(''); }}>Cancel</button></div>
            </form>
          </section>
        )}

        {user && page === 'passengers' && (
          <>
            <div className="y-kicker">Travel companions</div>
            <h1 className="y-title">Saved passengers</h1>
            <p className="y-sub">Keep passenger details ready for future bookings. You can save up to 10 passengers.</p>
            <section className="y-card">
              <h2>Add a passenger</h2>
              <form className="y-form" onSubmit={(event) => { event.preventDefault(); savePassenger(); }}>
                <div className="y-field"><label htmlFor="passenger-name">Passenger full name</label><input id="passenger-name" value={pName} onChange={(e) => setPName(e.target.value)} required /></div>
                <div className="y-grid" style={{ marginTop: 0, gap: 16 }}>
                  <div className="y-field"><label htmlFor="passenger-age">Age</label><input id="passenger-age" type="number" min="1" max="120" value={pAge} onChange={(e) => setPAge(e.target.value)} required /></div>
                  <div className="y-field"><label htmlFor="passenger-gender">Gender</label><select id="passenger-gender" value={pGender} onChange={(e) => setPGender(e.target.value)}><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></div>
                </div>
                {message && <div className="y-message" role="status">{message}</div>}
                <button className="y-btn" type="submit" disabled={passengers.length >= MAX_PASSENGERS} style={passengers.length >= MAX_PASSENGERS ? { opacity: 0.55, cursor: 'not-allowed' } : {}}>+ Add passenger</button>
              </form>
            </section>
            <section className="y-card" style={{ marginTop: 12 }}>
              <div className="y-row"><h2>Your passengers</h2><span className="y-muted">{passengers.length} of {MAX_PASSENGERS} saved</span></div>
              {passengers.length === 0 ? <p className="y-muted">No saved passengers yet. Add your first passenger above.</p> : (
                <div className="y-list">
                  {passengers.map((passenger) => (
                    <div className="y-person" key={passenger.id}>
                      <div className="y-person-info"><div className="y-avatar">{passenger.name.charAt(0).toUpperCase()}</div><div><strong>{passenger.name}</strong><small>Age {passenger.age} · {passenger.gender}</small></div></div>
                      <button className="y-btn danger" onClick={() => removePassenger(passenger.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
