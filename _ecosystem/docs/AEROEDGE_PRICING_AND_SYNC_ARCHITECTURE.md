# AeroEdge Ecosystem
## Pricing Model & Sync Architecture

---

## Philosophy

**Core Principles:**
1. **Own what you buy** - One-time purchases work forever
2. **Pay only for what you need** - Modular features, not forced bundles
3. **No lock-in** - Your data is yours, export anytime
4. **Transparent pricing** - Subscription = actual server costs, no margin gouging
5. **Scale gracefully** - Solo pilot to 100-seat school without architectural rewrites

---

## Headline Features

### 1. "Never Forget to Log" System

AeroEdge provides multiple ways to capture flights so nothing slips through the cracks:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLIGHT CAPTURE METHODS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. FOREFLIGHT IMPORT (Zero Entry) ⭐ HEADLINE FEATURE         │
│     └── Share track log via text/email → Everything captured   │
│     └── Route, times, approaches, landings - all automatic     │
│     └── Works with Garmin Pilot, CloudAhoy too                 │
│                                                                 │
│  2. DUAL FLIGHT LOGGING (CFI logs for both) ⭐                 │
│     └── CFI shares ForeFlight + "with Alex, lesson 12"         │
│     └── Creates linked entries in BOTH logbooks                │
│     └── Times always match, syllabus auto-updated              │
│                                                                 │
│  3. TEXT-TO-LOG (Quick Capture)                                │
│     └── Text "1.5 in the 172, 3 landings" to AeroEdge         │
│     └── Draft created instantly, edit later in app             │
│                                                                 │
│  4. BOOKING AUTO-LOG (Schools/Clubs)                           │
│     └── Complete a booking → Pre-filled log entry              │
│                                                                 │
│  5. MANUAL ENTRY (Traditional)                                 │
│     └── Full-featured form when you need it                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**The Dual-Log Workflow:**

```
CFI COMPLETES FLIGHT → SHARES FOREFLIGHT → TEXTS "with Alex, lesson 12"
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
     CFI'S LOGBOOK                    STUDENT'S LOGBOOK
┌─────────────────────────┐    ┌─────────────────────────┐
│ 1.5 Dual Given          │    │ 1.5 Dual Received       │
│ Student: Alex Thompson  │◄──►│ CFI: Sarah Johnson      │
│ Lesson 12: Soft Fields  │    │ Lesson 12: Soft Fields  │
│ 🔗 Linked               │    │ 🔗 Linked               │
└─────────────────────────┘    └─────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
                    SYLLABUS PROGRESS UPDATED
                    TIMES GUARANTEED TO MATCH
```

---

### 2. Resilience Mode

### 2. Resilience Mode

Unlike web-based competitors (FSP, Flight Circle) that become useless when servers go down, **AeroEdge keeps working.** Every device maintains a complete local database and automatically syncs with other devices on the same WiFi network - no server required.

```
SERVER DOWN AT 8AM ON BUSY SATURDAY:

Flight Schedule Pro:
└── "Service Unavailable" - operations grind to a halt

AeroEdge:
├── Student books N12345 on phone
├── Front desk iPad sees booking in <1 second (local WiFi sync)
├── CFI checks schedule - fully up to date
├── Squawk reported - visible to all on-site devices immediately
└── Server returns at 10am - catches up automatically, zero data loss
```

**Everyone physically at your flight school stays in sync with each other, even if the internet is down or our servers are offline.** This is military-grade reliability for general aviation.

### How Resilience Mode Works

```
FLIGHT SCHOOL WIFI NETWORK
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   📱 Front Desk        📱 CFI Sarah       📱 Student Alex      │
│      iPad                 iPhone             iPhone             │
│        │                    │                   │               │
│        └────────────────────┼───────────────────┘               │
│                             │                                   │
│                    [Local P2P Sync]                             │
│                    mDNS auto-discovery                          │
│                    Direct device-to-device                      │
│                    <1 second latency                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Server offline? Doesn't matter!
                              ▼
                    ☁️ Managed Server
                    (syncs when available, catches up automatically)
```

### Sync Priority Stack

All sync methods run simultaneously. The system automatically uses the fastest available:

