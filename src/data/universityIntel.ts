// ============================================================================
// University intelligence corpus (Phase E) — a researched, static credit input.
//
// WHAT THIS IS
// A hand-researched dossier on each of the 14 universities the pre-qualification
// screen can select (`US_UNIVERSITIES` in lib/eligibility.ts). It answers the
// question a credit officer actually asks about a foreign institution: is the
// place the applicant is borrowing ₹40 lakh to attend financially stable, is its
// research base intact, is its leadership settled, and is anything in the public
// record likely to disrupt the applicant's course or their right to remain?
//
// WHAT IT IS NOT
// It is not a live feed. Every finding below was read from a real, published
// source and transcribed with that source's publisher, URL and publication date.
// Shipped code makes ZERO network calls — the "24-hour refresh" the brief
// describes is modelled against the frozen prototype clock and re-selects from
// this corpus. A genuine crawl needs the backend endpoint documented in
// docs/API-CONTRACT.md.
//
// RULES OBSERVED WHILE BUILDING IT
//   1. Every finding carries a real source URL, publisher and ISO date.
//      Nothing was written from memory.
//   2. `level` is never 'block'. University news informs a credit view; it must
//      never, on its own, stop a customer's file.
//   3. Where a university genuinely yields little, `coverage` is 'thin' and
//      `note` says why. Four universities are marked thin. That is the honest
//      answer, not a gap to be padded.
//   4. `university` MUST equal `UniversityRef.short` in US_UNIVERSITIES. This
//      module is deliberately standalone — no import from lib/ — so the two are
//      kept in step by the string values below, not by a compile-time link.
//
// RESEARCH WINDOW
// Sources span 2025-03-19 to 2026-08-13. The corpus was assembled 2026-08-17.
// The dominant themes across all 14: a sustained contraction in US federal
// research funding, the endowment excise tax rise, and a tightening student-visa
// regime — all three of which bear directly on programme continuity and on the
// borrower's post-study earning window.
// ============================================================================

export type IntelCategory =
  | 'funding'
  | 'leadership'
  | 'faculty'
  | 'ranking'
  | 'policy'
  | 'adverse'

export interface IntelSource {
  publisher: string
  url: string
  /** ISO yyyy-mm-dd — the date the source was published, not the date read. */
  date: string
}

export interface IntelFinding {
  /** Stable slug. Safe to persist against an application. */
  id: string
  /** MUST equal UniversityRef.short from US_UNIVERSITIES. */
  university: string
  category: IntelCategory
  /** One plain-language line. */
  headline: string
  /** 1–3 sentences. */
  detail: string
  /** Never 'block' — university news must not stop a file. */
  level: 'info' | 'attention'
  /** Set only where the finding is genuinely programme-specific. */
  programmeTags?: string[]
  source: IntelSource
}

export interface UniversityIntel {
  /** Short name — matches UniversityRef.short. */
  university: string
  /** Full name — matches UniversityRef.name. */
  name: string
  coverage: 'adequate' | 'thin'
  /** Required when coverage is 'thin'. Says what was looked for and not found. */
  note?: string
  findings: IntelFinding[]
}

// ---- Massachusetts Institute of Technology ---------------------------------

const MIT: UniversityIntel = {
  university: 'MIT',
  name: 'Massachusetts Institute of Technology',
  coverage: 'adequate',
  findings: [
    {
      id: 'mit-funding-federal-research-down-2026',
      university: 'MIT',
      category: 'funding',
      headline: 'Federally funded campus research down more than 20% year on year',
      detail:
        'President Sally Kornbluth told the campus in May 2026 that federally funded research activity, and new federal awards, were each down more than 20% against the prior year. Counting non-federal sources as well, total sponsored research on campus is about 10% smaller than a year earlier.',
      level: 'attention',
      source: {
        publisher: 'The Washington Post',
        url: 'https://www.washingtonpost.com/education/2026/05/15/mit-president-blames-federal-policy-shifts-big-drop-research-campus/',
        date: '2026-05-15',
      },
    },
    {
      id: 'mit-policy-graduate-intake-reduced-2026',
      university: 'MIT',
      category: 'policy',
      headline: 'Roughly 500 fewer graduate students to be enrolled next year',
      detail:
        'MIT is shrinking new graduate enrolment by close to 20% — about 500 places — in direct response to the research funding decline and the higher endowment tax. Research-assistantship-funded places are the ones under pressure, so self-funded and loan-funded taught masters intakes are less exposed than doctoral intakes.',
      level: 'attention',
      programmeTags: ['MS Computer Science', 'MS Electrical Engineering', 'MS Data Science', 'MEng ECE'],
      source: {
        publisher: 'The Boston Globe',
        url: 'https://www.bostonglobe.com/2026/05/14/business/mit-decreases-research-graduate-admissions/',
        date: '2026-05-14',
      },
    },
    {
      id: 'mit-funding-endowment-excise-tax-2025',
      university: 'MIT',
      category: 'funding',
      headline: 'New 8% endowment tax costs about a tenth of the central budget',
      detail:
        'A letter from the Provost and the Executive Vice President and Treasurer put the new 8% tax on endowment investment returns at "in the range of 10% of our annual central budget". MIT draws on endowment income principally for financial aid and research, so the pressure lands on exactly the lines an international applicant might otherwise hope to draw on.',
      level: 'attention',
      source: {
        publisher: 'MIT Organization Chart (Office of the Provost)',
        url: 'https://orgchart.mit.edu/letters/major-tax-impact-mit-and-its-mission',
        date: '2025-07-10',
      },
    },
    {
      id: 'mit-ranking-qs-2027-first',
      university: 'MIT',
      category: 'ranking',
      headline: 'First in the world for the fifteenth consecutive year',
      detail:
        'The QS World University Rankings 2027, published in June 2026, again placed MIT first globally. QS noted that most American universities slipped in this edition while Asian and Middle Eastern institutions gained; MIT was among the exceptions holding position.',
      level: 'info',
      source: {
        publisher: 'QS Quacquarelli Symonds (via PR Newswire)',
        url: 'https://www.prnewswire.com/news-releases/worlds-best-universities-revealed-302803262.html',
        date: '2026-06-17',
      },
    },
  ],
}

