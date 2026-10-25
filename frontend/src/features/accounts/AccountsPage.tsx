
import { useEffect, useState } from 'react';

type Role = 'Passenger' | 'Staff' | 'Admin';

type Account = {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: Role;
};

type Passenger = {
  id: number;
  name: string;
  age: number;
  gender: string;
};

const ACCOUNTS_KEY = 'yatrio_g1_demo_accounts';
const SESSION_KEY = 'yatrio_g1_demo_session';

const initialAccounts: Account[] = [];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    } catch {
      return initialAccounts;
    }
  });

  const [user, setUser] = useState<Account | null>(() => {
    try {
      const email = localStorage.getItem(SESSION_KEY);
      return accountsFromStorage(email);
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState<'login' | 'register' | 'dashboard' | 'profile' | 'passengers'>(
    'login',
  );
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('Passenger');
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [pName, setPName] = useState('');
  const [pAge, setPAge] = useState('');
  const [pGender, setPGender] = useState('Female');

  function accountsFromStorage(sessionEmail: string | null): Account | null {
    if (!sessionEmail) return null;
    const saved: Account[] = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return saved.find((account) => account.email === sessionEmail) || null;
  }

  useEffect(() => {
    if (user) {
      setPage('dashboard');
      try {
        const saved = JSON.parse(
          localStorage.getItem(`yatrio_g1_passengers_${user.email}`) || '[]',
        );
        setPassengers(saved);
      } catch {
        setPassengers([]);
      }
    }
  }, [user]);

  function saveAccounts(updated: Account[]) {
    setAccounts(updated);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
  }

  function register() {
    setMessage('');

    if (!name.trim() || !email.trim() || !password || !phone.trim()) {
      setMessage('Please fill in all fields.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setMessage('Password must contain at least 6 characters.');
      return;
    }
    if (accounts.some((account) => account.email.toLowerCase() === email.toLowerCase())) {
      setMessage('An account with this email already exists.');
      return;
    }

    const newAccount: Account = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim(),
      role,
    };

    saveAccounts([...accounts, newAccount]);
    localStorage.setItem(SESSION_KEY, newAccount.email);
    setUser(newAccount);
    setMessage('Account created successfully!');
  }

  function login() {
    setMessage('');
    const found = accounts.find(
      (account) =>
        account.email.toLowerCase() === email.trim().toLowerCase() &&
        account.password === password,
    );

    if (!found) {
      setMessage('Invalid email or password. Register first if you are a new user.');
      return;
    }

    localStorage.setItem(SESSION_KEY, found.email);
    setUser(found);
    setPage('dashboard');
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setPage('login');
    setPassword('');
    setMessage('');
  }

  function updateProfile() {
    if (!user) return;
    if (!name.trim() || !phone.trim()) {
      setMessage('Name and phone number are required.');
      return;
    }

    const updated = accounts.map((account) =>
      account.email === user.email
        ? { ...account, name: name.trim(), phone: phone.trim() }
        : account,
    );

    saveAccounts(updated);
    setUser({ ...user, name: name.trim(), phone: phone.trim() });
    setMessage('Profile updated successfully.');
  }

  function openProfile() {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone);
    setMessage('');
    setPage('profile');
  }

  function savePassenger() {
    if (!user) return;
    const age = Number(pAge);

    if (!pName.trim() || !pAge || age < 1 || age > 120) {
      setMessage('Enter a valid passenger name and age (1–120).');
      return;
    }
    if (passengers.length >= 10) {
      setMessage('You can save a maximum of 10 passengers.');
      return;
    }

    const updated = [
      ...passengers,
      { id: Date.now(), name: pName.trim(), age, gender: pGender },
    ];
    setPassengers(updated);
    localStorage.setItem(`yatrio_g1_passengers_${user.email}`, JSON.stringify(updated));
    setPName('');
    setPAge('');
    setMessage('Passenger added successfully.');
  }

  function removePassenger(id: number) {
    if (!user) return;
    const updated = passengers.filter((passenger) => passenger.id !== id);
    setPassengers(updated);
    localStorage.setItem(`yatrio_g1_passengers_${user.email}`, JSON.stringify(updated));
    setMessage('Passenger removed.');
  }

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone);
    }
  }, [user]);

  const styles = `
    * { box-sizing: border-box; }
    .yatrio { min-height: 100vh; background: #f3f6fc; color: #18233c; font-family: Inter, system-ui, Arial, sans-serif; }
    .y-nav { background: #102b55; color: white; padding: 17px 5%; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
    .y-brand { font-size: 25px; font-weight: 800; letter-spacing: -.7px; }
    .y-brand span { color: #61d8c4; }
    .y-nav small { color: #d0def2; display: block; font-size: 11px; font-weight: 400; letter-spacing: 1.5px; }
    .y-nav-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .y-nav button { background: transparent; color: white; border: 1px solid #607795; border-radius: 8px; padding: 9px 12px; cursor: pointer; }
    .y-nav button:hover, .y-nav button.active { background: #254775; }
    .y-main { max-width: 1050px; padding: 38px 20px 60px; margin: auto; }
    .y-card { background: white; border: 1px solid #e1e8f2; border-radius: 18px; padding: 28px; box-shadow: 0 8px 28px #18345c0b; }
    .y-auth { max-width: 490px; margin: 15px auto; }
    .y-kicker { color: #128b82; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.6px; }
    .y-title { margin: 8px 0; font-size: clamp(25px, 4vw, 34px); letter-spacing: -1px; }
    .y-sub { color: #6c7890; line-height: 1.6; margin-bottom: 23px; }
    .y-form { display: grid; gap: 15px; }
    .y-field label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 7px; }
    .y-field input, .y-field select { width: 100%; border: 1px solid #d8e1ee; border-radius: 9px; padding: 12px; font: inherit; background: white; color: #18233c; }
    .y-field input:focus, .y-field select:focus { outline: 2px solid #87dcd0; border-color: #168f86; }
    .y-btn { border: 0; border-radius: 9px; background: #087f78; color: white; padding: 12px 16px; font-weight: 750; font-size: 14px; cursor: pointer; }
    .y-btn:hover { background: #066a64; }
    .y-btn.secondary { background: #edf3fa; color: #18345c; }
    .y-btn.danger { background: #fff0f0; color: #b32636; }
    .y-switch { color: #65728a; font-size: 14px; text-align: center; margin-top: 18px; }
    .y-link { border: 0; background: transparent; color: #087f78; font-weight: 800; cursor: pointer; }
    .y-message { background: #e9f8f4; border: 1px solid #bce7da; color: #116b58; padding: 11px 13px; border-radius: 9px; margin: 15px 0; font-size: 14px; }
    .y-message.error { background: #fff0f0; color: #a52836; border-color: #f2c6cb; }
    .y-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-top: 22px; }
    .y-stat { padding: 21px; border-radius: 15px; background: white; border: 1px solid #e1e8f2; }
    .y-stat strong { display: block; font-size: 29px; margin: 8px 0; }
    .y-muted { color: #738097; font-size: 13px; }
    .y-row { display: flex; align-items: center; justify-content: space-between; gap: 15px; flex-wrap: wrap; }
    .y-list { display: grid; gap: 12px; margin-top: 20px; }
    .y-person { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 16px; border: 1px solid #e2e9f3; border-radius: 12px; }
    .y-avatar { width: 43px; height: 43px; display: grid; place-items: center; background: #dff5f0; color: #087f78; font-weight: 800; border-radius: 13px; flex-shrink: 0; }
    .y-person-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .y-person-info strong { display: block; }
    .y-person-info small { display: block; color: #738097; margin-top: 4px; }
    .y-footer { text-align: center; color: #7a879c; padding: 20px; font-size: 12px; }
    @media(max-width: 560px) { .y-main { padding: 24px 13px 40px; } .y-card { padding: 20px; } .y-nav { padding: 15px; } .y-person { align-items: flex-start; } }
  `;

  return (
    <div className="yatrio">
      <style>{styles}</style>
      <header className="y-nav">
        <div className="y-brand">Yatrio<span>.</span><small>RAILWAY RESERVATION</small></div>
        {user && (
          <nav className="y-nav-actions" aria-label="Account navigation">
            <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>Dashboard</button>
            <button className={page === 'profile' ? 'active' : ''} onClick={openProfile}>My Profile</button>
            <button className={page === 'passengers' ? 'active' : ''} onClick={() => { setMessage(''); setPage('passengers'); }}>Passengers</button>
            <button onClick={logout}>Log out</button>
          </nav>
        )}
      </header>

      <main className="y-main">
        {!user && page === 'login' && (
          <section className="y-card y-auth">
            <div className="y-kicker">Welcome aboard</div>
            <h1 className="y-title">Sign in to Yatrio</h1>
            <p className="y-sub">Log in to manage your account and saved passengers.</p>
            <form className="y-form" onSubmit={(event) => { event.preventDefault(); login(); }}>
              <div className="y-field"><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              {message && <div className="y-message error" role="alert">{message}</div>}
              <button className="y-btn" type="submit">Sign in →</button>
            </form>
            <p className="y-switch">New to Yatrio? <button className="y-link" onClick={() => { setPage('register'); setMessage(''); }}>Create an account</button></p>
          </section>
        )}

        {!user && page === 'register' && (
          <section className="y-card y-auth">
            <div className="y-kicker">Start your journey</div>
            <h1 className="y-title">Create an account</h1>
            <p className="y-sub">Enter your details to get started with Yatrio.</p>
            <form className="y-form" onSubmit={(event) => { event.preventDefault(); register(); }}>
              <div className="y-field"><label htmlFor="reg-name">Full name</label><input id="reg-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="reg-email">Email address</label><input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="reg-phone">Phone number</label><input id="reg-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="reg-password">Password (minimum 6 characters)</label><input id="reg-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              <div className="y-field"><label htmlFor="reg-role">Demo role</label><select id="reg-role" value={role} onChange={(e) => setRole(e.target.value as Role)}><option>Passenger</option><option>Staff</option><option>Admin</option></select><small className="y-muted">Demo only. Real roles must be assigned and verified by the backend.</small></div>
              {message && <div className="y-message error" role="alert">{message}</div>}
              <button className="y-btn" type="submit">Create account →</button>
            </form>
            <p className="y-switch">Already registered? <button className="y-link" onClick={() => { setPage('login'); setMessage(''); }}>Sign in</button></p>
          </section>
        )}

        {user && page === 'dashboard' && (
          <>
            <div className="y-kicker">Your account</div>
            <h1 className="y-title">Welcome, {user.name.split(' ')[0]} 👋</h1>
            <p className="y-sub">Manage your Yatrio account details and travel companions from one place.</p>
            <div className="y-grid">
              <div className="y-stat"><span className="y-muted">ACCOUNT STATUS</span><strong>Active</strong><span className="y-muted">Signed in for this demo</span></div>
              <div className="y-stat"><span className="y-muted">YOUR ROLE</span><strong>{user.role}</strong><span className="y-muted">Demo role, not server-authorized</span></div>
              <div className="y-stat"><span className="y-muted">SAVED PASSENGERS</span><strong>{passengers.length}/10</strong><span className="y-muted">Travel companion profiles</span></div>
            </div>
            <div className="y-card" style={{ marginTop: 22 }}>
              <div className="y-row"><div><h2 style={{ margin: 0 }}>Account details</h2><p className="y-muted">Your registered contact information</p></div><button className="y-btn secondary" onClick={openProfile}>Edit profile</button></div>
              <p><strong>Name:</strong> {user.name}</p><p><strong>Email:</strong> {user.email}</p><p><strong>Phone:</strong> {user.phone}</p>
              <button className="y-btn" onClick={() => { setPage('passengers'); setMessage(''); }}>Manage saved passengers →</button>
            </div>
          </>
        )}

        {user && page === 'profile' && (
          <section className="y-card" style={{ maxWidth: 650, margin: 'auto' }}>
            <div className="y-kicker">Personal information</div>
            <h1 className="y-title">My profile</h1>
            <p className="y-sub">Update the name and phone number associated with your demo account.</p>
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
            <p className="y-sub">Keep passenger details ready for future bookings. You can save up to 10 passengers in this demo.</p>
            <section className="y-card">
              <h2 style={{ marginTop: 0 }}>Add a passenger</h2>
              <form className="y-form" onSubmit={(event) => { event.preventDefault(); savePassenger(); }}>
                <div className="y-field"><label htmlFor="passenger-name">Passenger full name</label><input id="passenger-name" value={pName} onChange={(e) => setPName(e.target.value)} required /></div>
                <div className="y-grid" style={{ marginTop: 0 }}>
                  <div className="y-field"><label htmlFor="passenger-age">Age</label><input id="passenger-age" type="number" min="1" max="120" value={pAge} onChange={(e) => setPAge(e.target.value)} required /></div>
                  <div className="y-field"><label htmlFor="passenger-gender">Gender</label><select id="passenger-gender" value={pGender} onChange={(e) => setPGender(e.target.value)}><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></div>
                </div>
                {message && <div className="y-message" role="status">{message}</div>}
                <button className="y-btn" type="submit" disabled={passengers.length >= 10} style={passengers.length >= 10 ? { opacity: 0.55, cursor: 'not-allowed' } : {}}>+ Add passenger</button>
              </form>
            </section>
            <section className="y-card" style={{ marginTop: 20 }}>
              <div className="y-row"><h2 style={{ margin: 0 }}>Your passengers</h2><span className="y-muted">{passengers.length} of 10 saved</span></div>
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
      <footer className="y-footer">Yatrio · Group 1 — Accounts and Access · Frontend demo</footer>
    </div>
  );
}