| Priority | Method | Latency | Requires |
|----------|--------|---------|----------|
| 1 (Highest) | **Local P2P** | <1 sec | Same WiFi network |
| 2 | **Hub Device** | 1-5 sec | Local or internet |
| 3 | **Managed Server** | 1-3 sec | Internet |
| 4 | **Cloud Folder** | 30-60 sec | Cloud account |

**Key insight:** If you're at the flight school, you sync with nearby devices instantly via P2P. You also sync with the server for remote users. If server dies, P2P keeps working. When server returns, accumulated changes merge automatically via CRDT.

---

## Product Tiers Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AEROEDGE ECOSYSTEM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TIER 1: SOLO                    TIER 2: SMALL GROUP     TIER 3: ORGANIZATION
│  (Individual Pilots)             (Partnerships/Clubs)    (Schools/Large Clubs)
│                                                                             │
│  • Local-first                   • P2P or Cloud Folder   • Managed Sync     │
│  • No account required           • Self-hosted option    • Guaranteed uptime│
│  • One-time purchase             • One-time purchase     • One-time + small │
│  • No sync fees                  • No subscription       •   monthly ops fee│
│                                                                             │
│  Users: 1                        Users: 2-20             Users: 20-500+     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tier 1: Solo Pilot

### Who It's For
- Individual pilots tracking personal flying
- Aircraft owners managing single aircraft
- CFIs tracking their own instruction given
- Anyone who doesn't need multi-user sync

### How It Works

```
┌─────────────────────────────────────────┐
│           USER'S DEVICES                │
│                                         │
│  Phone ◄──────► Tablet ◄──────► Desktop │
│                                         │
│         Sync via iCloud/Google          │
│         (user's existing account)       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     LOCAL SQLITE DATABASE       │   │
│  │                                 │   │
│  │  • Logbook entries             │   │
│  │  • Aircraft records            │   │
│  │  • Personal schedule           │   │
│  │  • Currency tracking           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Sync Method:** 
- iOS: iCloud automatic sync (built into iOS)
- Android: Google Drive or local WiFi sync
- Desktop: File-based sync to cloud folder

**No account required** - App works immediately after purchase

### Pricing Structure

**Individual Apps (Buy What You Need):**

Most pilots start with just the Logbook and add more later.

```
INDIVIDUAL APPS (One-Time Purchase):
├── AeroEdge Logbook ................... $49   ← Most popular entry point
│   Flight logging, currency tracking, reports
│
├── AeroEdge Aircraft .................. $79
│   Aircraft profiles, maintenance, W&B
│
└── AeroEdge Scheduler ................. $39
    Personal scheduling, reminders

BUNDLES (Save More):
├── Pilot Bundle (Logbook + Aircraft) .. $99   (save $29)
└── Complete Bundle (all three) ........ $129  (save $38)

SMART UPGRADE PRICING:
Already bought Logbook ($49) and want to add Aircraft?
├── Option A: Buy Aircraft alone ....... $79
└── Option B: Upgrade to Pilot Bundle .. $50   (you paid $49, bundle is $99)
    → We credit your previous purchase!

FEATURE ADD-ONS (Work with any app):
├── Military Conversion Module ......... $29
├── EM Diagram Integration ............. $19
├── Weight & Balance Calculator ........ $19
├── Advanced Currency Tracking ......... $14
│   (ATP mins, 135 mins, type-specific)
├── Export to ForeFlight/Garmin ........ $14
└── Printable Logbook Pages ............ $9

UPDATES:
├── Bug fixes & security ............... FREE forever
├── Minor feature improvements ......... FREE forever
└── Major new features ................. Available as add-ons
```

**Free Demo Mode:**

Download the app free. Demo includes:
- 10 flight entries
- 2 aircraft profiles
- Full feature access for 14 days
- No credit card required

After demo: purchase unlocks everything permanently.

### What's Included vs Add-On

| Feature | Logbook ($49) | Aircraft ($79) | Scheduler ($39) | Add-On |
|---------|:-------------:|:--------------:|:---------------:|:------:|
| Flight logging | ✓ | | | |
| Basic currency (FR, medical, night) | ✓ | | | |
| Reports & totals | ✓ | | | |
| Aircraft profiles | | ✓ | | |
| Maintenance tracking | | ✓ | | |
| W&B (basic) | | ✓ | | |
| Personal schedule | | | ✓ | |
| Booking reminders | | | ✓ | |
| Data export (CSV/PDF) | ✓ | ✓ | ✓ | |
| Multi-device sync | ✓ | ✓ | ✓ | |
| Military conversion | | | | $29 |
| EM Diagrams | | | | $19 |
| Advanced W&B | | | | $19 |
| Advanced currency | | | | $14 |
| Third-party export | | | | $14 |

### Flight Capture Methods (Included with Logbook)

```
TEXT-TO-LOG:
├── Basic parsing ...................... FREE (included)
│   "1.5 in the 172, 3 landings" → parsed correctly
├── Shared SMS number .................. FREE (rate limited)
├── Personal SMS number ................ $5/month
└── Personal email (log@you.aeroedge.app) FREE

