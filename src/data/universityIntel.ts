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
//   4. `university` MUST equal `UniversityRef.short` in US_UNIVERSITIES, for
//      every one of the 45. This module is deliberately standalone — no import
//      from lib/ — so the two are kept in step by the string values below,
//      not by a compile-time link.
//
// COVERAGE — 45 UNIVERSITIES, ALL SELECTABLE
// This corpus holds two overlapping sets, and US_UNIVERSITIES now carries both:
//
//   (a) The original 14 on the pre-qualification screen.
//   (b) The 39 US schools in the Financial Times Global MBA Ranking 2026.
//       Eight are already in set (a) — MIT, Harvard, UC Berkeley, NYU, CMU,
//       USC, ASU and UT Dallas — so set (b) added 31 further universities.
//
// One caveat carried over from that extension: the 31 additions have NO `rank`
// in US_UNIVERSITIES, because `rank` feeds overlayFor() and therefore raises
// the unsecured lending ceiling. The existing 14 ranks match no single
// published edition, so nothing could be added consistently without inventing
// numbers that move credit outcomes. Those 31 get no Premier overlay until
// someone sets the ranks deliberately. See the note in lib/eligibility.ts.
//
// A NOTE ON THE FT LIST
// The Financial Times publishes no "top 50 US colleges" ranking. Its US-facing
// product is the Global MBA Ranking, and the 2026 edition contains 39 US
// schools, not 50. Stanford GSB and Columbia Business School do not appear at
// all — both facts are recorded as findings against those universities. Because
// the ranking is MBA-only, every finding drawn from it is tagged ['MBA']; it
// says nothing about the MS programmes that most applicants on this book take.
//
// RESEARCH WINDOW
// Sources span 2025-03-07 to 2026-08-13. The corpus was assembled 2026-08-17.
// The dominant themes: a sustained contraction in US federal research funding,
// the endowment excise tax rise, the elimination of the federal Grad PLUS loan
// from 1 July 2026, and a tightening student-visa regime — all of which bear on
// programme continuity, on how much of the cost a borrower must privately fund,
// and on the post-study earning window.
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

// ---- Shared source ----------------------------------------------------------
// The FT Global MBA Ranking 2026 table, published 2026-02-15. FT's own page is
// paywalled; the table below was read in full from the copy IIM Ahmedabad
// publishes, and the top of the table was cross-checked against Clear Admit's
// 2026-02-15 write-up. Cited once here rather than retyped 41 times.
const FT_MBA_2026: IntelSource = {
  publisher: 'Financial Times — Global MBA Ranking 2026',
  url: 'https://www.iima.ac.in/sites/default/files/2026-02/FT%20Global%20MBA%20Ranking%202026.pdf',
  date: '2026-02-15',
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
      id: 'mit-ranking-ft-mba-2026-first',
      university: 'MIT',
      category: 'ranking',
      headline: 'Sloan took first place in the world for the MBA',
      detail:
        'MIT Sloan rose five places to top the Financial Times Global MBA Ranking 2026, displacing Wharton. It was one of only three US schools in that ranking\'s top ten, in an edition where US representation fell to 39 of the 100 places.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'stanford-ranking-ft-mba-2026-absent',
      university: 'Stanford',
      category: 'ranking',
      headline: 'Stanford Graduate School of Business does not appear in the FT MBA ranking',
      detail:
        'Stanford GSB was absent from the Financial Times Global MBA Ranking 2026 for the second consecutive year, having decided not to participate. Its absence is a choice by the school, not a fall in standing, and no FT position can be quoted for a Stanford MBA applicant.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'harvard-ranking-ft-mba-2026-tenth',
      university: 'Harvard',
      category: 'ranking',
      headline: 'Harvard Business School fell to its lowest MBA ranking on record',
      detail:
        'HBS placed tenth in the Financial Times Global MBA Ranking 2026, its weakest position since the ranking began in 1999. The school remains inside the top ten, but the direction of travel is down.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'cmu-ranking-ft-mba-2026-41st',
      university: 'CMU',
      category: 'ranking',
      headline: 'Tepper placed joint 41st in the world for the MBA',
      detail:
        'Carnegie Mellon Tepper ranked joint 41st in the Financial Times Global MBA Ranking 2026, up from 49th the previous year but still below its 33rd place two years earlier.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'columbia-ranking-ft-mba-2026-absent',
      university: 'Columbia',
      category: 'ranking',
      headline: 'Columbia Business School dropped out of the FT MBA ranking entirely',
      detail:
        'Having finished inside the top five the previous year, Columbia Business School did not appear in the Financial Times Global MBA Ranking 2026 at all, after failing to meet the threshold for alumni survey responses. This is a data-submission failure rather than a judgement on the programme, but no FT position exists for the current year.',
      level: 'attention',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'ucberkeley-ranking-ft-mba-2026-ninth',
      university: 'UC Berkeley',
      category: 'ranking',
      headline: 'Haas rose into the world top ten for the MBA',
      detail:
        'Berkeley Haas climbed to ninth in the Financial Times Global MBA Ranking 2026, up from fifteenth, one of the few US schools to gain ground in an edition where American representation shrank.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'asu-ranking-ft-mba-2026-54th',
      university: 'ASU',
      category: 'ranking',
      headline: 'W. P. Carey placed 54th in the world for the MBA',
      detail:
        'Arizona State\'s W. P. Carey School ranked 54th in the Financial Times Global MBA Ranking 2026, up from 59th the previous year. It is the highest-placed of the large public universities on this book aside from the Californian and Texan flagships.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'utdallas-ranking-ft-mba-2026-68th',
      university: 'UT Dallas',
      category: 'ranking',
      headline: 'The Jindal School placed 68th in the world for the MBA',
      detail:
        'UT Dallas\'s Naveen Jindal School ranked 68th in the Financial Times Global MBA Ranking 2026, down from 54th the previous year — the steepest single-year fall of any US school in the table. It is the lowest-ranked US entry among the universities currently selectable on this book.',
      level: 'attention',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'nyu-ranking-ft-mba-2026-23rd',
      university: 'NYU',
      category: 'ranking',
      headline: 'Stern placed 23rd in the world for the MBA',
      detail:
        'NYU Stern ranked 23rd in the Financial Times Global MBA Ranking 2026, up from 31st the previous year — one of the stronger US movements in an edition where most American schools slipped.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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
      id: 'usc-ranking-ft-mba-2026-46th',
      university: 'USC',
      category: 'ranking',
      headline: 'Marshall placed 46th in the world for the MBA',
      detail:
        'USC Marshall ranked 46th in the Financial Times Global MBA Ranking 2026, up from 50th the previous year though below its 33rd place two years earlier. The improvement sits against the university\'s wider budget contraction.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
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

// ============================================================================
// FT GLOBAL MBA RANKING 2026 — THE 31 UNIVERSITIES NOT YET SELECTABLE
// Ordered by FT rank. None of these appear in US_UNIVERSITIES yet; see the
// "COVERAGE — TWO POPULATIONS" note at the top of this file.
// ============================================================================

const PENN: UniversityIntel = {
  university: 'Penn',
  name: 'University of Pennsylvania',
  coverage: 'adequate',
  findings: [
    {
      id: 'penn-ranking-ft-mba-2026-third',
      university: 'Penn',
      category: 'ranking',
      headline: 'Wharton lost the world number-one MBA place it had held for two years',
      detail:
        'Wharton fell to third in the Financial Times Global MBA Ranking 2026 after two consecutive years at the top. It remains the highest-placed US school after MIT Sloan.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'penn-policy-grad-plus-withdrawal-2026',
      university: 'Penn',
      category: 'policy',
      headline: 'Federal Grad PLUS loan ends and graduate borrowing is capped at $100,000',
      detail:
        'Penn identified the elimination of the Grad PLUS loan programme and new lifetime federal borrowing caps — $100,000 for graduate students, $200,000 for professional students — as a direct pressure on its roughly 14,000 graduate and professional students. For an overseas applicant this matters indirectly but sharply: it removes the federal option for domestic classmates and shifts the whole cohort towards private lending.',
      level: 'attention',
      programmeTags: ['MBA', 'MS Finance', 'MS Business Analytics'],
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/penn-budget-measures-endowment-tax-federal-policy/811047/',
        date: '2026-01-30',
      },
    },
    {
      id: 'penn-funding-expenditure-reduction-2026',
      university: 'Penn',
      category: 'funding',
      headline: 'Schools told to cut spending 4% as the endowment tax bill climbs',
      detail:
        'Penn directed every school and centre to reduce certain expenditures by 4% for the coming financial year. It projects an endowment tax bill of $58.5 million for the 2026 financial year, rising to $84.6 million by 2030, having moved from the 1.4% band into the 4% band.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/penn-budget-measures-endowment-tax-federal-policy/811047/',
        date: '2026-01-30',
      },
    },
    {
      id: 'penn-adverse-federal-funding-withheld-2025',
      university: 'Penn',
      category: 'adverse',
      headline: '$175 million in federal funding was withheld over an athletics dispute',
      detail:
        'Penn learned through news reports that $175 million in federal funding had been withheld, in what was presented as a response to a transgender athlete competing three years earlier. The funding was later partly restored through negotiation.',
      level: 'info',
      source: {
        publisher: 'Inside Higher Ed',
        url: 'https://www.insidehighered.com/news/quick-takes/2025/03/26/penn-pledges-address-175m-federal-funding-cut',
        date: '2025-03-26',
      },
    },
  ],
}

