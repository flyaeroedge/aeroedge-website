# Claude Context: Website Node

## Node Purpose

The Website node is the public marketing website for AeroEdge. It handles:
- Product information and features
- Pricing pages
- Documentation and help
- Blog/content marketing
- User signup flow

## Key Features
- Static site with dynamic elements
- SEO optimized
- Responsive design
- Integration with signup/trial flow

## Ecosystem Position

This node is largely standalone and does not participate in the event bus. It connects to the authentication system for signup but doesn't emit or receive events from other nodes.

### Events This Node PUBLISHES:
- (none)

### Events This Node LISTENS TO:
- (none)

### Queries This Node PROVIDES:
- (none)

### Queries This Node REQUIRES:
- (none - standalone marketing site)

## Key Files

```
aeroedge_website/
├── _ecosystem/           # Synced from master
│   ├── docs/
│   └── schemas/
├── CLAUDE_CONTEXT.md     # This file
├── app/                  # Application code
└── public/               # Static assets
```

## Pages

- `/` - Homepage with hero, features, testimonials
- `/features` - Detailed feature breakdown
- `/pricing` - Pricing tiers and comparison
- `/docs` - User documentation
- `/blog` - Content marketing
- `/signup` - Trial signup flow
- `/login` - User login

## Current Sprint

- [ ] Homepage design and implementation
- [ ] Pricing page
- [ ] Features pages
- [ ] Mobile responsive

## Local Development

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3005 | http://localhost:3005 |
| Backend API | 5005 | http://localhost:5005 |

```bash
# Start frontend
PORT=3005 npm run dev

# Start backend (CMS API)
API_PORT=5005 npm run dev:api
```

## Development Notes

- Focus on SEO and performance
- See `_ecosystem/docs/PORT_ALLOCATION.md` for full port assignments
- Use marketing copy from `_ecosystem/docs/AEROEDGE_GO_TO_MARKET.md`
- Pricing tiers from `_ecosystem/docs/AEROEDGE_PRICING_AND_SYNC_ARCHITECTURE.md`
