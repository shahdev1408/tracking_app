# Employee Location Tracking App — Project Overview

## Folder structure
```
tracking-app/
├── backend/        Node.js + Express + MongoDB API (tested, working)
├── mobile-app/      React Native app: punch-in + background tracker (code ready, needs RN environment to run)
```

## Build order (recommended)
1. **Backend first** — get it running locally or on a free host (Render/Railway + MongoDB Atlas), test with curl/Postman.
2. **Mobile app punch-in screen** — get manual punch working end-to-end against the backend.
3. **Background tracker** — add once punch-in is validated (this needs real device testing, won't fully work in an emulator).
4. **Admin dashboard** (not built yet) — simple web page for your manager to see reports; can reuse the pandas/Excel logic from Project 1 for exports.

See `backend/README.md` and `mobile-app/README.md` for detailed setup steps.