const NORTHWESTERN: UniversityIntel = {
  university: 'Northwestern',
  name: 'Northwestern University',
  coverage: 'adequate',
  findings: [
    {
      id: 'northwestern-ranking-ft-mba-2026-11th',
      university: 'Northwestern',
      category: 'ranking',
      headline: 'Kellogg placed 11th in the world for the MBA',
      detail:
        'Northwestern Kellogg ranked 11th in the Financial Times Global MBA Ranking 2026, just outside the top ten and down from tenth the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'northwestern-funding-jobs-cut-2025',
      university: 'Northwestern',
      category: 'funding',
      headline: '425 posts cut after $790 million in federal funding was frozen',
      detail:
        'Northwestern eliminated about 425 staff positions, roughly 5% of its staffing budget, after some $790 million in federal funds were frozen and around 150 stop-work orders and grant terminations arrived from federal agencies. Leaders called it among the most difficult periods in the institution\'s 174-year history.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/northwestern-university-425-jobs-cut-layoffs-funding-freeze-investigations/756356/',
        date: '2025-07-30',
      },
    },
    {
      id: 'northwestern-adverse-federal-settlement-2025',
      university: 'Northwestern',
      category: 'adverse',
      headline: 'Paid $75 million to settle federal claims and restore funding',
      detail:
        'Northwestern agreed to pay the federal government $75 million through 2028 in exchange for closing all pending investigations and restoring eligibility for federal grants, contracts and awards. Frozen funding was expected back within 30 days.',
      level: 'info',
      source: {
        publisher: 'NPR',
        url: 'https://www.npr.org/2025/11/29/nx-s1-5624964/northwestern-trump-funding-settlement',
        date: '2025-11-29',
      },
    },
    {
      id: 'northwestern-leadership-new-president-2026',
      university: 'Northwestern',
      category: 'leadership',
      headline: 'Recruited Purdue\'s president as its eighteenth leader',
      detail:
        'Mung Chiang, president of Purdue, was named Northwestern\'s eighteenth president with effect from 1 July 2026. He succeeds Michael Schill, who stepped down in September 2025 after a turbulent period. The same move leaves Purdue under an interim president.',
      level: 'info',
      source: {
        publisher: 'The Daily Northwestern',
        url: 'https://dailynorthwestern.com/2026/05/18/top-stories/purdue-president-mung-chiang-named-18th-president-of-northwestern/',
        date: '2026-05-18',
      },
    },
  ],
}

const CORNELL: UniversityIntel = {
  university: 'Cornell',
  name: 'Cornell University',
  coverage: 'adequate',
  findings: [
    {
      id: 'cornell-ranking-ft-mba-2026-15th',
      university: 'Cornell',
      category: 'ranking',
      headline: 'Johnson slipped from ninth to fifteenth in the world',
      detail:
        'Cornell Johnson fell six places to fifteenth in the Financial Times Global MBA Ranking 2026, one of the larger declines among established US programmes.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'cornell-funding-federal-settlement-2025',
      university: 'Cornell',
      category: 'funding',
      headline: 'Paid $60 million to restore more than $250 million of federal funding',
      detail:
        'Cornell agreed to pay $30 million to the federal government and invest a further $30 million in agricultural research over three years, restoring over $250 million in paused and previously ineligible grants and closing federal civil rights investigations. It was the fourth Ivy League institution to settle.',
      level: 'info',
      source: {
        publisher: 'The Cornell Daily Sun',
        url: 'https://www.cornellsun.com/article/2025/11/cornell-reaches-settlement-with-trump-administration-to-restore-federal-funding',
        date: '2025-11-07',
      },
    },
    {
      id: 'cornell-policy-admissions-data-reporting-2025',
      university: 'Cornell',
      category: 'policy',
      headline: 'Must report anonymised admissions data to the federal government until 2028',
      detail:
        'Under the settlement Cornell provides quarterly anonymised undergraduate admissions data — including race, grade average and test scores — for federal audit, with the agreement running to 31 December 2028. The agreement expressly denies the government authority over academic content or curricula.',
      level: 'info',
      source: {
        publisher: 'The Cornell Daily Sun',
        url: 'https://www.cornellsun.com/article/2025/11/cornell-reaches-settlement-with-trump-administration-to-restore-federal-funding',
        date: '2025-11-07',
      },
    },
    {
      id: 'cornell-funding-continued-austerity-2025',
      university: 'Cornell',
      category: 'funding',
      headline: 'Leadership warned further urgent cost action was needed',
      detail:
        'Cornell warned that more urgent action was required to contain costs, citing the federal research freeze alongside rising costs, staff expansion, extraordinary legal expenses and growth in financial aid. Around 180 staff were laid off across the year, with reductions continuing into 2026 even after the settlement.',
      level: 'attention',
      source: {
        publisher: 'Forbes',
        url: 'https://www.forbes.com/sites/michaeltnietzel/2025/08/23/cornell-university-warns-moreurgent-action-needed-to-rein-in-costs/',
        date: '2025-08-23',
      },
    },
  ],
}

