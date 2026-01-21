# AeroEdge Website Build - Master Prompt for Claude Code

You are building the marketing and portfolio website for AeroEdge, a comprehensive aviation software ecosystem. This site will be hosted on GitHub Pages and must communicate the full vision of the platform while highlighting the flagship tools.

---

## BRAND IDENTITY

### Who Built This
AeroEdge is created by a former F/A-18 and RAF Typhoon fighter pilot and instructor, now a civilian CFI/CFII/MEI with AGI, IGI, and A&P mechanic certifications. This is fighter-grade aviation engineering translated for general aviation.

### Core Value Proposition
**"Fighter-grade performance tools for general aviation pilots"**

AeroEdge brings Energy-Maneuverability theory—the same framework used to design and fly tactical aircraft—to the GA cockpit. This isn't simplified aviation software. This is real aerodynamic engineering made accessible.

### Target Audiences (in priority order)
1. **Military pilots transitioning to civilian aviation** - They understand EM theory, need tools that match their training rigor, and face painful logbook conversion challenges
2. **Flight instructors and training programs** - Need visualization tools for teaching maneuvers, energy management, and performance concepts
3. **Serious GA pilots** - Want to understand their aircraft at a deeper level than "follow the POH"
4. **Paper logbook holdouts** - Need compelling reasons to go digital without losing control

### The "Greybeard Principle"
Design decisions must convert the skeptical, experienced pilot who's used paper logbooks for 40 years:
- No forced account creation
- Local-first data storage options
- One-time purchase options (not subscription-only)
- "Paper View" interfaces that mirror familiar layouts
- Respect for their expertise, not dumbed-down interfaces

---

## THE AEROEDGE ECOSYSTEM

This is NOT a collection of separate apps. It's ONE integrated aviation platform with multiple specialized interfaces:

### 1. EM Diagram Generator (FLAGSHIP - LIVE)
**What it does:** Generates Energy-Maneuverability diagrams for any aircraft, showing:
- Stall boundaries (1G and accelerated)
- G-load limits
- Specific Excess Power (Ps) regions
- V-speed markers
- Dynamic limits (Vmca, Vyse for multi-engine)

**Why it matters:** EM diagrams are how fighter pilots understand aircraft performance. Now any pilot can see exactly where their Cessna, Cirrus, or Bonanza can and cannot go.

**Key features:**
- Aircraft preset library (50+ aircraft)
- Custom aircraft editor with full aerodynamic parameters
- Unit-aware (KIAS/MPH, feet/meters)
- Export to PNG/PDF
- Mobile-responsive

### 2. Maneuver Overlay Tool (FLAGSHIP - LIVE)
**What it does:** Visualizes FAA maneuvers as time-integrated energy problems on a map, including:
- Steep Turns (45°/60° bank, load factor visualization)
- Power-Off 180 (glide management, slip effects)
- Impossible Turn analysis (GO/NO-GO with safety margins)
- Engine-Out Glide paths
- Chandelles, Lazy Eights, Eights on Pylons

**Why it matters:** Maneuvers aren't geometry problems—they're energy management exercises. This tool shows exactly how energy, altitude, and airspeed interact throughout each maneuver.

**Technical foundation:** Uses the SAME aerodynamic math as the EM Diagram. Single source of truth for:
- Turn rate and radius from TAS and bank angle
- G-load calculations
- Energy bleed modeling
- Wind correction (aviation standard: wind FROM, converted to TO)
- Glide performance with configuration changes

### 3. AeroEdge Logbook (IN DEVELOPMENT)
**What it does:** Digital flight logbook designed by pilots who understand the pain points:
- **Out-of-order entry**: Add a flight from 10 years ago, it auto-sorts correctly
- **Paper View mode**: Horizontal layout matching physical logbooks for easy transcription
- **Military conversion engine**: Translates NATOPS/SHARP format to FAA standard (huge pain point for transitioning military pilots)
- **Smart validation**: Catches common logging errors (sim time in flight time, dual given vs received confusion)
- **Currency tracking**: 6-hits, BFR, medical, with proactive alerts
- **8710 auto-population**: Direct export for checkride applications

**Target users:** Military pilots converting thousands of hours, CFIs managing student records, paper logbook users finally going digital