// ---- Stanford University ----------------------------------------------------

const STANFORD: UniversityIntel = {
  university: 'Stanford',
  name: 'Stanford University',
  coverage: 'adequate',
  findings: [
    {
      id: 'stanford-funding-layoffs-363-2025',
      university: 'Stanford',
      category: 'funding',
      headline: '363 staff laid off against a $140 million budget reduction',
      detail:
        'Stanford cut $140 million from its 2025-26 operating budget and eliminated about 363 staff posts, roughly 2% of its workforce, across student support services, libraries and alumni relations. The university attributed the cuts to expected reductions in federal research funding and the higher excise tax on investment income.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/stanford-university-lays-off-363-employees/756962/',
        date: '2025-08-06',
      },
    },
    {
      id: 'stanford-funding-endowment-tax-2025',
      university: 'Stanford',
      category: 'funding',
      headline: 'Endowment tax rises from 1.4% to 8% on a $37.6 billion endowment',
      detail:
        'Stanford falls into the top tier of the reformed endowment excise tax, taking its rate from 1.4% to 8%. Its vice president for human resources named the tax, alongside federal research cuts, as the cause of the 2025-26 budget reduction — a signal that discretionary institutional aid is under sustained pressure.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/stanford-university-lays-off-363-employees/756962/',
        date: '2025-08-06',
      },
    },
    {
      id: 'stanford-faculty-ai-industry-departures-2026',
      university: 'Stanford',
      category: 'faculty',
      headline: 'Senior AI faculty continuing to leave for industry laboratories',
      detail:
        'Reporting in August 2026 described AI professors at leading US departments, Stanford prominent among them, renegotiating their relationship with academic research as industry laboratories outbid universities for senior researchers. For an applicant this bears on supervision continuity and on which laboratories are actually running during their course.',
      level: 'info',
      programmeTags: ['MS Computer Science', 'MS Data Science'],
      source: {
        publisher: 'MIT Technology Review',
        url: 'https://www.technologyreview.com/2026/08/10/1141597/ai-professors-are-negotiating-the-new-realities-of-academic-research',
        date: '2026-08-10',
      },
    },
    {
      id: 'stanford-ranking-qs-2027-second',
      university: 'Stanford',
      category: 'ranking',
      headline: 'Rises to joint second in the world',
      detail:
        'Stanford moved up from third to joint second, level with Imperial College London, in the QS World University Rankings 2027 published in June 2026 — a rise against a general slippage among US institutions in that edition.',
      level: 'info',
      source: {
        publisher: 'QS Quacquarelli Symonds (via PR Newswire)',
        url: 'https://www.prnewswire.com/news-releases/worlds-best-universities-revealed-302803262.html',
        date: '2026-06-17',
      },
    },
  ],
}

// ---- Harvard University -----------------------------------------------------

const HARVARD: UniversityIntel = {
  university: 'Harvard',
  name: 'Harvard University',
  coverage: 'adequate',
  findings: [
    {
      id: 'harvard-funding-research-cuts-reversed-2025',
      university: 'Harvard',
      category: 'funding',
      headline: 'Court ordered more than $2.6 billion of research funding restored',
      detail:
        'A federal judge in Boston reversed the withdrawal of over $2.6 billion in research grants, finding the cuts were unlawful retaliation. The ruling reinstated hundreds of research projects, though the government appealed and settlement talks continued in parallel.',
      level: 'info',
      source: {
        publisher: 'PBS NewsHour',
        url: 'https://www.pbs.org/newshour/politics/judge-reverses-trump-administrations-cuts-of-billions-in-research-funding-to-harvard',
        date: '2025-09-03',
      },
    },
    {
      id: 'harvard-adverse-settlement-demand-2026',
      university: 'Harvard',
      category: 'adverse',
      headline: 'Federal settlement demand raised to $1 billion',
      detail:
        'After months of unresolved negotiation the administration raised its settlement demand on Harvard to $1 billion, up from an earlier $500 million, as the price of restoring federal funding. The dispute has already involved cancelled contracts and an attempt to bar the university from hosting international students.',
      level: 'attention',
      source: {
        publisher: 'CNN',
        url: 'https://www.cnn.com/2026/02/03/us/harvard-university-trump-settlement-hnk',
        date: '2026-02-03',
      },
    },
    {
      id: 'harvard-adverse-admissions-lawsuit-2026',
      university: 'Harvard',
      category: 'adverse',
      headline: 'Fresh federal lawsuit filed over admissions records',
      detail:
        'The administration filed a further suit against Harvard in February 2026 seeking admissions documents, extending an already long-running funding dispute into a second front. The litigation is institutional and carries no direct consequence for an individual admitted student.',
      level: 'info',
      source: {
        publisher: 'CNN',
        url: 'https://www.cnn.com/2026/02/13/us/harvard-admissions-documents-trump-lawsuit',
        date: '2026-02-13',
      },
    },
    {
      id: 'harvard-policy-four-year-visa-cap-warning-2026',
      university: 'Harvard',
      category: 'policy',
      headline: 'President warns new four-year visa cap is shorter than many degrees',
      detail:
        'President Alan Garber publicly warned in July 2026 that a new federal rule capping international student stays at four years sits below the six years a doctorate typically takes, and that the signal being sent to overseas talent is the larger threat. Harvard reported immediate effects on postdoctoral recruitment.',
      level: 'attention',
      source: {
        publisher: 'The Harvard Gazette',
        url: 'https://news.harvard.edu/gazette/story/2026/07/policy-changes-for-international-students-scholars-threaten-u-s-competitiveness/',
        date: '2026-07-27',
      },
    },
    {
      id: 'harvard-ranking-qs-2027-fifth',
      university: 'Harvard',
      category: 'ranking',
      headline: 'Holds fifth in the world and leads globally on four indicators',
      detail:
        'Harvard held fifth place in the QS World University Rankings 2027 published in June 2026, and led the world on four of the individual indicators — an academic standing unaffected by the funding dispute.',
      level: 'info',
      source: {
        publisher: 'QS Quacquarelli Symonds (via PR Newswire)',
        url: 'https://www.prnewswire.com/news-releases/worlds-best-universities-revealed-302803262.html',
        date: '2026-06-17',
      },
    },
  ],
}