const DUKE: UniversityIntel = {
  university: 'Duke',
  name: 'Duke University',
  coverage: 'adequate',
  findings: [
    {
      id: 'duke-ranking-ft-mba-2026-16th',
      university: 'Duke',
      category: 'ranking',
      headline: 'Fuqua placed 16th in the world for the MBA',
      detail:
        'Duke Fuqua ranked 16th in the Financial Times Global MBA Ranking 2026, down from 11th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'duke-funding-cost-programme-2025',
      university: 'Duke',
      category: 'funding',
      headline: 'A $364 million cost-cutting programme, delivered largely through buyouts',
      detail:
        'Duke set out to remove $364 million from its cost base and had realised $299 million by the end of 2025 through buyouts and building closures, with about 599 employees accepting voluntary separation. The president said Duke would have to be smaller and employ fewer people.',
      level: 'attention',
      source: {
        publisher: 'The Duke Chronicle',
        url: 'https://dukechronicle.com/article/duke-university-cost-cutting-program-2025-strategic-realignment-federal-funding-vsip-20251228',
        date: '2025-12-28',
      },
    },
    {
      id: 'duke-adverse-audit-disputes-cuts-2026',
      university: 'Duke',
      category: 'adverse',
      headline: 'An independent audit found no financial justification for the cuts',
      detail:
        'An audit commissioned by Duke\'s AAUP chapter concluded the university was in very strong financial condition — over $14 billion in unrestricted reserves, assets above $32 billion, and no year-on-year decline in federal research funding — and that claims of budget holes were unsupported. The finding is contested but is on the public record alongside roughly 600 separations.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/dukes-budget-and-employee-cuts-called-into-question-by-audit/811164/',
        date: '2026-02-02',
      },
    },
  ],
}

const YALE: UniversityIntel = {
  university: 'Yale',
  name: 'Yale University',
  coverage: 'adequate',
  findings: [
    {
      id: 'yale-ranking-ft-mba-2026-17th',
      university: 'Yale',
      category: 'ranking',
      headline: 'Yale School of Management placed joint 17th in the world',
      detail:
        'Yale School of Management ranked joint 17th in the Financial Times Global MBA Ranking 2026, up from 24th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'yale-funding-endowment-tax-300m-2025',
      university: 'Yale',
      category: 'funding',
      headline: 'Braced for $300 million a year in endowment tax, with layoffs expected',
      detail:
        'Yale expects the endowment tax rise from 1.4% to 8% to cost roughly $300 million annually from 2026, and told staff that layoffs may be necessary in units where other measures fall short, aiming to complete any reductions by the end of 2026.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/yale-university-expects-layoffs-endowment-tax/807107/',
        date: '2025-12-05',
      },
    },
    {
      id: 'yale-funding-austerity-measures-2025',
      university: 'Yale',
      category: 'funding',
      headline: 'Hiring paused, building deferred and non-salary spending cut 5%',
      detail:
        'Yale paused hiring, deferred building projects, cut non-salary expenses by 5% and offered early retirement buyouts to administrative staff, citing both the endowment tax and cuts to federal research funding and student financial aid.',
      level: 'attention',
      source: {
        publisher: 'The Connecticut Mirror',
        url: 'https://ctmirror.org/2025/12/05/yale-endowment-tax-layoffs/',
        date: '2025-12-05',
      },
    },
  ],
}

const UVA: UniversityIntel = {
  university: 'UVA',
  name: 'University of Virginia',
  coverage: 'adequate',
  findings: [
    {
      id: 'uva-ranking-ft-mba-2026-19th',
      university: 'UVA',
      category: 'ranking',
      headline: 'Darden placed 19th in the world for the MBA',
      detail:
        'UVA Darden ranked 19th in the Financial Times Global MBA Ranking 2026, up one place from the previous year and holding its position better than most US schools in this edition.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'uva-leadership-president-resigned-2025',
      university: 'UVA',
      category: 'leadership',
      headline: 'President resigned under federal pressure',
      detail:
        'President James Ryan resigned in June 2025 as the university sought to resolve a federal investigation into its diversity commitments, a day after reporting that the government had conditioned closing the investigation on his departure.',
      level: 'attention',
      source: {
        publisher: 'Inside Higher Ed',
        url: 'https://www.insidehighered.com/news/government/politics-elections/2025/06/27/university-virginia-president-resigns-after-trumps',
        date: '2025-06-27',
      },
    },
    {
      id: 'uva-policy-federal-agreement-no-payment-2025',
      university: 'UVA',
      category: 'policy',
      headline: 'Settled federal investigations without paying anything',
      detail:
        'UVA reached an agreement pausing several federal investigations with no financial settlement and no external monitor, unlike the Columbia and Brown deals. The president must personally certify compliance each quarter.',
      level: 'info',
      source: {
        publisher: 'CNN',
        url: 'https://www.cnn.com/2025/10/22/politics/uva-trump-administration-settlement',
        date: '2025-10-22',
      },
    },
  ],
}

const CHICAGO: UniversityIntel = {
  university: 'Chicago',
  name: 'University of Chicago',
  coverage: 'adequate',
  findings: [
    {
      id: 'chicago-ranking-ft-mba-2026-20th',
      university: 'Chicago',
      category: 'ranking',
      headline: 'Booth fell from tenth to twentieth in two years',
      detail:
        'Chicago Booth ranked 20th in the Financial Times Global MBA Ranking 2026, down from 17th the previous year and from 10th two years earlier — one of the steeper sustained declines among top US programmes.',
      level: 'attention',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'chicago-funding-100m-cuts-2025',
      university: 'Chicago',
      category: 'funding',
      headline: '$100 million of cuts against a large recurring operating deficit',
      detail:
        'Chicago moved to shed $100 million in costs and eliminate 100 to 150 staff posts, after operating deficits of $201.7 million and $193.7 million in successive years. The president said annual income still falls short of expenses and that the position cannot continue.',
      level: 'attention',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/university-chicago-100-million-job-cuts/759051/',
        date: '2025-09-02',
      },
    },
    {
      id: 'chicago-policy-phd-intake-paused-2025',
      university: 'Chicago',
      category: 'policy',
      headline: 'Doctoral admissions paused in 19 programmes for 2026-27',
      detail:
        'Chicago paused PhD enrolment across 19 programmes for the 2026-27 year, almost all in the humanities and liberal arts, alongside scaled-back capital projects and a review of academic centres. Taught masters and MBA intakes were not part of the pause.',
      level: 'info',
      source: {
        publisher: 'Higher Ed Dive',
        url: 'https://www.highereddive.com/news/university-chicago-100-million-job-cuts/759051/',
        date: '2025-09-02',
      },
    },
  ],
}

const DARTMOUTH: UniversityIntel = {
  university: 'Dartmouth',
  name: 'Dartmouth College',
  coverage: 'thin',
  note:
    'Two datable findings. Dartmouth moved into the 4% endowment tax band and its president has spoken publicly against the rise, but that reporting and the student paper\'s coverage carry no day-level dates that could be verified, so the tax exposure is not recorded as a finding. No leadership change, faculty move or adverse coverage was found. Dartmouth appears to be under less acute federal-funding pressure than its peers, but this corpus cannot evidence that either way.',
  findings: [
    {
      id: 'dartmouth-ranking-ft-mba-2026-26th',
      university: 'Dartmouth',
      category: 'ranking',
      headline: 'Tuck fell six places to 26th in the world',
      detail:
        'Dartmouth Tuck ranked 26th in the Financial Times Global MBA Ranking 2026, down from 20th the previous year and 12th two years earlier.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'dartmouth-funding-fy2026-budget-2025',
      university: 'Dartmouth',
      category: 'funding',
      headline: 'Trustees approved a $1.6 billion budget with financial aid increased',
      detail:
        'Dartmouth\'s trustees approved a $1.6 billion operating budget for the 2026 financial year, including $312 million for financial aid — a $15 million increase — with the endowment contributing $470 million. It is one of the few institutions in this corpus increasing rather than trimming aid.',
      level: 'info',
      source: {
        publisher: 'Dartmouth',
        url: 'https://home.dartmouth.edu/news/2025/06/board-trustees-meet-june-2025',
        date: '2025-06-20',
      },
    },
  ],
}