### 4. Aircraft Management System (PLANNED)
**What it does:** Tracks aircraft maintenance, compliance, and operational data:
- Hobbs/Tach time synchronization
- AD compliance tracking
- Inspection countdown (annual, 100-hour, etc.)
- Squawk management
- Integration with logbook (log a flight → aircraft times update automatically)

**Target users:** Owner-operators, flying clubs, small flight schools, A&P mechanics

### 5. Ecosystem Integration
The magic is how these connect:
- Log a flight → Aircraft times update → Compliance countdowns adjust
- Plan a maneuver → See it on your aircraft's actual EM diagram
- Track currency → Logbook validates entries against requirements

---

## DESIGN SYSTEM

### Colors (from AEROEDGE_STYLE_GUIDE.md)
```css
/* Primary */
--orange-primary: #E65C00;      /* Buttons, accents, active states */
--blue-primary: #2980B9;        /* Links, secondary actions */

/* Backgrounds */
--navy-header: #0A1628;         /* Header banner */
--bg-dark: #1a202c;             /* Dark sections */
--bg-medium: #2d3748;           /* Cards on dark */
--bg-light: #f8f9fa;            /* Light sections */

/* Text */
--text-light: #f7fafc;          /* On dark backgrounds */
--text-dark: #1a202c;           /* On light backgrounds */
--text-muted: #a0aec0;          /* Secondary text */

/* Accents */
--warning-bg: #fff3cd;          /* Disclaimer banners */
--warning-text: #856404;
```

### Typography
- Font family: 'Inter', 'Helvetica Neue', sans-serif
- Headings: Bold, clean, no-nonsense
- Body: 16px base, comfortable reading

### Visual Identity
- Professional, technical, but not sterile
- Aviation-inspired without being cliché (no clip-art airplanes)
- Dark mode aesthetic for the technical audience
- High contrast for readability
- Subtle orange accents that pop

---

## WEBSITE STRUCTURE

### Page 1: Home / Landing
**Purpose:** Hook visitors, communicate the ecosystem vision, drive to flagship tools

**Sections:**
1. **Hero**
   - Headline: Something like "Fighter-Grade Performance Tools for General Aviation"
   - Subhead: Brief ecosystem description
   - Primary CTA: "Try the EM Diagram" or "Explore Tools"
   - Secondary CTA: "See the Roadmap"
   - Visual: Could be a stylized EM diagram or maneuver overlay screenshot

2. **The Problem / Why This Exists**
   - GA pilots fly without understanding their aircraft's true performance envelope
   - Training tools are either oversimplified or locked in expensive sims
   - Digital logbooks ignore the needs of paper converts and military transitioners
   - No integrated ecosystem connects flight logging to aircraft management

3. **The Solution: AeroEdge Ecosystem**
   - Visual diagram showing how tools connect
   - Brief description of each component
   - Status indicators (Live / Coming Soon)

4. **Flagship Tools Showcase**
   - EM Diagram: Screenshot, key features, "Try It" button
   - Maneuver Overlay: Screenshot, key features, "Try It" button

5. **Coming Soon Preview**
   - Logbook: Key differentiators, "Join Waitlist" or "Learn More"
   - Aircraft Management: Brief teaser

6. **About / Credibility**
   - Creator background (fighter pilot credentials, civilian certs)
   - Philosophy: "Built by pilots, for pilots"
   - Not a VC-funded startup chasing metrics—a tool built to solve real problems

7. **Footer**
   - Links to tools
   - Contact/feedback
   - Legal (privacy, terms, disclaimer)

### Page 2: EM Diagram Tool Page
**Purpose:** Explain the tool in depth, drive usage

**Sections:**
1. Hero with tool screenshot
2. What is an EM Diagram? (educational)
3. Key Features list
4. Aircraft library preview
5. "Launch Tool" CTA
6. Technical details for advanced users

### Page 3: Maneuver Overlay Tool Page
**Purpose:** Explain the tool in depth, drive usage

**Sections:**
1. Hero with tool screenshot
2. What problems it solves
3. Maneuvers supported (with brief explanations)
4. How it uses real physics (not game-engine shortcuts)
5. "Launch Tool" CTA

### Page 4: Logbook Page (Coming Soon)
**Purpose:** Build anticipation, collect interest