FOREFLIGHT/EFB IMPORT:
├── ForeFlight track log import ........ FREE (included)
├── Garmin Pilot import ................ FREE (included)
├── CloudAhoy import ................... FREE (included)
└── Share via text, email, or share sheet

DUAL FLIGHT LOGGING (CFI Feature):
├── Log for yourself + student ......... FREE (included)
├── Linked entries (times always match)  FREE (included)
├── Syllabus progress auto-update ...... FREE (with school context)
└── Safety pilot logging ............... FREE (included)
```

### AI Features (Optional Subscription)

AI enhances but never gates. Core app works perfectly without AI.

```
TIER 0: NO AI (Included)
├── Text-to-log basic parsing .......... Pattern matching, no AI
├── ForeFlight/EFB import .............. Parsing, no AI
├── Smart defaults ..................... Based on your history
└── Voice entry ........................ Device speech-to-text only

TIER 1: AI ASSIST - $4.99/month or $49/year
├── Natural language text-to-log
│   └── "Quick hop for lunch at the Runway Cafe, .6"
├── AI chat assistant
│   └── "Change my notification settings"
│   └── "What's my night currency?"
├── Smart scheduling suggestions
│   └── "When can I fly this week?"
└── ~100 AI queries/month

TIER 2: AI PRO (Schools) - $2/user/month (min 10 users)
├── Everything in Tier 1
├── Unlimited AI queries
├── Training analysis
│   └── "How are my students progressing?"
│   └── "Who needs work on landings?"
├── Fleet insights
│   └── "Which aircraft is most utilized?"
├── CFI tools
│   └── Auto-generate lesson summaries
└── School-wide analytics

TIER 3: AI ENTERPRISE - Custom pricing
├── Custom AI training on school's syllabus
├── Integration with school SOPs
├── Dedicated AI instance
└── API access
```

---

## Tier 2: Small Group (Partnership / Small Club)

### Who It's For
- Aircraft partnerships (2-4 owners)
- Small flying clubs (5-20 members)
- Informal training arrangements
- Groups who want to avoid subscriptions

### How It Works

**Option A: Cloud Folder Sync (Recommended for most)**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED CLOUD FOLDER                          │
│              (iCloud/Google Drive/Dropbox/OneDrive)             │
│                                                                 │
│  One member "hosts" - shares folder with others                │
│  All members grant app access to shared folder                 │
│  App reads/writes encrypted context data                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ Member A │      │ Member B │      │ Member C │
    │ (Admin)  │      │ (Member) │      │ (Member) │
    │          │      │          │      │          │
    │ Personal │      │ Personal │      │ Personal │
    │    +     │      │    +     │      │    +     │
    │  Club    │      │  Club    │      │  Club    │
    │ Context  │      │ Context  │      │ Context  │
    └──────────┘      └──────────┘      └──────────┘
```

**Sync Latency:** 5-60 seconds depending on cloud provider
**Cost to User:** $0 (uses existing cloud storage)
**Best For:** Partnerships, casual clubs, cost-conscious groups

---

**Option B: Hub Device (Better performance)**

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLUB HUB DEVICE                            │
│            (Old laptop, Raspberry Pi, NAS, etc.)                │
│                                                                 │
│  • Runs AeroEdge Hub software (free download)                  │
│  • Stays on and connected to internet                          │
│  • Members sync when on club WiFi or via internet              │
│  • Club owns and controls all data                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              Local WiFi or Internet (port forward/VPN)
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ Member A │      │ Member B │      │ Member C │
    └──────────┘      └──────────┘      └──────────┘