const UCLA: UniversityIntel = {
  university: 'UCLA',
  name: 'University of California, Los Angeles',
  coverage: 'adequate',
  findings: [
    {
      id: 'ucla-ranking-ft-mba-2026-32nd',
      university: 'UCLA',
      category: 'ranking',
      headline: 'Anderson dropped sharply to 32nd in the world',
      detail:
        'UCLA Anderson ranked 32nd in the Financial Times Global MBA Ranking 2026, down from 19th the previous year — among the sharpest single-year falls of any established US programme.',
      level: 'attention',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'ucla-adverse-billion-dollar-settlement-demand-2025',
      university: 'UCLA',
      category: 'adverse',
      headline: 'Federal government demanded $1 billion to unfreeze research grants',
      detail:
        'After $584 million of research funding was frozen, the administration demanded UCLA pay $1 billion over three years plus $172 million into a claims fund in exchange for restoration. It was among the largest financial demands ever made of a university.',
      level: 'attention',
      source: {
        publisher: 'Daily Bruin',
        url: 'https://dailybruin.com/2025/08/08/proposed-ucla-settlement-from-federal-government-seeks-1-billion-policy-changes',
        date: '2025-08-08',
      },
    },
    {
      id: 'ucla-funding-settlement-appeal-dropped-2026',
      university: 'UCLA',
      category: 'funding',
      headline: 'The settlement demand was blocked and the appeal abandoned',
      detail:
        'A federal judge restored the great majority of UCLA\'s frozen grants, and in February 2026 the administration dropped its appeal against the order blocking the $1.2 billion settlement demand. The immediate threat to UCLA\'s research base has receded.',
      level: 'info',
      source: {
        publisher: 'Daily Bruin',
        url: 'https://dailybruin.com/2026/02/13/trump-administration-drops-appeal-of-order-blocking-1-2-billion-ucla-settlement',
        date: '2026-02-13',
      },
    },
  ],
}

const MICHIGAN: UniversityIntel = {
  university: 'Michigan',
  name: 'University of Michigan',
  coverage: 'adequate',
  findings: [
    {
      id: 'michigan-ranking-ft-mba-2026-34th',
      university: 'Michigan',
      category: 'ranking',
      headline: 'Ross placed joint 34th in the world for the MBA',
      detail:
        'Michigan Ross ranked joint 34th in the Financial Times Global MBA Ranking 2026, up from 29th — its first ranked appearance in three years.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'michigan-funding-bridge-support-2026',
      university: 'Michigan',
      category: 'funding',
      headline: 'University stepped in to part-fund research hit by federal cuts',
      detail:
        'Michigan began partly funding faculty research projects affected by federal cuts. Its research expenditure reached a record $2.04 billion in 2024, of which $1.17 billion was federal, and a proposed 10% cap on indirect-cost reimbursement for NIH grants would remove around $92 million.',
      level: 'attention',
      source: {
        publisher: 'The Detroit News',
        url: 'https://www.detroitnews.com/story/news/local/michigan/2026/01/26/university-michigan-fund-faculty-research-impacted-federal-cuts/88359543007/',
        date: '2026-01-26',
      },
    },
    {
      id: 'michigan-leadership-presidency-vacancy-2026',
      university: 'Michigan',
      category: 'leadership',
      headline: 'A third year without a settled president',
      detail:
        'Santa Ono left the presidency in May 2025 after under three years. The regents appointed a successor in January 2026, but that appointment did not proceed after the appointee withdrew on health grounds, leaving the interim president in place and the search reopened.',
      level: 'attention',
      source: {
        publisher: 'The Detroit News',
        url: 'https://eu.detroitnews.com/story/news/local/michigan/2026/04/16/university-of-michigan-presidency-vacancy-crisis-kent-syverud-brain-cancer/89625456007/',
        date: '2026-04-16',
      },
    },
  ],
}

const WASHU: UniversityIntel = {
  university: 'WashU',
  name: 'Washington University in St. Louis',
  coverage: 'adequate',
  findings: [
    {
      id: 'washu-ranking-ft-mba-2026-37th',
      university: 'WashU',
      category: 'ranking',
      headline: 'Olin placed 37th in the world for the MBA',
      detail:
        'Washington University\'s Olin School ranked 37th in the Financial Times Global MBA Ranking 2026, up from 42nd the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'washu-funding-job-cuts-2025',
      university: 'WashU',
      category: 'funding',
      headline: '316 posts cut and 198 vacancies closed for $52 million of savings',
      detail:
        'The chancellor announced the elimination of 316 staff positions and closure of 198 vacant roles, saving $52 million a year, citing federal research cuts. A new tax on the $12 billion endowment adds a further $37 million to the annual budget, and merit raises were skipped for the year.',
      level: 'attention',
      source: {
        publisher: 'St. Louis Public Radio',
        url: 'https://www.stlpr.org/education/2025-10-01/washington-university-cuts-316-jobs-eliminates-nearly-200-vacant-positions',
        date: '2025-10-01',
      },
    },
    {
      id: 'washu-funding-deficit-smaller-than-feared-2025',
      university: 'WashU',
      category: 'funding',
      headline: 'Projected deficit came in far smaller than expected',
      detail:
        'Leadership projected a $7.4 million deficit for the 2026 financial year, described as smaller than anticipated. Capital projects on the Danforth campus, including a new Arts and Sciences building, were cancelled or postponed.',
      level: 'info',
      source: {
        publisher: 'Student Life',
        url: 'https://www.studlife.com/news/2025/10/07/washu-leadership-shares-updates-on-university-budget-projects-a-smaller-than-anticipated-7-4-million-deficit-in-fiscal-year-2026',
        date: '2025-10-07',
      },
    },
  ],
}

const RICE: UniversityIntel = {
  university: 'Rice',
  name: 'Rice University',
  coverage: 'thin',
  note:
    'Two datable findings. Rice is expanding — a 30% undergraduate enrolment increase to 2028 and faculty growth of 25-30% — while reporting federal funding down 26% on the year, but that reporting sits on undated institutional pages and a broadcast piece with no verifiable date, so neither figure is recorded as a finding. No leadership change or adverse coverage was found.',
  findings: [
    {
      id: 'rice-ranking-ft-mba-2026-38th',
      university: 'Rice',
      category: 'ranking',
      headline: 'Jones placed 38th in the world for the MBA',
      detail:
        'Rice\'s Jones Graduate School ranked 38th in the Financial Times Global MBA Ranking 2026, up from 39th and broadly holding position.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'rice-policy-financial-aid-expansion-2026',
      university: 'Rice',
      category: 'policy',
      headline: 'Free tuition extended to families earning up to $200,000',
      detail:
        'Rice expanded its financial aid programme from autumn 2027 to cover full tuition for undergraduates from families earning up to $200,000, with tuition, fees, room and board covered below $100,000. The scheme is undergraduate and does not reach the graduate programmes most applicants on this book take.',
      level: 'info',
      source: {
        publisher: 'Forbes',
        url: 'https://www.forbes.com/sites/michaeltnietzel/2026/08/04/rice-becomes-the-latest-university-to-expand-its-free-tuition-offer/',
        date: '2026-08-04',
      },
    },
  ],
}