**Sections:**
1. The problem with current digital logbooks
2. AeroEdge Logbook differentiators
3. Military conversion feature highlight
4. Paper View mode explanation
5. Waitlist signup or "Learn More" about development

### Page 5: About / Contact
**Purpose:** Build trust, provide contact

**Sections:**
1. Creator background
2. Mission/philosophy
3. Contact form or email
4. Links to social/community if applicable

---

## TECHNICAL REQUIREMENTS

### Hosting
- GitHub Pages (static site)
- Custom domain ready (DNS instructions for user)
- HTTPS via GitHub's SSL

### Technology Stack
Choose ONE of these approaches:

**Option A: Pure HTML/CSS/JS (Recommended for simplicity)**
- Single `index.html` or multi-page structure
- Vanilla CSS with CSS variables for theming
- Minimal JS for interactions (mobile menu, smooth scroll)
- No build step required

**Option B: Astro (If more pages/complexity needed)**
- Static site generator
- Component-based but outputs pure HTML
- Easy templating for repeated elements
- Requires build step but deploys to static files

### File Structure (Option A)
```
aeroedge-website/
├── index.html              # Home/landing page
├── em-diagram.html         # EM Diagram tool page
├── maneuver-overlay.html   # Maneuver tool page
├── logbook.html           # Logbook coming soon page
├── about.html             # About/contact page
├── css/
│   └── styles.css         # All styles
├── js/
│   └── main.js            # Minimal interactivity
├── images/
│   ├── logo.svg           # AeroEdge logo
│   ├── em-screenshot.png  # Tool screenshots
│   └── ...
├── CNAME                  # Custom domain (if applicable)
└── README.md              # Repo documentation
```

### Responsive Design
- Mobile-first approach
- Breakpoints: 480px, 768px, 1024px, 1200px
- Touch-friendly navigation
- Images optimized for web

### Performance
- No heavy frameworks
- Lazy load images below fold
- Minimize external dependencies
- Target < 2s load time

### Accessibility
- Semantic HTML
- Alt text on images
- Keyboard navigable
- Sufficient color contrast

---

## CONTENT TONE

### Voice
- Confident but not arrogant
- Technical but accessible
- Direct, no marketing fluff
- Respects the reader's intelligence

### Avoid
- "Revolutionary" / "Game-changing" / "Disrupting"
- Overpromising features not yet built
- Talking down to experienced pilots
- Generic stock aviation imagery

### Embrace
- Specific technical claims backed by how it works
- Acknowledging this is built by someone who flies
- Honest about what's live vs coming soon
- The "why" behind design decisions

---

## IMMEDIATE FIRST STEPS

1. **Create the file structure** in the repo
2. **Build the home page first** with all sections
3. **Establish the CSS foundation** with variables and base styles
4. **Add responsive navigation** (hamburger on mobile)
5. **Create tool pages** (EM Diagram, Maneuver Overlay)
6. **Add coming soon page** (Logbook)
7. **Test on mobile**
8. **Optimize images**

---

## EXTERNAL LINKS TO LIVE TOOLS

When linking to the actual tools, use these patterns (user will provide actual URLs):
- EM Diagram: `[URL to be provided]`
- Maneuver Overlay: `[URL to be provided]`

For now, use placeholder `#em-diagram-tool` and `#maneuver-overlay-tool` that can be updated.

---

## SCREENSHOTS NEEDED

The user will need to provide:
1. EM Diagram screenshot (showing a populated diagram)
2. Maneuver Overlay screenshot (showing a maneuver on the map)
3. Any logo/brand assets

Create placeholder image containers with appropriate aspect ratios until these are provided.

---

## SUCCESS CRITERIA

The website succeeds if:
1. A visitor understands what AeroEdge is within 10 seconds
2. The ecosystem vision is clear (not just "some aviation apps")
3. Flagship tools are prominently featured with clear CTAs
4. The creator's credibility is established without being boastful
5. Mobile experience is excellent
6. Page loads fast
7. A pilot thinks "this person actually flies" not "this is marketing"

---

## BEGIN

Start by creating the complete file structure and building `index.html` with the full home page. Use placeholder images where screenshots are needed. Establish the CSS system with all variables. Then proceed to additional pages.

Show your work file by file. Test that the site renders correctly at each step.