```

**Sync Latency:** <1 second on local network, 1-5 seconds remote
**Cost to User:** Hardware they provide (~$50-200 one-time)
**Best For:** Clubs with clubhouse, tech-comfortable admins

---

**Option C: Peer-to-Peer (No infrastructure)**

```
┌─────────────────────────────────────────────────────────────────┐
│                    DIRECT P2P SYNC                              │
│                                                                 │
│  Devices discover each other on same network                   │
│  Sync directly when "seeing" each other                        │
│  Works at club, FBO, member meetups                            │
│  Uses CRDT for conflict-free merging                           │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────┐              ┌──────────┐
    │ Member A │◄────WiFi────►│ Member B │
    └────┬─────┘              └─────┬────┘
         │                          │
         └──────────┬───────────────┘
                    ▼
              ┌──────────┐
              │ Member C │
              └──────────┘
              (syncs when meets A or B)
```

**Sync Latency:** Instant when devices meet
**Cost to User:** $0
**Best For:** Very small groups, partnerships, offline-tolerant use
**Limitation:** No remote sync unless devices physically meet

---

### Pricing Structure

```
CONTEXT LICENSE (One-Time, Per Group):
├── Partnership (2-4 users) ............ $99
├── Small Club (5-10 users) ............ $249
├── Medium Club (11-20 users) .......... $449
└── Additional users (beyond tier) ..... $29/user one-time

INCLUDES:
├── Multi-user context sync
├── Role-based permissions (admin, member)
├── Shared aircraft management
├── Shared scheduling
├── Basic booking conflict detection
├── Member billing/usage tracking
└── All sync methods (cloud folder, hub, P2P)

FEATURE ADD-ONS FOR GROUPS (One-Time):
├── Advanced Scheduling ................ $99
│   └── Recurring bookings, waitlist, buffer times
├── Maintenance Tracking Pro ........... $79
│   └── Full AMS integration, inspection alerts
├── Financial Reports .................. $49
│   └── Revenue tracking, usage reports
└── API Access ......................... $149
    └── Integration with other systems

HUB SOFTWARE: FREE
├── Download and run on your hardware
└── No licensing fees
```

### Context Data Separation

```python
# How personal vs group data works:

# Flight in personal context only (non-club flying)
flight_personal = {
    "id": "f-001",
    "contexts": ["personal:user-123"],
    "date": "2026-01-27",
    "aircraft": "N12345",  # Rented elsewhere
    "duration": 1.5,
}

# Flight in both contexts (club aircraft)
flight_club = {
    "id": "f-002",
    "contexts": ["personal:user-123", "club:flying-eagles"],
    "date": "2026-01-28",
    "aircraft": "N67890",  # Club aircraft
    "duration": 2.0,
    "billing_context": "club:flying-eagles",
}

# Club sees only f-002
# User sees both f-001 and f-002
# User's total time includes both
# Club billing only includes f-002
```

---

## Tier 3: Organization (Flight Schools / Large Clubs)

### Who It's For
- Part 61/141 flight schools
- Large flying clubs (20+ members)
- FBOs with rental fleets
- Multi-location operations
- Organizations needing guaranteed uptime

### Why They Need More

| Requirement | Small Group | Organization |
|-------------|:-----------:|:------------:|
| Users | 2-20 | 20-500+ |
| Concurrent bookings | Rare | Frequent |
| Real-time sync critical | Nice to have | Essential |
| Uptime requirement | Best effort | 99%+ |
| Compliance/audit | Minimal | Required |
| Support needs | Community | Direct |
| Data volume | MB | GB |

### How It Works

**Option A: Self-Hosted (Recommended for tech-capable orgs)**

```
┌─────────────────────────────────────────────────────────────────┐
│              ORGANIZATION'S INFRASTRUCTURE                       │
│                                                                 │
│  Cloud VM ($10-50/month from DigitalOcean, AWS, etc.)          │
│  OR On-premise server at school                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AEROEDGE SERVER (Free Software)            │   │
│  │                                                         │   │
│  │  • Full sync coordination                              │   │
│  │  • Real-time conflict resolution                       │   │
│  │  • Automated backups                                   │   │
│  │  • API for integrations                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  School controls: hosting, backups, security, costs            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        Students            CFIs             Admin
```

**Cost:** One-time license + their hosting costs (~$10-50/month)

---

**Option B: AeroEdge Managed (Hands-off)**

```
┌─────────────────────────────────────────────────────────────────┐
│                 AEROEDGE INFRASTRUCTURE                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          ISOLATED CONTEXT CONTAINER                     │   │
│  │                                                         │   │
│  │  • Dedicated resources for this org                    │   │
│  │  • No shared infrastructure with other orgs            │   │
│  │  • Data encrypted, org holds keys                      │   │
│  │  • Automated backups to org's cloud storage            │   │
│  │  • 99.9% uptime SLA                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  We handle: hosting, updates, backups, scaling                 │
│  Org can export and self-host anytime (no lock-in)            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        Students            CFIs             Admin
```

**Cost:** One-time license + monthly ops fee (at-cost, no margin)

---

### Pricing Structure

```
ORGANIZATION LICENSE (One-Time):
├── Starter (up to 25 users) ........... $999
├── Standard (up to 50 users) .......... $1,999
├── Professional (up to 100 users) ..... $3,499
├── Enterprise (up to 250 users) ....... $5,999
└── Additional users beyond tier ....... $25/user one-time