// ---- Carnegie Mellon University ---------------------------------------------

const CMU: UniversityIntel = {
  university: 'CMU',
  name: 'Carnegie Mellon University',
  coverage: 'adequate',
  findings: [
    {
      id: 'cmu-funding-sei-layoffs-2025',
      university: 'CMU',
      category: 'funding',
      headline: '75 posts cut at the Software Engineering Institute',
      detail:
        'Carnegie Mellon eliminated 75 positions, about 10% of the workforce, at its federally funded Software Engineering Institute, citing shifting federal funding priorities. The same reporting noted a roughly $20 million tuition shortfall driven by lower-than-expected graduate enrolment.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/carnegie-mellon-lays-off-75-employees/802547/',
        date: '2025-10-10',
      },
    },
    {
      id: 'cmu-funding-nsf-award-slowdown-2026',
      university: 'CMU',
      category: 'funding',
      headline: 'National Science Foundation had issued only a quarter of its usual awards',
      detail:
        'President Farnam Jahanian told the campus in May 2026 that seven months into the fiscal year the NSF had issued 25% of its usual number of awards and 43% of the usual funding against five-year averages. He described the university as on solid ground with a narrowing operating margin, and reinstated merit increases for the year.',
      level: 'attention',
      source: {
        publisher: 'Carnegie Mellon University, Office of the President',
        url: 'https://www.cmu.edu/leadership/president/campus-comms/05-05-26',
        date: '2026-05-05',
      },
    },
    {
      id: 'cmu-policy-masters-enrolment-dynamic-2026',
      university: 'CMU',
      category: 'policy',
      headline: 'Undergraduate intake on target; masters intake described as unsettled',
      detail:
        'In his March 2026 State of the University address the president reported an exceptional first-year undergraduate class alongside a more volatile masters picture, with domestic applications up but international applications and summer enrolment patterns still fluid. Research expenditure was reported above $727 million, about $456 million of it federal.',
      level: 'info',
      programmeTags: ['MS Computer Science', 'MS Data Science', 'MS Electrical Engineering', 'MS Business Analytics'],
      source: {
        publisher: 'The Tartan',
        url: 'https://the-tartan.org/2026/03/30/president-jahanian-delivers-state-of-university-address/',
        date: '2026-03-30',
      },
    },
    {
      id: 'cmu-policy-congressional-stem-enrolment-inquiry-2025',
      university: 'CMU',
      category: 'policy',
      headline: 'Named in a congressional inquiry into foreign nationals in advanced STEM programmes',
      detail:
        'Carnegie Mellon was one of six universities asked by a House committee to disclose its policies on enrolling Chinese nationals in advanced STEM programmes tied to federally funded research. The inquiry concerns nationality-based enrolment screening in graduate engineering and computing, and signals tighter scrutiny of admission to research-linked courses.',
      level: 'info',
      programmeTags: ['MS Computer Science', 'MS Electrical Engineering', 'MEng ECE'],
      source: {
        publisher: 'US House Select Committee on the Chinese Communist Party',
        url: 'https://selectcommitteeontheccp.house.gov/media/press-releases/chairman-moolenaar-demands-transparency-universities-national-security-risks',
        date: '2025-03-19',
      },
    },
  ],
}

// ---- Columbia University ----------------------------------------------------