const UNC: UniversityIntel = {
  university: 'UNC',
  name: 'University of North Carolina at Chapel Hill',
  coverage: 'adequate',
  findings: [
    {
      id: 'unc-ranking-ft-mba-2026-40th',
      university: 'UNC',
      category: 'ranking',
      headline: 'Kenan-Flagler placed 40th in the world for the MBA',
      detail:
        'UNC Kenan-Flagler ranked 40th in the Financial Times Global MBA Ranking 2026, up from 51st the previous year — one of the larger US gains in this edition.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'unc-funding-budget-cuts-2026',
      university: 'UNC',
      category: 'funding',
      headline: 'Trustees approved cuts of $70 million and above',
      detail:
        'UNC-Chapel Hill leadership identified around $70 million of operational savings, against a trustee-approved plan of $86.5 million, citing federal and state funding pressure. The university receives about $1 billion a year in federal research funds, tenth most in the country, and received roughly 100 fewer health research grants than the prior year.',
      level: 'attention',
      source: {
        publisher: 'WUNC',
        url: 'https://www.wunc.org/education/2026-03-26/unc-chapel-hill-trustees-budget-cut-financial-pressures',
        date: '2026-03-26',
      },
    },
    {
      id: 'unc-policy-programme-closures-2026',
      university: 'UNC',
      category: 'policy',
      headline: 'Area studies centres closed and several degree programmes eliminated',
      detail:
        'Six area studies centres were advised to close after losing much of their federal funding, and the board approved eliminating programmes including drama, religious studies and physics. Applicants should confirm a named course is still running for their intake.',
      level: 'attention',
      source: {
        publisher: 'The Daily Tar Heel',
        url: 'https://dailytarheel.com/article/university-chancellor-lee-roberts-qanda-jan-2026-20260112',
        date: '2026-01-12',
      },
    },
  ],
}

const UT_AUSTIN: UniversityIntel = {
  university: 'UT Austin',
  name: 'University of Texas at Austin',
  coverage: 'adequate',
  findings: [
    {
      id: 'utaustin-ranking-ft-mba-2026-41st',
      university: 'UT Austin',
      category: 'ranking',
      headline: 'McCombs placed joint 41st in the world for the MBA',
      detail:
        'UT Austin McCombs ranked joint 41st in the Financial Times Global MBA Ranking 2026, down from 39th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'utaustin-funding-nsf-first-2026',
      university: 'UT Austin',
      category: 'funding',
      headline: 'Ranked first in the United States for research funded by the National Science Foundation',
      detail:
        'UT Austin reported the top national position for NSF-funded research expenditure. Its president said federal funding to the university rose over the past year, which he described as a surprise to many — a materially different position from most institutions in this corpus.',
      level: 'info',
      source: {
        publisher: 'UT Austin News',
        url: 'https://news.utexas.edu/2026/01/08/ut-ranks-no-1-in-u-s-for-research-funded-by-national-science-foundation/',
        date: '2026-01-08',
      },
    },
    {
      id: 'utaustin-policy-federal-compact-position-2026',
      university: 'UT Austin',
      category: 'policy',
      headline: 'Neither signed nor rejected the federal funding compact',
      detail:
        'UT Austin was one of nine universities sent the proposed federal compact, which would have capped international undergraduate enrolment at 15%. The president said there was nothing presented to him to sign and treated it as a request for feedback rather than a decision.',
      level: 'info',
      source: {
        publisher: 'The Daily Texan',
        url: 'https://thedailytexan.com/2026/04/09/theres-nothing-for-me-to-sign-trump-administration-compact-meant-to-initiate-dialogue-davis-says/',
        date: '2026-04-09',
      },
    },
  ],
}

const GEORGIA_TECH: UniversityIntel = {
  university: 'Georgia Tech',
  name: 'Georgia Institute of Technology',
  coverage: 'adequate',
  findings: [
    {
      id: 'georgiatech-ranking-ft-mba-2026-44th',
      university: 'Georgia Tech',
      category: 'ranking',
      headline: 'Scheller placed 44th in the world for the MBA',
      detail:
        'Georgia Tech Scheller ranked 44th in the Financial Times Global MBA Ranking 2026, up from 58th the previous year — the largest single-year gain of any US school in the table.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'georgiatech-leadership-president-departing-2026',
      university: 'Georgia Tech',
      category: 'leadership',
      headline: 'President leaving in November to lead a policy institute',
      detail:
        'Ángel Cabrera announced in June 2026 that he would leave Georgia Tech in November to become president and chief executive of the Aspen Institute. A successor had not been named at the time of the announcement.',
      level: 'attention',
      source: {
        publisher: 'Georgia Tech News Center',
        url: 'https://news.gatech.edu/news/2026/06/15/president-angel-cabrera-named-president-and-ceo-aspen-institute',
        date: '2026-06-15',
      },
    },
    {
      id: 'georgiatech-funding-research-scale-2026',
      university: 'Georgia Tech',
      category: 'funding',
      headline: 'Sponsored research awards above $1.4 billion a year',
      detail:
        'Annual sponsored research awards passed $1.4 billion, placing Georgia Tech first nationally in research expenditure among universities without a medical school and second nationally in federal research funding. Enrolment grew 55% to over 56,000 students.',
      level: 'info',
      programmeTags: ['MS Computer Science', 'MS Data Science', 'MS Electrical Engineering', 'MEng ECE'],
      source: {
        publisher: 'Georgia Tech News Center',
        url: 'https://news.gatech.edu/news/2026/06/15/president-angel-cabrera-named-president-and-ceo-aspen-institute',
        date: '2026-06-15',
      },
    },
  ],
}

const UW: UniversityIntel = {
  university: 'UW',
  name: 'University of Washington',
  coverage: 'adequate',
  findings: [
    {
      id: 'uw-ranking-ft-mba-2026-45th',
      university: 'UW',
      category: 'ranking',
      headline: 'Foster fell eleven places to 45th in the world',
      detail:
        'University of Washington Foster ranked 45th in the Financial Times Global MBA Ranking 2026, down from 34th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'uw-funding-federal-budget-exposure-2026',
      university: 'UW',
      category: 'funding',
      headline: 'Federal budget request proposed cutting the National Science Foundation by 55%',
      detail:
        'The university tracked a federal budget request that would reduce NSF funding from $8.8 billion to about $4 billion, a 55% cut, with an 86% reduction to STEM education programmes and further cuts to health and energy research. UW is among the most federally dependent research universities in the country.',
      level: 'attention',
      source: {
        publisher: 'University of Washington Office of Federal Relations',
        url: 'https://www.washington.edu/federalrelations/2026/04/03/more-details-on-administration-budget-request/',
        date: '2026-04-03',
      },
    },
    {
      id: 'uw-funding-provost-budget-update-2026',
      university: 'UW',
      category: 'funding',
      headline: 'Budget planning continued under combined state and federal pressure',
      detail:
        'The provost issued a budget update in April 2026 covering planning against both state and federal reductions. Leadership had earlier described the position as comparable to the 2008 recession.',
      level: 'info',
      source: {
        publisher: 'University of Washington Office of the Provost',
        url: 'https://www.washington.edu/provost/2026/04/15/updates-from-the-provost-april-15-2026/',
        date: '2026-04-15',
      },
    },
  ],
}