INCLUDES EVERYTHING IN SMALL GROUP PLUS:
├── SYLLABUS BUILDER (FULL) ⭐ INCLUDED
│   ├── CFR baselines (Part 61 AND Part 141)
│   ├── Visual syllabus editor
│   ├── Full CFR/ACS compliance engine
│   ├── Multi-syllabus student enrollment
│   ├── Cross-program credit tracking
│   ├── 141 TCO version control
│   ├── FSDO export formatting
│   └── Stage check workflows
├── Full scheduling with syllabus automation
├── Weather decision engine
├── CFI coverage automation
├── Maintenance integration (syllabus → aircraft queries)
├── Multi-location support
├── Role hierarchy (admin, ops, CFI, student, mx)
├── Compliance reporting (Part 141 ready)
├── Full API access
└── Data export tools

MONTHLY OPS FEE (Managed Hosting Only):
├── Calculation: Actual infrastructure cost ÷ users
├── Typical range: $2-5 per active user/month
├── Includes: Hosting, backups, monitoring, updates
├── No markup - we show you the cost breakdown
├── Annual prepay: 10% discount
└── Self-host option: $0/month (just one-time license)

EXAMPLE - 50 User Flight School:
├── One-time license: $1,999
├── Managed hosting: ~$150/month ($3/user × 50)
├── Annual cost: $1,800
├── Total Year 1: $3,799
├── Total Year 2+: $1,800/year
│
├── COMPARE TO FLIGHT SCHEDULE PRO:
│   └── ~$200/month = $2,400/year (no ownership)
│
└── COMPARE TO FLIGHT CIRCLE:
    └── ~$150/month = $1,800/year (no ownership)
```

### Syllabus Builder for Small Groups

Small Group tier can add basic Syllabus Builder:

```
SYLLABUS BUILDER ADD-ON (Small Group Tier): $199 one-time

INCLUDES:
├── Part 61 baselines (all certificates)
├── Visual syllabus editor
├── Basic CFR compliance checking
├── Up to 3 syllabi
├── Student progress tracking
└── Manual scheduling (no auto-integration)

DOES NOT INCLUDE:
├── Part 141 baselines
├── Full ACS mapping
├── Scheduler integration
├── Maintenance queries
├── Multi-enrollment
├── TCO version control
└── FSDO exports

BEST FOR:
├── Informal training arrangements
├── Partnerships doing training
├── Small clubs with instruction
└── Part 61 schools not needing full automation
```

### Feature Modules (One-Time Add-Ons)

```
SCHEDULING ADD-ONS:
├── Syllabus Automation Pro ............ $299
│   └── Auto-lesson assignment, cascade rescheduling
├── Weather Integration ................ $199
│   └── Auto weather checks, METAR/TAF, auto-cancel
├── CFI Coverage Automation ............ $149
│   └── Auto-notify available CFIs, first-accept-wins
└── Resource Optimization .............. $199
    └── Utilization balancing, demand forecasting

MAINTENANCE ADD-ONS:
├── Full AMS Integration ............... $249
│   └── Bidirectional sync, squawk workflow
├── Compliance Tracking ................ $149
│   └── AD tracking, inspection scheduling
└── Maintenance Forecasting ............ $99
    └── Predictive maintenance, cost projection