const COLUMBIA: UniversityIntel = {
  university: 'Columbia',
  name: 'Columbia University',
  coverage: 'adequate',
  findings: [
    {
      id: 'columbia-funding-federal-settlement-2025',
      university: 'Columbia',
      category: 'funding',
      headline: 'Paid over $220 million to restore federal research funding',
      detail:
        'Columbia settled with the federal government for $200 million over three years plus $21 million to resolve employment discrimination claims, restoring research grants that had been cancelled and unfreezing access to future federal funding. The university did not admit wrongdoing.',
      level: 'info',
      source: {
        publisher: 'PBS News (Associated Press)',
        url: 'https://www.pbs.org/newshour/politics/columbia-university-makes-deal-with-trump-administration-agrees-to-pay-more-than-220-million-to-restore-federal-funding',
        date: '2025-07-24',
      },
    },
    {
      id: 'columbia-policy-international-student-screening-2025',
      university: 'Columbia',
      category: 'policy',
      headline: 'Settlement obliges the university to screen international applicants on intent',
      detail:
        'Among the settlement conditions, Columbia agreed to question international applicants on their reasons for studying in the United States and to share disciplinary records of student visa holders with the government. Applicants to Columbia should expect additional admissions-stage questioning that does not arise elsewhere.',
      level: 'attention',
      source: {
        publisher: 'PBS News (Associated Press)',
        url: 'https://www.pbs.org/newshour/politics/columbia-university-makes-deal-with-trump-administration-agrees-to-pay-more-than-220-million-to-restore-federal-funding',
        date: '2025-07-24',
      },
    },
    {
      id: 'columbia-adverse-settlement-as-template-2026',
      university: 'Columbia',
      category: 'adverse',
      headline: 'Columbia deal became the template for federal settlements with other universities',
      detail:
        'By January 2026 the Columbia agreement was being described as the model the administration applied to subsequent university settlements, including continuing oversight by a federal monitor. The reputational framing is adverse; the operational effect on an enrolled student is limited.',
      level: 'info',
      source: {
        publisher: 'NPR',
        url: 'https://www.npr.org/2026/01/29/nx-s1-5559293/trump-settlements-colleges-universities',
        date: '2026-01-29',
      },
    },
    {
      id: 'columbia-leadership-presidential-transition-2026',
      university: 'Columbia',
      category: 'leadership',
      headline: 'Third president in three years takes office',
      detail:
        'Claire Shipman\'s fifteen months as acting president ended on 30 June 2026, with Jennifer Mnookin, previously chancellor of the University of Wisconsin-Madison, taking office as the university\'s twenty-first president on 1 July 2026. Shipman had earlier named research funding and international enrolment as the two principal risks weighed when sizing the incoming class.',
      level: 'attention',
      source: {
        publisher: 'Columbia Daily Spectator',
        url: 'https://www.columbiaspectator.com/news/2026/07/08/kept-the-lights-on-15-months-of-shipman-as-columbia-embarks-on-its-next-chapter/',
        date: '2026-07-08',
      },
    },
  ],
}

// ---- University of California, Berkeley -------------------------------------

const BERKELEY: UniversityIntel = {
  university: 'UC Berkeley',
  name: 'University of California, Berkeley',
  coverage: 'adequate',
  findings: [
    {
      id: 'ucberkeley-faculty-cs-chair-to-industry-2026',
      university: 'UC Berkeley',
      category: 'faculty',
      headline: 'Computer science chair left for an AI laboratory',
      detail:
        'Jelani Nelson, chair of the computer science division within Electrical Engineering and Computer Sciences, left to join Anthropic as a member of technical staff with effect from 1 July 2026. The move is the most visible instance to date of senior computing faculty at Berkeley moving to industry.',
      level: 'attention',
      programmeTags: ['MS Computer Science', 'MS Data Science', 'MS Electrical Engineering'],
      source: {
        publisher: 'Tech Times',
        url: 'https://www.techtimes.com/articles/319500/20260702/anthropic-hires-berkeley-cs-chair-jelani-nelson-signaling-new-phase-ai-race.htm',
        date: '2026-07-02',
      },
    },
    {
      id: 'ucberkeley-leadership-eecs-chair-succession-2026',
      university: 'UC Berkeley',
      category: 'leadership',
      headline: 'New chair appointed to lead engineering and computing',
      detail:
        'Professor Ana Arias took over as chair of Electrical Engineering and Computer Sciences, succeeding Jelani Nelson, who stepped down for an industrial leave of absence. The succession was announced promptly, so the leadership gap in the department is short.',
      level: 'info',
      programmeTags: ['MS Computer Science', 'MS Electrical Engineering', 'MEng ECE'],
      source: {
        publisher: 'UC Berkeley EECS',
        url: 'https://eecs.berkeley.edu/news/changing-of-the-guard-welcoming-ana-arias-as-eecs-department-chair/',
        date: '2026-07-02',
      },
    },
    {
      id: 'ucberkeley-funding-title-vi-cuts-2025',
      university: 'UC Berkeley',
      category: 'funding',
      headline: 'About $3.5 million withdrawn from language and area-studies institutes',
      detail:
        'Federal Title VI grants worth roughly $3.5 million for the academic year were withdrawn, obliging the campus to backfill language departments including Slavic and East Asian studies. All fifty-plus Title VI recipient universities lost this funding, so the effect is sector-wide rather than Berkeley-specific.',
      level: 'info',
      source: {
        publisher: 'The Daily Californian',
        url: 'https://www.dailycal.org/news/campus/federal-government-cuts-roughly-3-5m-for-uc-berkeley-languages-international-institutes/article_d1b4b48d-fcab-418f-b674-3d86edb4f128.html',
        date: '2025-09-30',
      },
    },
    {
      id: 'ucberkeley-funding-state-backstop-2026',
      university: 'UC Berkeley',
      category: 'funding',
      headline: 'State budget proposal adds new base funding for the University of California',
      detail:
        'California\'s January 2026 budget proposal allocated $350.6 million in new base funding to the University of California, described by system leaders as critical support against federal hostility. As a public institution Berkeley has a state backstop that the private universities on this list do not.',
      level: 'info',
      source: {
        publisher: 'Berkeleyside',
        url: 'https://www.berkeleyside.org/2026/01/13/university-of-california-newsom-budget',
        date: '2026-01-13',
      },
    },
  ],
}

