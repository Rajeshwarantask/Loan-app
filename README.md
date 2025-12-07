# Community Loan Tracker PWA

A comprehensive Progressive Web Application for managing community loans, payments, and financial cycles. Built with Next.js 16, React 19, Supabase, and TypeScript.

## Features

### For Users
- **Dashboard**: View loan summaries, payment history, and financial statistics
- **Loan Calculator**: Calculate monthly EMI with detailed month-wise breakdowns
- **Loan Requests**: Submit loan requests directly to admins
- **Payment Tracking**: Monitor all loans, payments, and pending balances
- **Notice Board**: Stay updated with community announcements
- **Contact Admins**: Easy access to administrator contact information
- **Offline Support**: View cached data even without internet connection

### For Admins
- **User Management**: Add, edit, and remove community members
- **Loan Management**: Create and track all loans in the system
- **Request Approval**: Review and approve/reject loan requests
- **Notice Management**: Create and manage community announcements
- **Payment Updates**: Manually update payment statuses for offline transactions
- **Complete Reports**: Access to all user data and transaction history

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Row Level Security
- **Charts**: Recharts
- **PWA**: Service Worker, Web App Manifest

## Getting Started

### Prerequisites
- Node.js 18+ installed
- A Supabase account and project

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables (already configured in this project)

4. Run database migrations:
   - Execute SQL scripts in the \`scripts\` folder in order
   - \`001_create_tables.sql\` - Creates all database tables and RLS policies
   - \`002_create_profile_trigger.sql\` - Sets up automatic profile creation
   - \`003_seed_data.sql\` - Optional sample data

5. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

6. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

### Tables
- **profiles**: User profiles with role-based access
- **loans**: Loan records with amount, interest rate, duration
- **loan_payments**: Monthly payment tracking
- **monthly_contributions**: Community fund contributions
- **notices**: Admin announcements
- **loan_requests**: User loan applications
- **community_fund**: Overall fund balance tracking

All tables have Row Level Security (RLS) enabled to ensure users only access their own data.

## Key Concepts

### Loan Calculation
The system uses simple interest calculation:
- Total Interest = Principal × Interest Rate × Duration
- Monthly Payment = (Principal + Total Interest) / Duration

### Community Fund Model
- Members contribute monthly (e.g., ₹2000/month)
- Pooled funds are available for member loans
- Interest is calculated on remaining principal
- All transactions happen offline and are tracked manually

### Payment Reminders
- Automatic reminders during the last 5 days of each month
- Notices created for users with unpaid contributions
- Admins can manually update payment statuses

## PWA Features

### Install Prompt
- Dismissible install banner
- Works on both mobile and desktop
- Preference saved in localStorage

### Offline Support
- Service worker caches key pages
- Offline fallback page
- Background sync for pending requests

### App Icons
- 192x192 and 512x512 icons included
- Apple touch icon support
- Maskable icons for adaptive display

## Security

- Row Level Security (RLS) on all tables
- Users can only access their own data
- Admins have elevated permissions
- Secure authentication with Supabase
- Environment variables for sensitive data

## Mobile-First Design

- Responsive layout for all screen sizes
- Bottom navigation on mobile devices
- Sidebar navigation on desktop
- Touch-friendly UI components
- Optimized for 27-35 age group

## Future Enhancements

- Excel export functionality for admin reports
- Automated payment reminder notifications
- SMS/Email integration for offline payments
- Advanced analytics and reporting
- Multi-language support

## License

This project is for community financial management use.
