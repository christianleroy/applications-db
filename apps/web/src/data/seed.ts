import {
  SOURCES,
  STATUSES,
  addDays,
  addStatusEntry,
  createApplication,
  type Application,
  type Contact,
  type IsoDate,
  type Salary,
  type Status,
  type WorkMode,
} from '@applications-db/shared';

const SEED = 20261123;
const WINDOW_DAYS = 120;
const ACTIVE_NEW: readonly Status[] = ['applied', 'screening', 'interview', 'offer'];

const COMPANIES = [
  'Northwind Labs',
  'Brightpath',
  'Cobalt Systems',
  'Lumen Health',
  'Harbor Analytics',
  'Pinecone Works',
  'Quartz Mobility',
  'Redwood Finance',
  'Skyline Robotics',
  'Tidewater Cloud',
  'Umbra Security',
  'Vertex Retail',
  'Willow Education',
  'Zephyr Energy',
  'Atlas Freight',
  'Beacon Media',
  'Cedar Payments',
  'Delta Genomics',
  'Ember Games',
  'Fjord Software',
  'Granite Insurance',
  'Helix Biotech',
  'Ironbridge Data',
  'Juniper Travel',
  'Kestrel Aerospace',
  'Lattice Commerce',
];
const ROLES = [
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Developer',
  'Senior Software Engineer',
  'Platform Engineer',
  'Data Engineer',
  'Engineering Manager',
  'DevOps Engineer',
  'Mobile Developer',
  'Staff Engineer',
  'QA Automation Engineer',
  'Site Reliability Engineer',
];
const CITIES = ['Austin, TX', 'Denver, CO', 'Seattle, WA', 'Chicago, IL', 'Boston, MA', 'Remote (US)', 'Toronto, ON'];
const WORK_MODES: readonly WorkMode[] = ['onsite', 'hybrid', 'remote'];
const CONTACT_NAMES = ['Jordan Lee', 'Priya Nair', 'Sam Carter', 'Alex Moreno', 'Taylor Brooks', 'Morgan Diaz'];
const NOTES = [
  'Referred by a former colleague.',
  'Tailored resume toward the platform team.',
  'Recruiter mentioned a fast timeline.',
  'Take-home assignment expected.',
  'Strong culture fit based on the careers page.',
];

// Deliberate scenarios so the dashboard has data in every panel.
const STALE_INDICES = new Set([10, 11, 12]);
const FOLLOW_UP_INDICES = new Set([14, 15, 16, 17, 18]);

/** mulberry32: small, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidV4(rng: () => number): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(rng() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Status path from `applied` up to (and including) the target. */
function pathTo(target: Status, rng: () => number): Status[] {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
  switch (target) {
    case 'applied':
      return ['applied'];
    case 'screening':
      return ['applied', 'screening'];
    case 'interview':
      return ['applied', 'screening', 'interview'];
    case 'offer':
      return ['applied', 'screening', 'interview', 'offer'];
    case 'accepted':
      return ['applied', 'screening', 'interview', 'offer', 'accepted'];
    case 'rejected':
      return [
        ...pick([['applied'], ['applied', 'screening'], ['applied', 'screening', 'interview']] as Status[][]),
        'rejected',
      ];
    case 'ghosted':
      return [...pick([['applied'], ['applied', 'screening']] as Status[][]), 'ghosted'];
    case 'withdrawn':
      return [
        ...pick([
          ['applied', 'screening'],
          ['applied', 'screening', 'interview'],
        ] as Status[][]),
        'withdrawn',
      ];
  }
}

export function generateSeed(today: IsoDate, count = 45): Application[] {
  const rng = mulberry32(SEED);
  const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
  const newId = () => uuidV4(rng);
  const stamp = (d: IsoDate) => `${d}T09:00:00.000Z`;

  return Array.from({ length: count }, (_, i) => {
    const stale = STALE_INDICES.has(i);
    const followUp = FOLLOW_UP_INDICES.has(i);

    let target: Status;
    if (stale) target = pick(['applied', 'screening'] as const);
    else if (followUp) target = pick(['applied', 'screening', 'interview'] as const);
    else if (i < STATUSES.length) target = STATUSES[i]!;
    else target = pick([...STATUSES, 'applied', 'screening', 'rejected', 'ghosted'] as const);

    const active = ACTIVE_NEW.includes(target);
    // Active, non-stale items stay recent so their last change is within 21 days.
    const offset = stale ? int(45, WINDOW_DAYS - 1) : active ? int(3, 18) : int(0, WINDOW_DAYS - 1);
    const dateApplied = addDays(today, -offset);

    const company = COMPANIES[i % COMPANIES.length]!;
    const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const mode = pick(WORK_MODES);
    const salary: Salary | undefined =
      rng() < 0.5
        ? {
            min: int(9, 14) * 10000,
            max: int(15, 22) * 10000,
            currency: 'USD',
            period: 'year',
          }
        : undefined;
    const contacts: Contact[] =
      rng() < 0.4
        ? [
            {
              name: pick(CONTACT_NAMES),
              role: 'Recruiter',
              email: `recruiter@${slug}.example.com`,
            },
          ]
        : [];
    const followUpDate = followUp
      ? addDays(today, -int(0, 4))
      : active && rng() < 0.4
        ? addDays(today, int(1, 14))
        : undefined;

    let app = createApplication(
      {
        company,
        role: pick(ROLES),
        postingUrl: `https://jobs.${slug}.example.com/${int(1000, 9999)}`,
        location: mode === 'remote' ? 'Remote (US)' : pick(CITIES),
        workMode: mode,
        ...(salary && { salary }),
        source: SOURCES[i % SOURCES.length]!,
        dateApplied,
        ...(followUpDate && { followUpDate }),
        contacts,
        ...(rng() < 0.5 && { notes: pick(NOTES) }),
      },
      newId,
      stamp(dateApplied),
    );

    let date = dateApplied;
    for (const status of pathTo(target, rng).slice(1)) {
      // Stale items advance slowly in the past; every date is clamped to today.
      const next = addDays(date, stale ? int(1, 4) : int(2, 8));
      date = next > today ? today : next;
      app = addStatusEntry(app, { status, date }, newId, stamp(date));
    }
    return app;
  });
}