// ---- Purdue University ------------------------------------------------------

const PURDUE: UniversityIntel = {
  university: 'Purdue',
  name: 'Purdue University',
  coverage: 'adequate',
  findings: [
    {
      id: 'purdue-leadership-president-departs-2026',
      university: 'Purdue',
      category: 'leadership',
      headline: 'President left for Northwestern University',
      detail:
        'The board of trustees announced on 18 May 2026 that President Mung Chiang would leave to become president of Northwestern University with effect from 1 July 2026, less than a year after his contract had been extended to 2031. He had led Purdue since January 2023.',
      level: 'attention',
      source: {
        publisher: 'Purdue University',
        url: 'https://www.purdue.edu/newsroom/2026/Q2/purdue-trustees-president-chiang-to-depart-for-northwestern-university-presidency/',
        date: '2026-05-18',
      },
    },
    {
      id: 'purdue-leadership-interim-president-2026',
      university: 'Purdue',
      category: 'leadership',
      headline: 'Former president returned as interim leader within a week',
      detail:
        'Mitch Daniels, Purdue\'s president from 2013 to 2022, was appointed interim president from 1 July 2026 while a permanent search runs. The speed of the appointment and the familiarity of the appointee limit the disruption risk from the transition.',
      level: 'info',
      source: {
        publisher: 'WFYI',
        url: 'https://www.wfyi.org/education/2026-05-25/mitch-daniels-returns-to-lead-purdue-as-interim-president',
        date: '2026-05-25',
      },
    },
    {
      id: 'purdue-funding-research-awards-growth-2026',
      university: 'Purdue',
      category: 'funding',
      headline: 'Research awards projected to exceed $600 million, up on the prior year',
      detail:
        'Purdue reported sponsored research expenditure above $1 billion and projected new research awards over $600 million, against $574.7 million the year before. It is one of the few universities in this corpus reporting research growth rather than contraction.',
      level: 'info',
      source: {
        publisher: 'Purdue University Office of Research',
        url: 'https://research.purdue.edu/about/research-updates/academic-and-research-excellence-updates/are-2026-06-29/',
        date: '2026-06-29',
      },
    },
    {
      id: 'purdue-policy-nationality-based-graduate-limits-2025',
      university: 'Purdue',
      category: 'policy',
      headline: 'Graduate admissions restricted for applicants from certain countries',
      detail:
        'Following a congressional inquiry into foreign nationals in advanced STEM programmes, Purdue began restricting graduate admissions for students from China and several other countries. India is not among the countries reported as restricted, but the episode shows nationality-based screening now operating at the graduate admissions stage.',
      level: 'attention',
      programmeTags: ['MS Computer Science', 'MS Electrical Engineering', 'MS Mechanical Engineering', 'MEng ECE'],
      source: {
        publisher: 'Forbes',
        url: 'https://www.forbes.com/sites/annaesakismith/2025/12/17/purdue-limits-graduate-students-from-china-after-congressional-inquiry/',
        date: '2025-12-17',
      },
    },
  ],
}

// ---- Northeastern University ------------------------------------------------

const NORTHEASTERN: UniversityIntel = {
  university: 'Northeastern',
  name: 'Northeastern University',
  coverage: 'thin',
  note:
    'Only two well-sourced, dated findings could be established. Northeastern is one of the largest hosts of international students in the United States, but it publishes very little on its federal research exposure, endowment position or international enrolment, and no national outlet has reported figures for it in this cycle. No adverse coverage, no funding disclosure and no ranking movement was found from a datable source. The absence of adverse findings here should be read as absence of evidence, not evidence of stability.',
  findings: [
    {
      id: 'northeastern-policy-new-york-campus-2026',
      university: 'Northeastern',
      category: 'policy',
      headline: 'New York City campus opened through the Marymount Manhattan merger',
      detail:
        'Northeastern completed its merger with Marymount Manhattan College in July 2026, opening a fourteenth campus on the Upper East Side with 55 teaching spaces and 750 student beds. About 1,000 existing Marymount students transferred with no tuition change, and the university is exploring adding graduate degrees at the site.',
      level: 'info',
      source: {
        publisher: 'Northeastern Global News',
        url: 'https://news.northeastern.edu/2026/07/10/new-york-city-campus-launch/',
        date: '2026-07-10',
      },
    },
    {
      id: 'northeastern-leadership-provost-turnover-2026',
      university: 'Northeastern',
      category: 'leadership',
      headline: 'Provost left after under a year; a two-year interim was appointed',
      detail:
        'Provost Beth Winkelstein left the role less than a year after taking it up in autumn 2025, with the university declining to explain why. Tom Sheahan, a 35-year member of the institution, was named interim provost for a two-year term. Two provosts inside twelve months is a governance signal worth noting, though academic operations were unaffected.',
      level: 'attention',
      source: {
        publisher: 'The Huntington News',
        url: 'https://huntnewsnu.com/93291/primary-homepage/aoun-announces-tom-sheahan-as-interim-provost-following-winkelsteins-departure/',
        date: '2026-06-01',
      },
    },
  ],
}