const GEORGETOWN: UniversityIntel = {
  university: 'Georgetown',
  name: 'Georgetown University',
  coverage: 'adequate',
  findings: [
    {
      id: 'georgetown-ranking-ft-mba-2026-49th',
      university: 'Georgetown',
      category: 'ranking',
      headline: 'McDonough placed 49th in the world for the MBA',
      detail:
        'Georgetown McDonough ranked 49th in the Financial Times Global MBA Ranking 2026, down from 43rd the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'georgetown-policy-international-tuition-loss-2025',
      university: 'Georgetown',
      category: 'policy',
      headline: '$17 million of international graduate tuition lost to visa and immigration policy',
      detail:
        'The interim president attributed a projected $17 million shortfall in international graduate tuition revenue to new visa and immigration policies and economic pressure on prospective students. Georgetown is one of the few universities to have quantified the international-enrolment effect this precisely.',
      level: 'attention',
      programmeTags: ['MBA', 'MS Finance', 'MS Business Analytics', 'MPH'],
      source: {
        publisher: 'Georgetown University, Office of the President',
        url: 'https://president.georgetown.edu/messages/fy26-financial-status-nov-2025/',
        date: '2025-11-24',
      },
    },
    {
      id: 'georgetown-funding-research-grant-loss-2025',
      university: 'Georgetown',
      category: 'funding',
      headline: '$35 million a year lost in federal research funding',
      detail:
        'Georgetown projected an annual $35 million loss in federal research funding from federal actions, funding delays and the government shutdown, alongside utility costs up nearly 15% on budget and rising legal costs from federal inquiries. Targeted cuts and a hiring freeze allowed it to avoid large-scale layoffs.',
      level: 'attention',
      source: {
        publisher: 'Georgetown University, Office of the President',
        url: 'https://president.georgetown.edu/messages/fy26-financial-status-nov-2025/',
        date: '2025-11-24',
      },
    },
  ],
}

const VANDERBILT: UniversityIntel = {
  university: 'Vanderbilt',
  name: 'Vanderbilt University',
  coverage: 'adequate',
  findings: [
    {
      id: 'vanderbilt-ranking-ft-mba-2026-51st',
      university: 'Vanderbilt',
      category: 'ranking',
      headline: 'Owen placed 51st in the world for the MBA',
      detail:
        'Vanderbilt Owen ranked 51st in the Financial Times Global MBA Ranking 2026, up from 52nd — effectively unchanged.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'vanderbilt-policy-federal-compact-feedback-2025',
      university: 'Vanderbilt',
      category: 'policy',
      headline: 'Declined to reject the federal funding compact, offering feedback instead',
      detail:
        'Where seven of the nine universities approached rejected the proposed federal compact outright, Vanderbilt neither accepted nor rejected it, saying it had been asked for feedback as part of an ongoing dialogue. The compact would have capped international undergraduate enrolment at 15%.',
      level: 'attention',
      source: {
        publisher: 'The Vanderbilt Hustler',
        url: 'https://vanderbilthustler.com/2025/10/20/breaking-chancellor-daniel-diermeier-fails-to-reject-higher-education-compact-reaffirms-vanderbilts-values-and-openness-to-discussion/',
        date: '2025-10-20',
      },
    },
    {
      id: 'vanderbilt-funding-national-expansion-2025',
      university: 'Vanderbilt',
      category: 'funding',
      headline: 'Expanding to new campuses while peers contract',
      detail:
        'Vanderbilt is pursuing national expansion, including New York and West Palm Beach sites, at a time when most comparable institutions are cutting. It is one of the few universities in this corpus growing its physical footprint.',
      level: 'info',
      source: {
        publisher: 'Inside Higher Ed',
        url: 'https://www.insidehighered.com/news/business/physical-campuses/2025/09/25/vanderbilt-eyes-national-expansion',
        date: '2025-09-25',
      },
    },
  ],
}

const EMORY: UniversityIntel = {
  university: 'Emory',
  name: 'Emory University',
  coverage: 'adequate',
  findings: [
    {
      id: 'emory-ranking-ft-mba-2026-56th',
      university: 'Emory',
      category: 'ranking',
      headline: 'Goizueta fell eleven places to 56th in the world',
      detail:
        'Emory Goizueta ranked 56th in the Financial Times Global MBA Ranking 2026, down from 45th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'emory-funding-hiring-freeze-2025',
      university: 'Emory',
      category: 'funding',
      headline: 'Hiring frozen and raises halted against a $140 million annual exposure',
      detail:
        'Emory imposed an immediate staff hiring freeze, cut operating expenditure, halted compensation adjustments and restricted faculty hiring, estimating the federal changes would cost around $140 million a year. It received over $488 million in National Institutes of Health funding in 2024, by far the largest in Georgia.',
      level: 'attention',
      source: {
        publisher: 'Georgia Public Broadcasting',
        url: 'https://www.gpb.org/news/2025/03/06/emory-university-plans-curb-spending-staffing-fed-research-cuts-loom',
        date: '2025-03-06',
      },
    },
    {
      id: 'emory-funding-measures-extending-2025',
      university: 'Emory',
      category: 'funding',
      headline: 'President said the measures would run into 2026 and possibly beyond',
      detail:
        'Emory\'s president said the cost measures would continue into 2026 and possibly longer, and pointed to proposals in Congress to raise the endowment tax on private universities from 1.4% to as much as 21%.',
      level: 'info',
      source: {
        publisher: 'Rough Draft Atlanta',
        url: 'https://roughdraftatlanta.com/2025/03/07/emory-university-hiring-freeze/',
        date: '2025-03-07',
      },
    },
  ],
}

