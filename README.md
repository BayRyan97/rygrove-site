# Employee Time Tracking & Expense Management System

A comprehensive web application for managing employee time entries, expenses, invoices, and project estimates. Built with React, TypeScript, and Supabase.

## Features

### Time Entry Management
- **Quick Entry**: Submit time entries with date, location, and work hours
- **Full Day & Partial Day**: Support for both full workday and custom time ranges
- **Lunch Break Tracking**: Configurable lunch break durations (30 min, 45 min, 1 hour)
- **Bulk Entry**: Add multiple time entries for different dates at once
- **8+ Hour Validation**: Automatic confirmation prompt when entering more than 8 hours in a day

### Expense Tracking
- **Integrated Expenses**: Add expenses directly to time entries
- **Receipt Upload**: Upload and attach receipt images (JPEG, PNG, HEIC, HEIF)
- **Retailer Management**: Track expenses by retailer with autocomplete
- **Expense Reports**: View and manage all expenses with filtering options

### Admin Dashboard
- **User Management**: Create and manage employee accounts
- **Role-Based Access**: Admin and employee roles with different permissions
- **Time Entry Oversight**: View, edit, and delete any employee's time entries
- **Password Reset**: Admin can reset user passwords
- **Advanced Filtering**: Filter time entries by date range, employee, and location
- **CSV Export**: Export time entry data for external analysis

### Invoice & Estimate Tools
- **Invoice Creation**: Generate professional invoices with line items and calculations
- **Estimate Worksheets**: Create detailed project estimates with labor and material costs
- **Activity Tracking**: View comprehensive activity logs and reports

### Dashboard & Analytics
- **Real-time Statistics**: View hours worked, expenses, and activity summaries
- **Visual Charts**: Interactive charts for time and expense analysis
- **Date Range Filtering**: Analyze data across custom date ranges

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for receipts)
- **Build Tool**: Vite
- **Charts**: Chart.js with react-chartjs-2
- **Date Handling**: date-fns
- **Forms**: React Hook Form
- **Excel Export**: xlsx

## Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rygrove/rygrove-site.git
   cd rygrove-site
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   Get these values from your Supabase project settings:
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Go to Settings > API
   - Copy the Project URL and anon/public key

## Database Setup

The application includes migration files in `supabase/migrations/`. To set up your database:

1. **Install Supabase CLI** (optional, for local development)
   ```bash
   npm install -g supabase
   ```

2. **Apply migrations**

   You can either:
   - Use the Supabase Dashboard SQL Editor to run the migration files in order
   - Or use the Supabase CLI:
     ```bash
     supabase db push
     ```

3. **Set up Storage**

   In your Supabase project:
   - Go to Storage
   - Create a bucket named `receipts`
   - Set it to public or configure appropriate policies

### Database Schema

The application uses these main tables:
- `profiles` - User profiles with roles (admin/employee)
- `time_entries` - Time tracking records
- `expenses` - Expense records linked to time entries
- `retailers` - Retailer/vendor information
- `invoices` - Invoice records
- `estimate_worksheets` - Project estimate data

## Usage

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Production Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## User Roles & Permissions

### Employee
- Submit their own time entries and expenses
- View their own dashboard and activity
- Create invoices
- Create estimate worksheets

### Admin
All employee permissions plus:
- View and manage all users
- Create new user accounts
- Reset user passwords
- View, edit, and delete all time entries
- Enter time on behalf of any employee
- Access advanced filtering and reporting
- Export data to CSV

## Default Admin Setup

To create your first admin user:

1. Sign up through the application
2. In your Supabase Dashboard, go to Authentication > Users
3. Find your user and note the User UID
4. In the SQL Editor, run:
   ```sql
   UPDATE profiles
   SET role = 'admin'
   WHERE id = 'your-user-uid';
   ```

## Key Features Guide

### Submitting Time Entries

1. Navigate to "Time Entries"
2. Fill in the date, location, and work hours
3. Toggle between Full Day (8 hours) or Partial Day (custom hours)
4. Add lunch break if applicable
5. Click "Add Expense" to attach any expenses
6. Submit the entry

### Managing Expenses

1. Expenses are added within time entries
2. Enter amount, retailer, and description
3. Upload receipt image (optional but recommended)
4. Multiple expenses can be added to each time entry

### Admin Functions

1. Access the Admin Dashboard from the main navigation
2. Switch between "Users" and "Time Entries" views
3. Use filters to find specific entries
4. Click edit icon to modify entries
5. Click delete icon to remove entries (with confirmation)
6. Export filtered data using the "Export CSV" button

### Creating Invoices

1. Go to "Create Invoice"
2. Fill in client information
3. Add line items with descriptions and amounts
4. System automatically calculates totals
5. Save or print the invoice

## Security Features

- Row Level Security (RLS) policies on all tables
- Authenticated access required for all operations
- Admin-only operations protected at database level
- Receipt uploads scoped to user directories
- Secure password reset flow

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### Cannot connect to Supabase
- Verify your `.env` file has correct credentials
- Check that your Supabase project is active
- Ensure your IP is not blocked in Supabase settings

### Receipt upload fails
- Verify the `receipts` bucket exists in Supabase Storage
- Check storage policies allow authenticated uploads
- Ensure file is under 5MB and is a valid image format

### Admin features not visible
- Verify your user role is set to 'admin' in the profiles table
- Clear browser cache and reload

## Contributing

This is a private project. For questions or support, contact the repository owner.

## License

Private - All rights reserved

## Support

For issues or questions, please open an issue on GitHub or contact the development team.

---

Built with React, TypeScript, and Supabase