// ---- Arizona State University -----------------------------------------------

const ASU: UniversityIntel = {
  university: 'ASU',
  name: 'Arizona State University',
  coverage: 'adequate',
  findings: [
    {
      id: 'asu-policy-international-enrolment-down-2026',
      university: 'ASU',
      category: 'policy',
      headline: 'International enrolment down about 20% this autumn',
      detail:
        'ASU enrolled roughly 11,000 international students for autumn 2026, against about 14,000 a year earlier — a fall of around 20% that the university attributes to visa processing delays and shifting immigration policy. Some students had visas revoked and left the country; the university is offering alternative pathways for those held up abroad.',
      level: 'attention',
      source: {
        publisher: "Arizona's Family (KPHO)",
        url: 'https://www.azfamily.com/video/2026/08/14/asu-international-enrollment-drops-20-heres-why/',
        date: '2026-08-13',
      },
    },
    {
      id: 'asu-policy-visa-appointment-slowdown-2025',
      university: 'ASU',
      category: 'policy',
      headline: 'Visa appointment slowdown had already dented enrolment the previous year',
      detail:
        'ASU reported in August 2025 that international enrolment was being held back by students\' inability to secure consular appointments under revised federal guidance. The two-year pattern matters for disbursement scheduling: arrival dates at ASU have slipped for reasons outside the student\'s control.',
      level: 'attention',
      source: {
        publisher: 'Inside Higher Ed',
        url: 'https://www.insidehighered.com/news/quick-takes/2025/08/13/visa-appointment-slowdown-hinders-asu-international-enrollment',
        date: '2025-08-13',
      },
    },
    {
      id: 'asu-funding-research-expenditure-record-2025',
      university: 'ASU',
      category: 'funding',
      headline: 'Research expenditure passed $1 billion for the first time',
      detail:
        'ASU reported total research expenditure of $1.003 billion for the 2024 fiscal year, ranking 37th nationally and 21st among public universities. The research base is broad and comparatively less dependent on the federal agencies whose budgets have been cut hardest.',
      level: 'info',
      source: {
        publisher: 'ASU News',
        url: 'https://news.asu.edu/20251229-science-and-technology-research-expenditures-ranking-underscores-asus-dramatic-growth',
        date: '2025-12-29',
      },
    },
  ],
}

// ---- University of Texas at Dallas ------------------------------------------

const UT_DALLAS: UniversityIntel = {
  university: 'UT Dallas',
  name: 'University of Texas at Dallas',
  coverage: 'adequate',
  findings: [
    {
      id: 'utdallas-policy-indian-enrolment-fall-2026',
      university: 'UT Dallas',
      category: 'policy',
      headline: 'International enrolment fell 23%, with Indian students the largest share of the fall',
      detail:
        'International enrolment dropped from 5,603 in autumn 2024 to 4,298 in autumn 2025, a fall of 1,305 students. Indian students went from 3,602 to 2,465 over the same period, taking their share of the international cohort from 64% to 57% — the sharpest fall of any group at a university where over half the international population is at graduate level.',
      level: 'attention',
      programmeTags: ['MS Computer Science', 'MS Data Science', 'MS Business Analytics', 'MS Electrical Engineering'],
      source: {
        publisher: 'The Dallas Express',
        url: 'https://dallasexpress.com/education/foreign-students-fuel-127-million-revenue-at-utd-even-as-enrollment-falls/',
        date: '2026-02-01',
      },
    },
    {
      id: 'utdallas-policy-immigration-bulletin-2026',
      university: 'UT Dallas',
      category: 'policy',
      headline: 'University publishes a monthly immigration bulletin for its international students',
      detail:
        'The international students and scholars office issues a monthly bulletin tracking federal immigration changes affecting enrolled students. It is a practical signal that the institution is actively managing status risk, and a source an applicant can be pointed to for current requirements.',
      level: 'info',
      source: {
        publisher: 'UT Dallas International Students and Scholars Office',
        url: 'https://isso.utdallas.edu/2026/06/03/immigration-news-june-2026/',
        date: '2026-06-03',
      },
    },
    {
      id: 'utdallas-leadership-president-appointed-2025',
      university: 'UT Dallas',
      category: 'leadership',
      headline: 'New president took office in August 2025',
      detail:
        'Prabhas V. Moghe, previously executive vice president for academic affairs at Rutgers, was named president and took office on 2 August 2025, succeeding Richard Benson. The leadership position is settled and no further transition is pending.',
      level: 'info',
      source: {
        publisher: 'UT Dallas News Center',
        url: 'https://news.utdallas.edu/campus-community/dr-prabhas-v-moghe-officially-named-ut-dallas-president-2025',
        date: '2025-05-30',
      },
    },
  ],
}

// ---- New York University ----------------------------------------------------