const UGA: UniversityIntel = {
  university: 'UGA',
  name: 'University of Georgia',
  coverage: 'thin',
  note:
    'Only the FT ranking position could be cited to a verifiable date. UGA\'s own news service and the student paper publish without day-level dates that could be confirmed, and the university news page returned an access error. Searches surfaced a faculty hiring initiative, research expenditure of $654 million and new medical and nursing schools, but none of it could be pinned to a datable source, so none of it is recorded here. No adverse coverage was found.',
  findings: [
    {
      id: 'uga-ranking-ft-mba-2026-60th',
      university: 'UGA',
      category: 'ranking',
      headline: 'Terry placed 60th in the world for the MBA',
      detail:
        'The University of Georgia\'s Terry College ranked 60th in the Financial Times Global MBA Ranking 2026, down from 55th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
  ],
}

const NOTRE_DAME: UniversityIntel = {
  university: 'Notre Dame',
  name: 'University of Notre Dame',
  coverage: 'thin',
  note:
    'Two datable findings. Notre Dame publishes its financial communications through the president\'s office without consistent dating, and no national outlet has reported figures for it in this cycle. Reported details of a 2.5% budget reduction, a halt on new construction and cancellation of more than $30 million in grants could not be tied to a datable source and are therefore not recorded. No adverse coverage was found.',
  findings: [
    {
      id: 'notredame-ranking-ft-mba-2026-61st',
      university: 'Notre Dame',
      category: 'ranking',
      headline: 'Mendoza placed 61st in the world for the MBA',
      detail:
        'Notre Dame Mendoza ranked 61st in the Financial Times Global MBA Ranking 2026, up from 75th the previous year — a substantial recovery.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'notredame-funding-budget-modelling-2025',
      university: 'Notre Dame',
      category: 'funding',
      headline: 'Divisions told to model a 5% budget reduction',
      detail:
        'The president and executive officers asked division leaders to model a 5% budget reduction proactively in response to federal funding changes, and pointed to proposals to raise the endowment tax from 1.4% to as much as 21%.',
      level: 'attention',
      source: {
        publisher: 'University of Notre Dame, Office of the President',
        url: 'https://president.nd.edu/homilies-writings-and-addresses/a-message-from-the-executive-officers-impact-of-federal-funding-changes/',
        date: '2025-03-07',
      },
    },
  ],
}

const ROCHESTER: UniversityIntel = {
  university: 'Rochester',
  name: 'University of Rochester',
  coverage: 'thin',
  note:
    'Two datable findings. Rochester generates little national coverage and its own budget communications are largely undated. A reported $40 million exposure from the proposed cap on indirect research costs could not be tied to a datable source and is not recorded. No leadership change, ranking commentary or adverse coverage was found from a datable source.',
  findings: [
    {
      id: 'rochester-ranking-ft-mba-2026-62nd',
      university: 'Rochester',
      category: 'ranking',
      headline: 'Simon placed 62nd in the world for the MBA',
      detail:
        'Rochester\'s Simon Business School ranked 62nd in the Financial Times Global MBA Ranking 2026, down from 60th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'rochester-policy-phd-intake-review-2025',
      university: 'Rochester',
      category: 'policy',
      headline: 'Doctoral intake for 2026 under review as research overheads are cut',
      detail:
        'The provost said the university would work with doctoral programmes to evaluate admission numbers for autumn 2026 in response to a reduced federal overhead rate, and would begin charging part of PhD tuition to grants. Faculty hiring was sharply limited. Taught masters intakes were not named.',
      level: 'attention',
      source: {
        publisher: 'University of Rochester, Office of the Provost',
        url: 'https://www.rochester.edu/provost/academic-budget-and-planning-update/',
        date: '2025-07-21',
      },
    },
  ],
}

const BU: UniversityIntel = {
  university: 'BU',
  name: 'Boston University',
  coverage: 'thin',
  note:
    'Two datable findings. Beyond the July 2025 layoff round, BU\'s budget communications and the student paper carry no dates that could be verified, and no national outlet has reported updated figures for it. No leadership change, faculty move or adverse coverage was found from a datable source.',
  findings: [
    {
      id: 'bu-ranking-ft-mba-2026-64th',
      university: 'BU',
      category: 'ranking',
      headline: 'Questrom placed 64th in the world for the MBA',
      detail:
        'Boston University\'s Questrom School ranked 64th in the Financial Times Global MBA Ranking 2026, up from 74th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'bu-funding-layoffs-2025',
      university: 'BU',
      category: 'funding',
      headline: '120 staff laid off and 120 vacancies closed against a 5% budget cut',
      detail:
        'Boston University eliminated at least 120 staff posts and a further 120 vacant positions under a 5% budget cut. The president cited federal actions and funding cuts, inflation, declining graduate enrolment and technological disruption.',
      level: 'attention',
      source: {
        publisher: 'Forbes',
        url: 'https://www.forbes.com/sites/michaeltnietzel/2025/07/08/there-is-no-way-around-this-boston-university-to-lay-off-120-staff/',
        date: '2025-07-08',
      },
    },
  ],
}

const MICHIGAN_STATE: UniversityIntel = {
  university: 'Michigan State',
  name: 'Michigan State University',
  coverage: 'adequate',
  findings: [
    {
      id: 'michiganstate-ranking-ft-mba-2026-67th',
      university: 'Michigan State',
      category: 'ranking',
      headline: 'Broad placed 67th in the world for the MBA',
      detail:
        'Michigan State\'s Broad College ranked 67th in the Financial Times Global MBA Ranking 2026, its first ranked appearance in recent editions.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'michiganstate-funding-grant-terminations-2025',
      university: 'Michigan State',
      category: 'funding',
      headline: '74 federally funded projects ended, a $104 million multi-year hit',
      detail:
        'The president reported 74 federally funded projects terminated with a multi-year impact of about $104 million, and at least 86 further projects hit with stop-work orders, funding pauses or conditional terminations. Ninety-nine posts were eliminated, and a fund of up to $5 million a year for three years was created to bridge graduate students and faculty who lost research funding.',
      level: 'attention',
      source: {
        publisher: 'The Detroit News',
        url: 'https://eu.detroitnews.com/story/news/local/michigan/2025/10/22/michigan-state-msu-number-jobs-eliminated-university-cuts-president-guskiewicz/86833813007/',
        date: '2025-10-22',
      },
    },
    {
      id: 'michiganstate-funding-deficit-and-fees-2026',
      university: 'Michigan State',
      category: 'funding',
      headline: 'Facing a $12 million deficit, tuition raised almost 4%',
      detail:
        'Michigan State went into the new year with a deficit above $12 million and raised tuition by nearly 4%. An applicant should budget for continued above-inflation fee increases at this institution.',
      level: 'attention',
      source: {
        publisher: 'The Detroit News',
        url: 'https://www.detroitnews.com/story/news/local/michigan/2026/06/12/msu-faces-budget-deficit-raises-tuition-costs-for-students/90521770007/',
        date: '2026-06-12',
      },
    },
  ],
}

const PITTSBURGH: UniversityIntel = {
  university: 'Pittsburgh',
  name: 'University of Pittsburgh',
  coverage: 'thin',
  note:
    'Two datable findings. Pitt\'s student paper and much of its internal reporting carry no verifiable dates, and no national outlet has reported figures for it in this cycle. A reported pause and subsequent resumption of doctoral admissions, and a hiring freeze, could not be tied to a datable source and are not recorded. No leadership change or adverse coverage was found.',
  findings: [
    {
      id: 'pittsburgh-ranking-ft-mba-2026-70th',
      university: 'Pittsburgh',
      category: 'ranking',
      headline: 'Katz placed 70th in the world for the MBA',
      detail:
        'The University of Pittsburgh\'s Katz school ranked 70th in the Financial Times Global MBA Ranking 2026, its first ranked appearance in three years.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'pittsburgh-funding-federal-budget-exposure-2026',
      university: 'Pittsburgh',
      category: 'funding',
      headline: 'Provost set out a second consecutive year of proposed federal research cuts',
      detail:
        'The provost told the Senate that the federal budget proposal would cut the National Science Foundation by 54% and National Institutes of Health base funding by 12%, cut federal work study by 90%, and eliminate several student aid and graduate assistance programmes outright. He expressed hope Congress would again moderate the proposals.',
      level: 'attention',
      source: {
        publisher: 'University Times',
        url: 'https://www.utimes.pitt.edu/news/white-house-budget',
        date: '2026-05-01',
      },
    },
  ],
}

const FORDHAM: UniversityIntel = {
  university: 'Fordham',
  name: 'Fordham University',
  coverage: 'thin',
  note:
    'Only the FT ranking position could be cited to a verifiable date. Fordham\'s coverage sits almost entirely in two student papers whose articles carry no publication dates and which returned access errors. Reported measures — a forecast deficit for the 2026 financial year, a hiring pause, a 10% cut to non-staff spending and reduced work-study hours — could not be tied to a datable source and are not recorded. No adverse coverage was found.',
  findings: [
    {
      id: 'fordham-ranking-ft-mba-2026-76th',
      university: 'Fordham',
      category: 'ranking',
      headline: 'Gabelli placed 76th in the world for the MBA',
      detail:
        'Fordham\'s Gabelli School ranked 76th in the Financial Times Global MBA Ranking 2026, up from 78th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
  ],
}

const BYU: UniversityIntel = {
  university: 'BYU',
  name: 'Brigham Young University',
  coverage: 'thin',
  note:
    'Only the FT ranking position could be cited to a verifiable date. BYU is privately funded by its sponsoring church, carries minimal federal research exposure and generates almost no national coverage, so the themes that dominate this corpus — federal funding cuts, endowment tax, settlements — do not arise. Its own news releases are undated. Note that BYU operates a two-tier tuition schedule under which non-members of the sponsoring church pay double; an applicant should verify which rate applies before a cost of attendance is accepted.',
  findings: [
    {
      id: 'byu-ranking-ft-mba-2026-77th',
      university: 'BYU',
      category: 'ranking',
      headline: 'Marriott placed 77th in the world for the MBA',
      detail:
        'Brigham Young University\'s Marriott School ranked 77th in the Financial Times Global MBA Ranking 2026, up from 83rd the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
  ],
}

const MIAMI: UniversityIntel = {
  university: 'Miami',
  name: 'University of Miami',
  coverage: 'thin',
  note:
    'Only the FT ranking position could be cited to a verifiable date. The university\'s federal-policy and research pages are undated, and no outlet has reported budget, enrolment or funding figures for it in this cycle. A presidential search was under way at the time of research but no datable announcement was found. No adverse coverage was found.',
  findings: [
    {
      id: 'miami-ranking-ft-mba-2026-78th',
      university: 'Miami',
      category: 'ranking',
      headline: 'Herbert placed 78th in the world for the MBA',
      detail:
        'The University of Miami\'s Herbert Business School ranked 78th in the Financial Times Global MBA Ranking 2026, up from 99th the previous year — the largest proportional gain of any US school in the table.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
  ],
}

const WILLIAM_AND_MARY: UniversityIntel = {
  university: 'William & Mary',
  name: 'College of William & Mary',
  coverage: 'thin',
  note:
    'Two datable findings, both from the institution\'s own news service. William & Mary generates little national coverage and has not reported federal research losses, leadership change or adverse events in this cycle. Its published planning refers to scenario analysis against possible federal cuts rather than realised losses, so nothing quantified could be recorded.',
  findings: [
    {
      id: 'williamandmary-ranking-ft-mba-2026-82nd',
      university: 'William & Mary',
      category: 'ranking',
      headline: 'The Mason School placed 82nd in the world for the MBA',
      detail:
        'William & Mary\'s Raymond A. Mason School ranked 82nd in the Financial Times Global MBA Ranking 2026, down from 80th the previous year.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'williamandmary-policy-fee-increases-2026',
      university: 'William & Mary',
      category: 'policy',
      headline: 'Fees, room and board all rising across the next two years',
      detail:
        'The board approved mandatory fee increases of 3.1% and 3.5% across two successive years, with room rates up 6.5% and dining up 6% in both. Planning includes scenario analysis against federal research cuts and changes to federal financial aid.',
      level: 'attention',
      source: {
        publisher: 'W&M News',
        url: 'https://news.wm.edu/2026/04/24/with-a-focus-on-affordability-careers-and-value-wm-board-approves-budget/',
        date: '2026-04-24',
      },
    },
  ],
}

const WISCONSIN: UniversityIntel = {
  university: 'Wisconsin',
  name: 'University of Wisconsin–Madison',
  coverage: 'adequate',
  findings: [
    {
      id: 'wisconsin-ranking-ft-mba-2026-84th',
      university: 'Wisconsin',
      category: 'ranking',
      headline: 'The Wisconsin School of Business placed 84th in the world',
      detail:
        'The Wisconsin School of Business ranked 84th in the Financial Times Global MBA Ranking 2026, its first ranked appearance in recent editions.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
    {
      id: 'wisconsin-funding-federal-research-down-2026',
      university: 'Wisconsin',
      category: 'funding',
      headline: 'Federal research funding down 17%, with 145 grants stopped',
      detail:
        'UW-Madison recorded a 17% fall in federal research funding, with about 145 grants terminated or hit with stop-work orders and at least $27 million lost, and 375 fewer grants awarded than the prior year. Forty-three grants were reinstated after legal challenges. Schools and colleges took a 5% base budget cut, administrative units 7%.',
      level: 'attention',
      source: {
        publisher: 'Wisconsin Public Radio',
        url: 'https://www.wpr.org/news/university-wisconsin-madison-federal-research-grants-funding-cuts-trump',
        date: '2026-02-09',
      },
    },
    {
      id: 'wisconsin-leadership-chancellor-departure-2026',
      university: 'Wisconsin',
      category: 'leadership',
      headline: 'Chancellor left to become president of Columbia',
      detail:
        'Jennifer Mnookin left the chancellorship to become president of Columbia University from 1 July 2026, with a dean serving as interim chancellor from 17 May and a permanent appointment not expected before the end of 2026. The same move is recorded against Columbia.',
      level: 'attention',
      source: {
        publisher: 'Wisconsin Public Radio',
        url: 'https://www.wpr.org/news/university-wisconsin-madison-federal-research-grants-funding-cuts-trump',
        date: '2026-02-09',
      },
    },
  ],
}

const HULT: UniversityIntel = {
  university: 'Hult',
  name: 'Hult International Business School',
  coverage: 'thin',
  note:
    'Only the FT ranking position could be cited to a verifiable date. Hult is a small private business school rather than a research university, so the federal funding, endowment tax and grant-termination themes that dominate this corpus do not apply to it. Everything else that surfaced came from ranking aggregators rather than datable primary reporting. One structural point worth flagging without a citation to hang it on: Hult teaches across campuses in several countries, so an applicant\'s study location — and therefore their visa route and cost of attendance — needs to be confirmed against the offer letter rather than assumed to be the United States.',
  findings: [
    {
      id: 'hult-ranking-ft-mba-2026-89th',
      university: 'Hult',
      category: 'ranking',
      headline: 'Hult placed 89th in the world for the MBA',
      detail:
        'Hult International Business School ranked 89th in the Financial Times Global MBA Ranking 2026, down from 92nd the previous year. It is the lowest-placed US entry in the table.',
      level: 'info',
      programmeTags: ['MBA'],
      source: FT_MBA_2026,
    },
  ],
}

// ---- Corpus -----------------------------------------------------------------
// Ordered to match US_UNIVERSITIES exactly — the original 14 first, then the 31
// FT Global MBA Ranking 2026 additions in FT rank order — so the two lists can
// be diffed by eye.

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

  // FT Global MBA Ranking 2026 additions — not yet selectable.
  PENN,
  NORTHWESTERN,
  CORNELL,
  DUKE,
  YALE,
  UVA,
  CHICAGO,
  DARTMOUTH,
  UCLA,
  MICHIGAN,
  WASHU,
  RICE,
  UNC,
  UT_AUSTIN,
  GEORGIA_TECH,
  UW,
  GEORGETOWN,
  VANDERBILT,
  EMORY,
  UGA,
  NOTRE_DAME,
  ROCHESTER,
  BU,
  MICHIGAN_STATE,
  PITTSBURGH,
  FORDHAM,
  BYU,
  MIAMI,
  WILLIAM_AND_MARY,
  WISCONSIN,
  HULT,
]

// (A SELECTABLE_UNIVERSITIES list lived here while the FT additions were not yet
// in US_UNIVERSITIES. They are now, so it would be a second copy of that array
// and a drift hazard. Removed rather than left to rot.)

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
