# Dorm Space

A marketplace for college students to buy and sell dorm essentials. Currently supporting MIT, with plans to expand to other universities.

## Features

- **User Authentication** - .edu email verification, JWT sessions, password reset
- **Listings** - Create, edit, and browse listings with up to 6 images per item
- **Real-time Messaging** - Server-sent events (SSE) powered chat between buyers and sellers
- **AI-Powered Listings** - Generate titles and descriptions from item photos using Claude/GPT
- **Favorites** - Save listings for later
- **Search & Filter** - Find items by keyword, category, price, and sort order

## Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **React Router** for navigation

### Backend
- **Express.js** (Node.js)
- **PostgreSQL** database
- **JWT** authentication
- **Nodemailer** for transactional emails

### ML Service
- **FastAPI** (Python)
- **Anthropic Claude / OpenAI** for AI-generated listing content
- **LangGraph** for orchestration

### Infrastructure
- **AWS S3** for image storage (presigned URLs)
- **Supabase** for hosted PostgreSQL
- **Firebase Hosting** for frontend
- **Railway** for backend and ML service

## Project Structure

```
├── frontend/          # React + Vite application
├── backend/           # Express API server
├── ml-service/        # FastAPI AI service
└── .github/workflows/ # CI/CD for Firebase deployment
```

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Configure environment variables
node index.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### ML Service
```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Environment Variables

See each service directory for required environment variables:
- `backend/.env` - Database URL, JWT secret, AWS credentials, email config
- `frontend/.env` - API base URL
- `ml-service/.env` - AI provider keys, eBay API credentials

## License

MIT