const NYU: UniversityIntel = {
  university: 'NYU',
  name: 'New York University',
  coverage: 'adequate',
  findings: [
    {
      id: 'nyu-funding-deficit-2026',
      university: 'NYU',
      category: 'funding',
      headline: 'Ran a $71 million deficit as federal funding and enrolment both fell',
      detail:
        'President Linda Mills reported a $71 million shortfall driven by lost research grants, reduced federal financial aid and lower enrolment among international and graduate students. She also named capped federal student loans as a contributing factor — relevant because international students at NYU cannot access US financial aid at all.',
      level: 'attention',
      source: {
        publisher: 'Washington Square News',
        url: 'https://nyunews.com/news/2026/02/13/linda-mills-revenue-down-cuts/',
        date: '2026-02-13',
      },
    },
    {
      id: 'nyu-policy-international-student-support-2026',
      university: 'NYU',
      category: 'policy',
      headline: 'Free emergency summer housing offered to international students unable to travel',
      detail:
        'NYU opened free summer housing, with a grant covering a meal plan, to undergraduate and graduate international students unable to travel or return home safely. International students make up more than a quarter of the student body. The measure reduces the risk of an unbudgeted vacation-period living cost for the borrower.',
      level: 'info',
      source: {
        publisher: 'Washington Square News',
        url: 'https://nyunews.com/news/2026/03/13/university-senate-abu-dhabi/',
        date: '2026-03-13',
      },
    },
    {
      id: 'nyu-adverse-federal-agreement-programme-change-2026',
      university: 'NYU',
      category: 'adverse',
      headline: 'A doctoral programme partnership was cut following a federal investigation',
      detail:
        'NYU ended a partnership attached to one of its doctoral programmes after reaching an agreement with the federal Department of Education. The change was specific to that programme and did not affect the taught masters courses most Indian applicants enrol in.',
      level: 'info',
      source: {
        publisher: 'Washington Square News',
        url: 'https://nyunews.com/news/2026/02/24/phd-program-education-department-agreement/',
        date: '2026-02-24',
      },
    },
  ],
}

// ---- University of Southern California --------------------------------------

const USC: UniversityIntel = {
  university: 'USC',
  name: 'University of Southern California',
  coverage: 'adequate',
  findings: [
    {
      id: 'usc-funding-layoffs-and-deficit-2025',
      university: 'USC',
      category: 'funding',
      headline: 'Over 900 layoff notices issued against a deficit above $200 million',
      detail:
        'USC issued more than 900 layoff notices from July 2025, including student advisers and administrative staff, as its operating deficit passed $200 million. Leadership cited reduced federal research funding and falling international enrolment as the principal causes.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/university-southern-california-900-layoffs-deficit/804575/',
        date: '2025-11-04',
      },
    },
    {
      id: 'usc-adverse-student-services-impact-2026',
      university: 'USC',
      category: 'adverse',
      headline: 'Cuts reached student-facing services',
      detail:
        'Reporting in March 2026 documented the effect of the budget reductions on students, staff and faculty, including advising and support functions. An applicant should expect leaner student services than the university\'s marketing implies, at least through the current cycle.',
      level: 'attention',
      source: {
        publisher: 'Daily Trojan',
        url: 'https://dailytrojan.com/2026/03/29/usc-budget-cuts-and-layoffs-impact-students-staff-faculty/',
        date: '2026-03-29',
      },
    },
    {
      id: 'usc-leadership-president-confirmed-2026',
      university: 'USC',
      category: 'leadership',
      headline: 'Interim leader confirmed as permanent president',
      detail:
        'Beong-Soo Kim, formerly the university\'s general counsel and interim president from mid-2025, was elected USC\'s thirteenth president in February 2026 after overseeing the deficit reduction programme. The appointment ends an eighteen-month period of interim leadership that began when Carol Folt stepped down.',
      level: 'info',
      source: {
        publisher: 'LAist',
        url: 'https://laist.com/brief/news/education/usc-general-counsel-beong-soo-kim-university-president',
        date: '2026-02-04',
      },
    },
    {
      id: 'usc-policy-declined-federal-compact-2025',
      university: 'USC',
      category: 'policy',
      headline: 'Declined a federal funding compact that would have capped international enrolment',
      detail:
        'USC rejected the proposed Compact for Academic Excellence in Higher Education, which offered preferential federal funding in exchange for terms including a 15% ceiling on international undergraduate enrolment. Declining protects the university\'s international intake but forgoes the funding preference.',
      level: 'info',
      source: {
        publisher: 'Daily Trojan',
        url: 'https://dailytrojan.com/2025/10/17/usc-rejects-trumps-compact/',
        date: '2025-10-17',
      },
    },
    {
      id: 'usc-policy-congressional-stem-enrolment-inquiry-2025',
      university: 'USC',
      category: 'policy',
      headline: 'Named in a congressional inquiry into foreign nationals in advanced STEM programmes',
      detail:
        'USC was one of six universities asked to disclose its policies on enrolling Chinese nationals in advanced STEM programmes connected to federally funded research. The inquiry concerns nationality-based screening at graduate admission and does not name Indian applicants.',
      level: 'info',
      programmeTags: ['MS Computer Science', 'MS Electrical Engineering', 'MS Data Science'],
      source: {
        publisher: 'US House Select Committee on the Chinese Communist Party',
        url: 'https://selectcommitteeontheccp.house.gov/media/press-releases/chairman-moolenaar-demands-transparency-universities-national-security-risks',
        date: '2025-03-19',
      },
    },
  ],
}

// ---- Stevens Institute of Technology ----------------------------------------