FINANCIAL ADD-ONS:
├── Billing & Invoicing ................ $299
│   └── Auto-generate invoices, payment tracking
├── Payroll Integration ................ $199
│   └── CFI pay calculation, reports
└── Financial Reporting Suite .......... $149
    └── Revenue analytics, P&L by aircraft

COMPLIANCE ADD-ONS:
├── Part 141 Module .................... $399
│   └── TCO reports, stage check tracking, records
├── GDPR/Privacy Module ................ $99
│   └── Data retention, export, deletion tools
└── Audit Trail Pro .................... $149
    └── Full change history, compliance exports

INTEGRATION ADD-ONS:
├── ForeFlight Integration ............. $99
├── Garmin Pilot Integration ........... $99
├── QuickBooks Integration ............. $149
├── Custom API Extensions .............. $299
└── SSO/SAML Integration ............... $199
```

---

## Pricing Comparison

### Solo Pilot Comparison

| Solution | Year 1 | Year 2 | Year 5 |
|----------|--------|--------|--------|
| **AeroEdge Solo Bundle** | $129 | $0 | $0 |
| ForeFlight Basic | $120 | $240 | $600 |
| Garmin Pilot | $100 | $200 | $500 |
| LogTen Pro | $150 | $150 | $150 |

*AeroEdge: Pay once, own forever*

### Flying Club Comparison (10 members)

| Solution | Year 1 | Year 2 | Year 5 |
|----------|--------|--------|--------|
| **AeroEdge Club** | $499* | $0 | $0 |
| Flight Schedule Pro | $2,400 | $4,800 | $12,000 |
| Flight Circle | $1,800 | $3,600 | $9,000 |
| Google Calendar | $0 | $0 | $0** |

*$249 context + 10 × $49 individual apps (members buy own)*
**No scheduling intelligence, maintenance tracking, or billing*

### Flight School Comparison (50 users)

| Solution | Year 1 | Year 2 | Year 5 |
|----------|--------|--------|--------|
| **AeroEdge Managed** | $3,799 | $1,800 | $9,000 |
| **AeroEdge Self-Host** | $1,999 | $600* | $4,200 |
| Flight Schedule Pro | $4,800 | $9,600 | $24,000 |
| Flight Circle | $3,600 | $7,200 | $18,000 |
| Talon/Custom | $10,000+ | $15,000+ | $50,000+ |

*Self-host: ~$50/month for VM hosting, paid to DigitalOcean/AWS, not us*

---

## Sync Architecture Deep Dive

### Data Layer (All Tiers)

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL DATABASE (SQLite)                       │
│                                                                 │
│  Every device has complete local database                       │
│  App works 100% offline                                        │
│  Sync is additive (merge changes, don't replace)               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    CRDT TABLES                          │   │
│  │                                                         │   │
│  │  • Each row has vector clock (version tracking)        │   │
│  │  • Changes recorded as operations                      │   │
│  │  • Merge = apply all operations in causal order        │   │
│  │  • Same result regardless of sync order                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Protocol

```
SYNC HANDSHAKE:

Device A                              Device B (or Hub)
    │                                      │
    │──── "I have changes since v123" ────►│
    │                                      │
    │◄─── "I have changes since v123" ─────│
    │      "Send me your changes"          │
    │                                      │
    │──── [Encrypted change log] ─────────►│
    │                                      │
    │◄─── [Encrypted change log] ──────────│
    │                                      │
    │     (Both apply changes locally)     │
    │                                      │
    │──── "Now at v156, you?" ────────────►│
    │                                      │
    │◄─── "Now at v156, synced!" ──────────│
    │                                      │

CONFLICT RESOLUTION (CRDT):

Scenario: Two users book same slot offline

User A (offline): Books N12345, 9:00 AM, timestamp T1
User B (offline): Books N12345, 9:00 AM, timestamp T2

