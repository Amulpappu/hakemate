import { Link } from 'react-router-dom';
import { STRANDS, iconFor, levelProgress } from '../lib/constants';

export function Avatar({ src, name = '?', size = 40 }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return src
    ? <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} referrerPolicy="no-referrer" />
    : <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{initials}</span>;
}

// Steam-style level ring around the avatar
export function LevelAvatar({ profile, size = 56 }) {
  const { pct } = levelProgress(profile?.xp || 0, profile?.level || 1);
  const r = size / 2 + 4;
  const c = 2 * Math.PI * r;
  return (
    <span className="level-avatar" style={{ width: size + 12, height: size + 12 }}>
      <svg width={size + 12} height={size + 12} aria-hidden="true">
        <circle cx={(size + 12) / 2} cy={(size + 12) / 2} r={r} className="ring-track" />
        <circle cx={(size + 12) / 2} cy={(size + 12) / 2} r={r} className="ring-fill"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${(size + 12) / 2} ${(size + 12) / 2})`} />
      </svg>
      <Avatar src={profile?.avatar_url} name={profile?.display_name} size={size} />
      <span className="level-chip" title={`Level ${profile?.level || 1}`}>{profile?.level || 1}</span>
    </span>
  );
}

// The Team DNA strand: five coloured segments that add up to the score
export function DnaStrand({ m, showLegend = false, height = 10 }) {
  return (
    <div className="dna">
      <div className="dna-bar" style={{ height }} role="img"
        aria-label={STRANDS.map((s) => `${s.label} ${m[s.key]} of ${s.max}`).join(', ')}>
        {STRANDS.map((s) => (
          <span key={s.key} className="dna-slot" style={{ flex: s.max }}>
            <span className="dna-fill" style={{ width: `${(100 * (m[s.key] || 0)) / s.max}%`, background: s.color }} />
          </span>
        ))}
      </div>
      {showLegend && (
        <ul className="dna-legend">
          {STRANDS.map((s) => (
            <li key={s.key}><i style={{ background: s.color }} />{s.label}<b>{m[s.key] || 0}/{s.max}</b></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScoreBadge({ score }) {
  const tone = score >= 75 ? 'strong' : score >= 55 ? 'good' : 'fair';
  return <span className={`score score-${tone}`}><b>{score}</b><small>/100</small></span>;
}

export function BadgeMedal({ badge, earned = true, size = 44 }) {
  const Icon = iconFor(badge.icon);
  return (
    <span className={`medal medal-${badge.tier} ${earned ? '' : 'medal-locked'}`} style={{ width: size, height: size }} title={`${badge.name}: ${badge.description}`}>
      <Icon size={size * 0.48} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

export function Chip({ children, tone }) {
  return <span className={`chip ${tone ? 'chip-' + tone : ''}`}>{children}</span>;
}

export function UserLink({ p, children }) {
  return <Link to={`/u/${p.handle}`} className="user-link">{children || p.display_name}</Link>;
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={28} aria-hidden="true" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="spinner" role="status"><span />{label}</div>;
}