const STEVENS: UniversityIntel = {
  university: 'Stevens',
  name: 'Stevens Institute of Technology',
  coverage: 'thin',
  note:
    'Only two datable findings could be established, both of them the institution\'s own announcements. Stevens is small and privately funded, generates almost no national press coverage, and publishes news items without visible publication dates, so its rankings and graduate-outcomes releases could not be cited to a verifiable date. No federal funding disclosure, no leadership change and no adverse coverage was found. Treat the absence of adverse findings as a coverage limit rather than a clean record.',
  findings: [
    {
      id: 'stevens-funding-school-of-computing-2026',
      university: 'Stevens',
      category: 'funding',
      headline: 'New School of Computing established with $36 million in philanthropic backing',
      detail:
        'The board approved a School of Computing supported by an initial $36 million in philanthropy, launching in autumn 2026 with pathways spanning AI and machine learning, cybersecurity, financial technology, digital health and computational biology. A bachelor\'s degree and a minor in artificial intelligence launch alongside it.',
      level: 'info',
      programmeTags: ['MS Computer Science', 'MS Data Science'],
      source: {
        publisher: 'Stevens Institute of Technology',
        url: 'https://www.stevens.edu/news/stevens-institute-of-technology-establishes-school-of-computing-to-lead-the',
        date: '2026-01-29',
      },
    },
    {
      id: 'stevens-policy-domestic-tuition-waiver-2025',
      university: 'Stevens',
      category: 'policy',
      headline: 'Free tuition from autumn 2026, but only for US citizens and permanent residents',
      detail:
        'Stevens announced full tuition cover for first-year undergraduates from families earning $75,000 or less, starting with the autumn 2026 intake. Eligibility is restricted to US citizens and permanent residents, so the scheme does not reduce the cost of attendance for an international applicant.',
      level: 'info',
      source: {
        publisher: 'Stevens Institute of Technology',
        url: 'https://www.stevens.edu/news/stevens-announces-the-stevens-investment-a-transformative-plan-to-promote',
        date: '2025-09-30',
      },
    },
  ],
}

// ---- Clark University -------------------------------------------------------

const CLARK: UniversityIntel = {
  university: 'Clark',
  name: 'Clark University',
  coverage: 'thin',
  note:
    'Three datable findings, and all of the substantive coverage traces back to a single restructuring announcement in June 2025 plus the university\'s own admissions releases. No research funding disclosure, no ranking movement, no faculty moves and no leadership change could be sourced. The subsequent trade-press reporting on this story sits behind access controls that could not be read, so the figures below are taken only from sources that were read in full.',
  findings: [
    {
      id: 'clark-adverse-faculty-reduction-2025',
      university: 'Clark',
      category: 'adverse',
      headline: 'Faculty to be reduced by up to 30% over three years',
      detail:
        'Facing an incoming undergraduate class roughly 20% below target, Clark announced it would cut up to 30% of faculty and 5% of staff over three years, beginning with retirements and attrition and then non-tenure, pre-tenure and adjunct staff. This is the most severe contraction of any university in this corpus.',
      level: 'attention',
      source: {
        publisher: 'The Boston Globe',
        url: 'https://www.bostonglobe.com/2025/06/06/metro/clark-university-enrollment-layoffs-worcester/',
        date: '2025-06-06',
      },
    },
    {
      id: 'clark-policy-academic-restructure-2025',
      university: 'Clark',
      category: 'policy',
      headline: 'Degree offering consolidated into three thematic schools',
      detail:
        'Clark is refocusing its academic offering around climate, environment and society; media arts, computing and design; and health and human behaviour, phased over three years. Applicants should confirm that a named course still exists in the intended intake, since programmes outside these three areas are the ones being consolidated.',
      level: 'attention',
      programmeTags: ['MS Computer Science', 'MS Data Science', 'MPH', 'MBA', 'MS Finance'],
      source: {
        publisher: 'Clark University',
        url: 'https://www.clarku.edu/news/2025/06/05/clark-to-refocus-around-key-academic-areas-enhanced-interdisciplinary-opportunities/',
        date: '2025-06-05',
      },
    },
    {
      id: 'clark-policy-deposits-recovering-2026',
      university: 'Clark',
      category: 'policy',
      headline: 'Undergraduate deposits up 35% on the prior year',
      detail:
        'Clark reported 625 deposited students for the class entering in 2026, a 35% increase year on year, drawn from 34 states and 29 countries. It is the first evidence that the enrolment shortfall which triggered the restructuring is reversing.',
      level: 'info',
      source: {
        publisher: 'Clark University',
        url: 'https://www.clarku.edu/news/2026/05/02/35-increase-in-students-committing-to-clark/',
        date: '2026-05-02',
      },
    },
  ],
}

// ---- Corpus -----------------------------------------------------------------
// Ordered to match US_UNIVERSITIES so the two can be diffed by eye.

export const UNIVERSITY_INTEL: UniversityIntel[] = [
  MIT,
  STANFORD,
  HARVARD,
  CMU,
  COLUMBIA,
  BERKELEY,
  PURDUE,
  NORTHEASTERN,
  ASU,
  UT_DALLAS,
  NYU,
  USC,
  STEVENS,
  CLARK,
]

/**
 * Look up the dossier for a university. Accepts either the short name used in
 * US_UNIVERSITIES ('UC Berkeley') or the full name ('University of California,
 * Berkeley'), case-insensitively, so callers do not have to normalise first.
 */
export function intelFor(university: string): UniversityIntel | undefined {
  const key = university.trim().toLowerCase()
  if (!key) return undefined
  return UNIVERSITY_INTEL.find(
    (u) => u.university.toLowerCase() === key || u.name.toLowerCase() === key,
  )
}
