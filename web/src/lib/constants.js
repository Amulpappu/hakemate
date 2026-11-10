import {
  Rocket, Compass, IdCard, Github, Layers, Hammer, ThumbsUp, Search, MessageSquare, BookOpen,
  Sparkles, Heart, PartyPopper, Hand, Star, Map, Flag, Users, Trophy, Repeat, Medal, Zap, Crown, Gem,
  Brain, Code2, Shield, Cpu, Palette, Sprout, Award,
} from 'lucide-react';

export const CATEGORIES = [
  'Frontend', 'Backend', 'AI/ML', 'Design', 'Mobile',
  'Hardware/IoT', 'Cyber Security', 'Data', 'Cloud/DevOps', 'Presentation',
];

export const AVAILABILITY = [
  { id: 'weekday_mornings', label: 'Weekday mornings' },
  { id: 'weekday_evenings', label: 'Weekday evenings' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'late_nights', label: 'Late nights' },
  { id: 'holidays', label: 'College holidays' },
];

export const INTERESTS = [
  'AI', 'Health', 'Agriculture', 'Education', 'FinTech', 'Climate', 'Smart Cities', 'Security',
  'Web', 'Gaming', 'Social Good', 'Accessibility', 'Open Source', 'Robotics', 'Blockchain', 'AR/VR',
];

export const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'PG', 'Graduate'];

export const EXPERIENCE = [
  { id: 'first_timer', label: 'First hackathon', hint: 'Never done one yet' },
  { id: 'some', label: 'A few done', hint: '1 to 3 hackathons' },
  { id: 'veteran', label: 'Veteran', hint: '4 or more' },
];

export const MODES = [
  { id: 'any', label: 'Online or offline' },
  { id: 'online', label: 'Online only' },
  { id: 'offline', label: 'Offline only' },
];

export const POST_KINDS = [
  { id: 'update', label: 'Update' },
  { id: 'lft', label: 'Looking for team' },
  { id: 'showcase', label: 'Showcase' },
  { id: 'question', label: 'Question' },
  { id: 'win', label: 'We won' },
];

// The five strands of the Team DNA score
export const STRANDS = [
  { key: 's_skill', label: 'Fills a missing skill', max: 30, color: 'var(--strand-skill)' },
  { key: 's_meaning', label: 'Meaning match', max: 30, color: 'var(--strand-meaning)' },
  { key: 's_avail', label: 'Free at the same times', max: 15, color: 'var(--strand-avail)' },
  { key: 's_mode', label: 'Event mode and location', max: 15, color: 'var(--strand-mode)' },
  { key: 's_exp', label: 'Experience balance', max: 10, color: 'var(--strand-exp)' },
];

const ICONS = {
  rocket: Rocket, compass: Compass, 'id-card': IdCard, github: Github, layers: Layers, hammer: Hammer,
  'thumbs-up': ThumbsUp, search: Search, message: MessageSquare, book: BookOpen, sparkles: Sparkles,
  heart: Heart, party: PartyPopper, hand: Hand, star: Star, map: Map, flag: Flag, users: Users,
  trophy: Trophy, repeat: Repeat, medal: Medal, zap: Zap, crown: Crown, gem: Gem,
  brain: Brain, code: Code2, shield: Shield, cpu: Cpu, palette: Palette, sprout: Sprout,
};
export const iconFor = (name) => ICONS[name] || Award;

export const xpForLevel = (level) => 50 * (level - 1) ** 2;
export function levelProgress(xp, level) {
  const lo = xpForLevel(level);
  const hi = xpForLevel(level + 1);
  return { lo, hi, pct: Math.min(1, Math.max(0, (xp - lo) / (hi - lo))) };
}

export function timeAgo(iso) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