When they sync:
├── Both bookings exist (CRDT doesn't delete)
├── Conflict detected by app logic
├── Resolution options:
│   ├── First-write-wins (T1 < T2, A wins)
│   ├── Last-write-wins (T2 > T1, B wins)
│   ├── Admin-resolves (flag for human)
│   └── Context-specific rules
└── Losing booking → suggested alternative time
```

### Context Isolation

```python
# Each context is cryptographically isolated

context_club = {
    "id": "ctx-flying-eagles",
    "name": "Flying Eagles Club",
    "encryption_key": "derived-from-shared-secret",
    "members": {
        "user-123": {"role": "admin", "joined": "2025-01-01"},
        "user-456": {"role": "member", "joined": "2025-06-15"},
    },
    "sync_config": {
        "method": "cloud_folder",
        "provider": "google_drive",
        "folder_id": "abc123",
    },
}

# Data tagged with context
booking = {
    "id": "book-789",
    "context_id": "ctx-flying-eagles",  # Belongs to this context
    "encrypted_data": "...",             # Only members can decrypt
}

# When user opens app:
# 1. Load personal context (always)
# 2. Load any group contexts they're member of
# 3. Decrypt and merge into unified view
# 4. Changes tagged with appropriate context
```

---

## Technical Requirements by Tier

### Tier 1: Solo

```yaml
Platforms:
  - iOS 15+
  - Android 10+
  - macOS 12+
  - Windows 10+
  - Web (PWA)

Local Storage:
  - SQLite (mobile/desktop)
  - IndexedDB (web)
  - ~50MB typical database size

Sync:
  - iCloud (iOS/macOS)
  - Google Drive (Android)
  - Local file sync (desktop)
  
Offline: 100% functionality

Dependencies:
  - None (fully standalone)
```

### Tier 2: Small Group

```yaml
All Tier 1 requirements plus:

Sync Options:
  Cloud Folder:
    - iCloud Drive shared folder
    - Google Drive shared folder
    - Dropbox shared folder
    - OneDrive shared folder
  
  Hub Device:
    - Raspberry Pi 4+ ($50-75)
    - Old laptop/desktop
    - NAS with Docker support
    - Any always-on computer
  
  P2P:
    - mDNS for local discovery
    - Direct socket connection
    - No infrastructure needed

Hub Software Requirements:
  - 1GB RAM minimum
  - 10GB storage
  - Internet connection (for remote access)
  - Runs on: Linux, macOS, Windows
  
Network:
  - Local sync: No internet needed
  - Remote sync: Port forward or VPN
```

### Tier 3: Organization

```yaml
All Tier 2 requirements plus:

Self-Hosted Server:
  Minimum:
    - 2 vCPU
    - 4GB RAM
    - 50GB SSD
    - Ubuntu 22.04 or similar
  
  Recommended (50+ users):
    - 4 vCPU
    - 8GB RAM
    - 100GB SSD
    - Automated backups
  
  Estimated Hosting Cost:
    - DigitalOcean: $24-48/month
    - AWS Lightsail: $20-40/month
    - On-premise: Hardware + electricity

Managed Hosting:
  - We handle all infrastructure
  - Isolated container per organization
  - Auto-scaling based on usage
  - 99.9% uptime SLA
  - Daily backups to org's cloud storage

Real-time Sync:
  - WebSocket connections
  - <1 second sync latency
  - Conflict resolution in real-time

API:
  - REST API for integrations
  - Webhook support
  - Rate limiting per organization
```

---

## Migration Paths

### Solo → Small Group

```
1. User has Solo license
2. Creates or joins group context
3. Purchases context license (or joins existing)
4. Personal data stays personal
5. New group flights tagged with both contexts
6. No data loss, additive process
```

### Small Group → Organization

```
1. Group outgrows cloud folder / P2P sync
2. Purchase organization license
3. Export context data
4. Import into managed or self-hosted server
5. All history preserved
6. Members reconnect to new sync endpoint
7. Upgrade is seamless, no data loss
```

### Organization → Self-Host (or vice versa)

```
1. Full data export available anytime
2. Standard format (SQLite + JSON)
3. Import tool provided
4. Switch sync method without losing data
5. No lock-in, ever
```

---

## Revenue Model Analysis

### Assumptions

```
Market Segments:
├── Solo pilots: 500,000+ in US alone
├── Partnerships: ~50,000
├── Flying clubs: ~3,000
├── Flight schools: ~1,500 Part 61, ~500 Part 141

Target Capture (5-year):
├── Solo: 1% = 5,000 users
├── Partnerships: 2% = 1,000 groups
├── Clubs: 5% = 150 clubs
├── Schools: 10% = 200 schools
```

### Revenue Projection

```
SOLO (5,000 users):
├── Average purchase: $89 (bundle + 1 add-on)
└── Revenue: $445,000 (one-time)

PARTNERSHIPS (1,000 groups × 3 avg users):
├── Context license: $99
├── Individual apps: 3 × $49 = $147
├── Average total: $246/group
└── Revenue: $246,000 (one-time)

CLUBS (150 clubs × 12 avg users):
├── Context license: $349 (avg tier)
├── Add-ons: $150 avg
├── Individual apps: bought by members
├── Average total: $499/club
└── Revenue: $74,850 (one-time)

SCHOOLS (200 schools × 75 avg users):
├── License: $2,499 (avg)
├── Add-ons: $500 avg
├── Monthly ops (managed): 100 schools × $150 × 12 = $180,000/yr
├── Self-host: No recurring
└── Revenue: $599,800 (one-time) + $180,000/yr (recurring)

TOTAL YEAR 1:
├── One-time: $1,365,650
├── Recurring: $180,000
└── Total: $1,545,650

TOTAL YEAR 5 (with growth):
├── One-time (add-ons, new customers): ~$500,000/yr
├── Recurring (managed hosting): ~$400,000/yr
└── Sustainable: ~$900,000/year
```

### Cost Structure

```
DEVELOPMENT (Year 1):
├── Your time: Sweat equity
├── Contract help: $50,000 (estimated)
└── Tools/services: $5,000

INFRASTRUCTURE (Annual):
├── Managed hosting costs: ~60% of fees collected
│   └── If collecting $180K, actual cost ~$108K
├── Support tools: $2,000
├── Marketing: $10,000
└── Legal/accounting: $5,000

MARGIN ON MANAGED HOSTING:
├── Charge: $3/user/month
├── Cost: ~$1.50-2/user/month
├── Margin: $1-1.50/user/month
├── Purpose: Cover support, updates, buffer
└── NOT profit extraction - just sustainability
```

---

## Competitive Positioning

### Why Users Choose AeroEdge

| Factor | AeroEdge | Flight Schedule Pro | Flight Circle | ForeFlight |
|--------|:--------:|:-------------------:|:-------------:|:----------:|
| One-time purchase | ✓ | ✗ | ✗ | ✗ |
| Own your data | ✓ | ✗ | ✗ | ✗ |
| Works offline | ✓ | Partial | Partial | ✓ |
| Self-host option | ✓ | ✗ | ✗ | ✗ |
| No account required (solo) | ✓ | ✗ | ✗ | ✗ |
| Military conversion | ✓ | ✗ | ✗ | ✗ |
| EM Diagrams | ✓ | ✗ | ✗ | ✗ |
| Syllabus automation | ✓ | Basic | Basic | ✗ |
| Weather auto-cancel | ✓ | ✗ | ✗ | ✗ |
| Transparent pricing | ✓ | ✗ | ✗ | ✗ |

### The Pitch

**To Solo Pilots:**
> "Pay once, own forever. No subscription, no account, no internet required. Your logbook, your data, your device."

**To Clubs:**
> "Stop paying $200/month for a calendar with airplane icons. Buy once, sync with your own cloud storage, never pay again."

**To Schools:**
> "The only scheduling system that actually understands flight training. Syllabus-driven automation, weather-aware dispatch, and you can self-host to control costs."

---

## Summary

```
AEROEDGE ECOSYSTEM PRICING:

SOLO (Individual):
├── Apps: $39-79 each, $129 bundle
├── Add-ons: $9-29 each
├── Sync: Free (your cloud storage)
└── Total: ~$129-200 forever

SMALL GROUP (2-20 users):
├── Context: $99-449 one-time
├── Apps: Members buy individually
├── Sync: Free (cloud folder, P2P, or self-hub)
└── Total: ~$250-700 forever

ORGANIZATION (20-500 users):
├── License: $999-5,999 one-time
├── Add-ons: $99-399 each
├── Managed hosting: $2-5/user/month (at-cost)
├── Self-host: $0/month (your infrastructure)
└── Total: 50-80% less than competitors over 5 years

PRINCIPLES:
├── Own what you buy
├── Pay only for what you need
├── Subscription = actual costs only
├── Self-host always an option
├── Export your data anytime
└── No lock-in, ever
```

This model lets the greybeard buy once and never think about it again, the club avoid death-by-subscription, and the school get enterprise features without enterprise pricing. Everyone pays for value, nobody pays for our profit margin on their recurring pain.
