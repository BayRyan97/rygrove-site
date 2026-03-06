# Employee Time Tracking & Project Management System

> Last updated: March 6, 2026

A comprehensive full-stack web application for managing employee time entries, expenses, invoices, project planning, and estimates. Built with React 18, TypeScript, Vite, and Supabase for small businesses and contractors.

## 🎯 Features Overview

### 📊 Project Planner with Gantt Chart
- **Interactive Gantt Chart**: Visual timeline with automatic viewport based on project dates
- **Drag & Drop Scheduling**: Reschedule tasks by dragging them across the timeline
- **Category Management**: Organize tasks into color-coded categories for visual distinction
- **Task Tracking**: Create, track, and mark tasks as complete
- **Bulk Task Operations**: Select multiple tasks to mark complete, move categories, or delete at once
- **Post-it Notes Board**: Sticky-note style brainstorming and idea capture
- **Note Comments**: Add threaded comments to notes for team collaboration
- **Promote Notes to Tasks**: Convert notes into scheduled tasks with start/end dates
- **Progress Monitoring**: Track task completion status and project progress
- **Smart Timeline**: Automatically adjusts viewport based on project date ranges

### ⏱️ Time Entry Management
- **Quick Entry**: Submit time entries with date, location, and work hours
- **Flexible Scheduling**: Support for full day (8 hours) and custom partial day entries
- **Work Type Classification**: Select from Contract, Time and material, Additional to the contract, or Other (with custom description)
- **Lunch Break Tracking**: Configurable lunch break durations (30 min, 45 min, 1 hour)
- **Multiple Entry Forms**: Add multiple time entries for different dates in one submission
- **Duplicate Entry**: Quickly copy an entry to the next day with one click
- **8+ Hour Validation**: Automatic confirmation prompt for entries exceeding 8 hours
- **Admin/Supervisor Proxy Entry**: Admins and supervisors can enter time on behalf of any employee
- **Delete Protection**: Proper RLS policies ensure only authorized deletions

### 💰 Expense Tracking
- **Integrated Expenses**: Add multiple expenses per time entry as individual line items
- **Standalone Expenses**: Submit expenses independent of time entries via Expense Worksheet
- **Receipt Upload**: Upload and store receipt images (JPEG, PNG, HEIC, HEIF formats)
- **Retailer Management**: Track expenses by retailer with autocomplete suggestions
- **Expense Filtering**: Rich query options for viewing and analyzing all expenses
- **Category Tracking**: Organize expenses by type and associate with projects
- **Invoice Integration**: Standalone expenses automatically included in location invoices
- **Bulk Viewing**: Comprehensive expense management across all employees

### 👥 Admin Dashboard & Management
- **User Management**: Create and manage employee accounts with role assignment (admin/supervisor/employee)
- **Role-Based Access**: Three-tier role system with granular permissions enforced via RLS
- **Profile Picture Management**: Upload and customize profile pictures for any user with zoom/pan controls
- **Chart Color Customization**: Assign custom hex colors to each user for activity dashboard charts
- **Native Color Picker**: Visual color selection with live preview and hex input
- **Bulk Color Assignment**: Auto-assign distinct colors to all users alphabetically with one click
- **Hourly Rate Management**: Set and track hourly rates for each employee
- **Labor Cost Calculation**: Automatic calculation of labor costs based on hours × rate
- **Time Entry Oversight**: View, edit, and delete time entries for all employees
- **Inline Editing**: Edit time entries directly from activity view without navigating to Admin Dashboard
- **Password Reset**: Admin password reset flow via Supabase Edge Function
- **Advanced Filtering**: Multi-criteria filtering by date range, employee, and location
- **CSV/XLSX Export**: Export time entry and expense data for external analysis
- **Activity Monitoring**: Real-time view of all employee activity and time entries
- **Audit Trail**: Comprehensive logs of all user actions

### 📄 Invoice & Estimate Generation
- **Professional Invoices**: Generate invoices with line items, totals, and tax calculations
- **Estimate Worksheets**: Create detailed project estimates with labor rates and material costs
- **Estimate Versioning**: Automatic version numbering (v1, v2, v3) when saving estimate revisions
- **Version Management**: Expand/collapse to view all versions of an estimate
- **Duplicate Estimates**: Create new versions from existing estimates
- **PDF Export**: Generate downloadable PDF versions of invoices and estimates
- **Activity Tracking**: View comprehensive logs of all invoices and estimates created
- **Client Management**: Track client information and invoice history

### � Profile Pictures
- **Upload & Customize**: Drag and drop or select profile pictures (JPEG, PNG formats)
- **Zoom & Position**: Interactive zoom and pan controls for perfect framing
- **Real-time Preview**: See changes before saving with live preview
- **Admin Management**: Admins can upload/edit pictures for any user
- **Secure Storage**: Images stored in Supabase storage bucket with proper access controls
- **Dashboard Display**: Profile pictures appear in navigation header and user lists

### 📈 Dashboard & Analytics
- **Real-time Statistics**: Widgets showing hours worked, expenses, and activity summaries
- **Visual Analytics**: Interactive Chart.js-powered charts for time and expense trends
- **Stacked Bar Chart**: Daily hours broken down by employee with unique color coding
- **Custom Chart Colors**: Each employee has a unique, customizable color in charts (set via Admin Dashboard)
- **Intelligent Color Fallback**: Auto-generated colors for users without custom colors assigned
- **Pie Chart**: Hours distribution across job locations with percentages
- **Interactive Tooltips**: Hover to see location details and exact hours
- **Chart Toggle**: Switch between bar and pie visualizations
- **Date Range Filtering**: Analyze data across custom date ranges
- **Quick Date Ranges**: Preset filters for week, month, quarter, 6 months, year, or custom range
- **Performance Insights**: Track individual and team performance metrics
- **Employee Insights**: Detailed breakdown of work patterns and expense distributions
- **Audio Feedback**: Success and error sounds for form submissions and validation failures
- **Organized Navigation**: Grouped dropdown menu with Core, Tools, and Admin sections

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5 with HMR support
- **Styling**: Tailwind CSS with custom gradients and animations
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Forms**: React Hook Form with validation
- **Charts**: Chart.js with react-chartjs-2

### Backend & Database
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with PKCE flow
- **Storage**: Supabase Storage (for receipt uploads)
- **Edge Functions**: Supabase Edge Functions (Deno runtime) for password reset

### Utilities
- **Date Handling**: date-fns
- **Excel Export**: xlsx
- **PDF Generation**: jspdf with jspdf-autotable
- **Drag & Drop**: Native HTML5 Drag and Drop API
- **Audio Feedback**: HTML5 Audio API with MP3 support
- **Linting**: ESLint with TypeScript support

## ⚡ Quick Start

```bash
# 1. Clone and install
git clone https://github.com/rygrove/rygrove-site.git
cd rygrove-site
npm install

# 2. Set environment variables
echo "VITE_SUPABASE_URL=your_url" > .env
echo "VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE

# 3. Start development server
npm run dev

# 4. Open http://localhost:5173
```

## 📋 Prerequisites

- Node.js 18+ and npm
- A Supabase account and project
- Git for version control

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/rygrove/rygrove-site.git
cd rygrove-site
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
```

**Get these values from Supabase:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy the Project URL and anon/public key

### 4. Database Setup

Apply all migrations to your Supabase database:

**Option A: Supabase Dashboard (Recommended)**
- Go to your Supabase Dashboard → SQL Editor
- Run migration files in chronological order (sorted by filename timestamp)
- Start with `20250220173910_crystal_gate.sql` and proceed sequentially
- All migration files are located in `supabase/migrations/`

**Option B: Supabase CLI**
```bash
supabase db push
```

### 5. Create Storage Buckets

In your Supabase project:
1. Go to Storage
2. Create two buckets:
   - `receipts` - For expense receipt uploads
   - `profile-pictures` - For user profile pictures
3. Configure storage policies for authenticated users on both buckets
4. Receipt uploads limited to 5MB (JPEG, PNG, HEIC, HEIF formats)
5. Profile picture uploads limited to 5MB (JPEG, PNG formats)

### 6. Deploy Edge Function

The password reset feature requires deploying an Edge Function:

**Using Supabase CLI:**
```bash
supabase functions deploy reset-user-password
```

**Or manually in Supabase Dashboard:**
1. Go to Edge Functions
2. Create new function: Name it `reset-user-password`
3. Copy the code from `supabase/functions/reset-user-password/index.ts`
4. Deploy and test

### 7. Create Your Admin Account

1. Sign up through the application UI
2. In Supabase Dashboard, go to Authentication → Users
3. Find your user and note the User ID
4. Go to SQL Editor and run:
   ```sql
   UPDATE profiles
   SET role = 'admin'
   WHERE id = 'your-user-id';
   ```

## 🏃 Running the Application

### Development Server
```bash
npm run dev
```
The application will be available at `http://localhost:5173` with HMR enabled for fast refresh.

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Lint Code
```bash
npm run lint
```

## 📚 Database Schema

### Core Tables

**profiles**
- User profiles with three-tier role system (admin/supervisor/employee)
- Email, full name, and authentication metadata
- Hourly rate for labor cost calculation
- Profile picture URL and positioning metadata (zoom, offsetX, offsetY)
- Created automatically on signup via trigger

**time_entries**
- Time tracking records with date, location, hours
- Work type classification (array field)
- Work type other (free-form text for custom types)
- Links to user profiles

**expenses**
- Expense records linked to time entries
- Amount, retailer, description
- Receipt file storage references

**retailers**
- Retailer/vendor information
- Used for autocomplete in expense forms

**invoices**
- Invoice records with client information
- Line items with descriptions and amounts
- Totals and tax calculations

**estimate_worksheets**
- Project estimate data
- Labor and material cost tracking
- Client association

### Project Planner Tables

**planner_projects**
- Project definitions with name and dates
- Start and end date for automatic timeline calculation
- User association for multi-project support

**planner_categories**
- Project task categories
- Color-coded organization (color_index and custom_color)
- Sort order for custom arrangement

**planner_tasks**
- Individual tasks with scheduling
- Start and end dates for Gantt chart
- Completion status tracking
- Category association

**planner_notes**
- Post-it style notes for brainstorming
- Project and category association
- Created and updated timestamps
- Creator tracking for audit trails

**planner_note_comments**
- Comments on planner notes for team collaboration
- Links to planner_notes via note_id
- Tracks comment author and timestamps
- Supports threaded discussions on project notes

### Key Database Features
- **Row Level Security (RLS)**: All tables protected with Postgres RLS policies
- **Foreign Keys**: Proper relationships with CASCADE deletes where appropriate
- **Indexes**: Strategic indexes on frequently queried columns
- **Triggers**: Automatic profile creation on user signup
- **Audit Trail**: Timestamp tracking on all notes

## 👤 User Roles & Permissions

### Employee Role
- ✅ Submit own time entries
- ✅ Add expenses to time entries
- ✅ Upload receipt images
- ✅ View own dashboard and activity
- ✅ Create invoices
- ✅ Create estimate worksheets
- ✅ Access project planner
- ✅ Upload and customize own profile picture
- ❌ Cannot view other employees' data
- ❌ Cannot manage users

### Supervisor Role
- ✅ Submit time entries on behalf of any employee
- ✅ View activity for all employees
- ✅ Add expenses on behalf of employees
- ✅ Access all non-admin features (planner, invoices, estimates)
- ✅ View activity dashboard with charts
- ✅ Upload and customize own profile picture
- ❌ Cannot access Admin Dashboard
- ❌ Cannot create/manage users
- ❌ Cannot reset passwords
- ❌ Cannot export CSV/XLSX data
- ❌ Cannot delete time entries
- ❌ Cannot change user roles or hourly rates
- ❌ Cannot upload profile pictures for other users

### Admin Role
All employee permissions plus:
- ✅ View and manage all users
- ✅ Create new employee accounts
- ✅ Generate temporary passwords for users
- ✅ View, edit, and delete all time entries
- ✅ Enter time on behalf of any employee
- ✅ Advanced filtering (date range, employee, location, work type)
- ✅ Export data to CSV/XLSX
- ✅ Monitor all employee activity in real-time
- ✅ Manage all expenses across organization
- ✅ View comprehensive audit logs

## 📖 Usage Guide

### Submitting Time Entries

1. Navigate to **Time Entries** from the main menu
2. Click **Add Time Entry**
3. Select the date for the time entry
4. Enter location where work was performed
5. Select work type: Contract, Time and material, Additional to the contract, or Other (with custom description)
6. Select entry type:
   - **Full Day**: Automatically sets 8 hours
   - **Partial Day**: Enter specific hours worked
7. Select lunch break duration if applicable (30 min, 45 min, 1 hour)
8. *(Optional)* Click **Add Expense** to attach expenses with receipts
9. Review entry details
10. Click **Submit** to save the entry

**Note:** If entering more than 8 hours, you'll see a confirmation prompt.

### Managing Expenses

1. Expenses are added within time entries
2. When adding an expense, enter:
   - **Amount**: Total cost
   - **Retailer**: Select from list or type new retailer
   - **Description**: What was purchased
3. *(Optional)* Upload a receipt image (JPEG, PNG, HEIC, HEIF)
4. Multiple expenses can be added to each time entry
5. View all expenses in the **Expenses** page with filtering options

### Using the Project Planner

1. Navigate to **Planner** from the main menu
2. **Create a Project**:
   - Click **+ New Project**
   - Enter project name, start date, and end date
   - The Gantt chart automatically adjusts to show the timeline
3. **Add Categories**:
   - Click **+ Category** in the timeline section
   - Choose a color to visually distinguish the category
4. **Create Tasks**:
   - Click **+ Task** within a category
   - Set task name, start date, and end date
   - Tasks appear on the Gantt chart as colored bars
5. **Reschedule Tasks**:
   - Drag tasks horizontally to move them on the timeline
   - Drop to set new dates
6. **Use Post-it Notes**:
   - Scroll to the **Notes Board** below the Gantt chart
   - Click **New Note** to create sticky-note style comments
   - Assign notes to categories for organization
   - Promote notes to tasks when ready to schedule them
7. **Track Progress**:
   - Check the box next to completed tasks
   - Completed tasks are visually distinguished

### Admin: Managing Users

1. Access **Admin Dashboard** from the main navigation
2. Go to the **Users** tab
3. View all users with their roles and email addresses
4. **Create New User**:
   - Click **+ New User**
   - Enter email and select role (admin or employee)
   - System generates a temporary password
5. **Reset User Password**:
   - Find the user in the list
   - Click **Reset Password**
   - A temporary password is generated (format: `TempXXXXXXXXXXXX!`)
   - Share this password with the user
   - User should change it immediately after login

### Admin: Time Entry Management

1. Access **Admin Dashboard** from the main navigation
2. Go to the **Time Entries** tab
3. **Filter Entries**:
   - By date range using calendar selectors
   - By employee from dropdown
   - By location using search
   - By work type from checkboxes
4. **Edit Entry**:
   - Click the edit icon on any entry
   - Modify hours, location, work type, or expenses
   - Click save to update
5. **Delete Entry**:
   - Click the delete icon on any entry
   - Confirm the deletion in the prompt
6. **Enter Time for Employee**:
   - Click **Add Time Entry** (on behalf of)
   - Select the employee
   - Fill in entry details
   - Submit
7. **Export Data**:
   - Apply filters as needed
   - Click **Export CSV** button
   - File downloads with filtered entries

### Creating Invoices

1. Navigate to **Create Invoice** from the main menu
2. **Enter Invoice Details**:
   - Client name, address, and contact information
   - Invoice number and date
   - Due date
3. **Add Line Items**:
   - Click **+ Add Line Item**
   - Enter description, quantity, and rate
   - System calculates subtotal
4. **Review Totals**:
   - Subtotal is calculated automatically
   - Add tax amount if applicable
   - Final total updates automatically
5. **Save or Print**:
   - Click **Save Invoice** to store in database
   - Click **Print** to generate PDF for printing/sharing

### Creating Estimate Worksheets

1. Navigate to **Estimate Worksheet** from the main menu
2. **Enter Project Details**:
   - Project name and description
   - Client information
   - Project dates if applicable
3. **Add Labor Items**:
   - Click **+ Add Labor**
   - Enter task description, hours, and hourly rate
   - Subtotal calculates automatically
4. **Add Material Items**:
   - Click **+ Add Material**
   - Enter material description and cost
   - Quantity multiplies automatically
5. **Review Summary**:
   - Labor total, material total, and grand total display
6. **Save or Export**:
   - Click **Save Estimate** to store
   - Click **Download PDF** for sharing with client

## 🔒 Security Features

- **Row Level Security (RLS)**: All database tables protected with Postgres RLS policies
- **Authenticated Access**: All operations require valid Supabase session
- **Admin-Only Operations**: Protected at database level with RLS policies
- **Supervisor Restrictions**: Database-level enforcement prevents admin actions by supervisors
- **Service Role Protection**: Admin operations use Edge Functions with service role (never exposed to client)
- **Receipt Storage**: Uploads scoped to authenticated users with bucket policies
- **Profile Picture Storage**: Separate bucket with authenticated-user policies and metadata security
- **Secure Password Reset**: One-time temporary password generation via Edge Function
- **PKCE Auth Flow**: Enhanced security with proof key for code exchange
- **Delete Policies**: Proper RLS ensures only authorized users can delete data

## 🐛 Troubleshooting

### Cannot Connect to Supabase
- ✓ Verify `.env` file has correct credentials
- ✓ Check that Supabase project is active (not paused)
- ✓ Ensure your IP is not blocked in Supabase settings
- ✓ Verify the Supabase URL is correct (e.g., `https://xxxxx.supabase.co`)
- ✓ Check that `VITE_SUPABASE_ANON_KEY` is not blank

### Password Reset Button Keeps Spinning
- ✓ Ensure the Edge Function is deployed in Supabase Dashboard
- ✓ Verify CORS headers are present in the Edge Function code
- ✓ Check browser console (F12) for CORS or network errors
- ✓ Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function secrets
- ✓ Test the function manually in Supabase Dashboard

### Receipt Upload Fails
- ✓ Verify `receipts` bucket exists in Supabase Storage
- ✓ Check storage policies allow authenticated uploads
- ✓ Ensure file is under 5MB and is a valid image format (JPEG, PNG, HEIC, HEIF)
- ✓ Verify browser console for specific error messages
- ✓ Check Supabase Storage logs for upload errors

### Admin Features Not Visible
- ✓ Verify user role is set to `admin` in the profiles table
- ✓ Clear browser cache and reload (Ctrl+Shift+R or Cmd+Shift+R)
- ✓ Log out and log back in
- ✓ Check that user ID matches the profile update query

### Time Entries Reappear After Deletion
- ✓ This was fixed in migration `20260203_add_delete_policy_time_entries.sql`
- ✓ Ensure all migrations are applied in order
- ✓ Verify RLS policies on `time_entries` table include DELETE policy

### Gantt Chart Not Displaying
- ✓ Check that project has valid start and end dates
- ✓ Verify date format is correct (YYYY-MM-DD)
- ✓ Check browser console for JavaScript errors
- ✓ Ensure `planner_projects` and `planner_tasks` tables exist

### Planner Tasks Not Draggable
- ✓ Ensure JavaScript is enabled in your browser
- ✓ Check browser console (F12) for errors
- ✓ Verify project has valid start and end dates
- ✓ Refresh the page and try again
- ✓ Test in a different browser to isolate the issue

### Post-it Notes Feature Not Working
- ✓ Run migration `20260202_create_planner_notes.sql`
- ✓ Verify `planner_notes` table exists in Supabase
- ✓ Check RLS policies are properly configured
- ✓ Check browser console for database errors
- ✓ Verify user has authenticated session

### Application Won't Start (`npm run dev`)
- ✓ Delete `node_modules` and run `npm install` again
- ✓ Clear npm cache: `npm cache clean --force`
- ✓ Ensure Node.js version is 18+: `node --version`
- ✓ Check for port 5173 conflicts: `lsof -i :5173`
- ✓ Check ESLint errors: `npm run lint`

### Profile Picture Upload Fails
- ✓ Verify `profile-pictures` bucket exists in Supabase Storage
- ✓ Check storage policies allow authenticated uploads
- ✓ Ensure file is under 5MB and is JPEG or PNG format
- ✓ Check browser console for CORS errors or network issues
- ✓ Verify user has authenticated session

### Charts Not Displaying in Activity Dashboard
- ✓ Ensure Chart.js is properly loaded (check browser console)
- ✓ Verify date range contains time entries
- ✓ Clear browser cache and reload the page
- ✓ Check that time entries have valid dates
- ✓ Test with different date range presets

### Supervisor Cannot Access Admin Features
- ✓ This is by design - supervisors cannot access Admin Dashboard
- ✓ Only admins can manage users, export data, and delete entries
- ✓ Upgrade user role to 'admin' if full access is needed
- ✓ Supervisors can enter time for others and view activity, but cannot perform admin operations

## 📊 Recent Updates & Fixes

### March 2026 (Latest)
- ✅ **Custom Chart Colors** - Per-user hex color codes for activity dashboard charts with visual editor
- ✅ **Native Color Picker** - Built-in color picker with hex input and live preview swatch
- ✅ **Bulk Color Assignment** - Auto-assign distinct colors to all users with one click
- ✅ **Audio Feedback System** - Error and success sounds for validation and form submissions
- ✅ **Grouped Navigation Menu** - Organized dropdown with Core/Tools/Admin sections and visual dividers
- ✅ **Chart Color Management** - Admin dashboard UI for setting and clearing user chart colors

### February 2026
- ✅ **Client-Facing Landing Page** - Professional homepage with hamburger menu and authentication state
- ✅ **Enhanced Invoice Management** - Markup controls, hourly rate overrides, and improved UX
- ✅ **Professional Estimate PDFs** - Client-ready PDF exports with proper formatting and address display
- ✅ **Supervisor Role System** - Three-tier role system with supervisor permissions and RLS policies
- ✅ **Hourly Rate Field** - Added rate field to profiles for labor cost calculations
- ✅ **Receipt Upload Fixes** - Resolved paths by fetching current user ID on component mount
- ✅ **Estimate Export Improvements** - Filtered blank rows when exporting to Excel
- ✅ **Safari Browser Compatibility** - Fixed Gantt chart date rendering and date parsing issues
- ✅ **Profile Picture Enhancements** - Improved UX for profile picture uploads and management
- ✅ **Activity Page Improvements** - Location filter syncing with date range and expenses modal
- ✅ **Multi-Select Filters** - Person filter for View Activity page

### January 2026
- ✅ **Project Planner with Gantt Chart** - Full project management system
- ✅ **Drag & Drop Scheduling** - Reschedule tasks by dragging
- ✅ **Work Type Tracking** - Classification for time entries
- ✅ **Enhanced RLS Policies** - Better admin access controls
- ✅ **Post-it Notes Feature** - Sticky-note brainstorming board with comments

## 🏗️ Architecture Notes

### Frontend Architecture
- **Component-Based**: Modular React components in `src/components/`
- **Type-Safe**: Full TypeScript coverage with strict mode
- **Responsive Design**: Mobile-first Tailwind CSS styling
- **Performance**: Code splitting and lazy loading with Vite

### Backend Architecture
- **Serverless**: Supabase Edge Functions for backend logic
- **Database-First**: PostgreSQL with RLS for security
- **Real-time**: Supabase Realtime subscriptions (extensible)
- **Storage**: Supabase Storage for file uploads

### Data Flow
```
React UI → Supabase Client → PostgreSQL/Storage
                ↓
            RLS Policies
                ↓
            Edge Functions (admin operations)
```

## 📦 Deployment

### Frontend Deployment (Vite Build)
```bash
npm run build
# Deploy the dist/ folder to your hosting:
# - Vercel: `vercel deploy`
# - Netlify: `netlify deploy --prod --dir=dist`
# - AWS S3: `aws s3 sync dist/ s3://your-bucket`
```

### Edge Functions Deployment (Supabase)
```bash
supabase functions deploy reset-user-password
# OR via Supabase Dashboard → Edge Functions → Deploy
```

### Environment Variables (Production)
Set these in your hosting platform:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## 🌐 Browser Support

- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ⚠️ IE 11 (not supported)

## 📁 Project Structure

```
├── public/
│   └── audio/                # Audio feedback files (MP3)
├── src/
│   ├── components/           # React components
│   │   ├── AdminPage.tsx     # Admin dashboard
│   │   ├── TimeEntriesPage.tsx
│   │   ├── ExpensePage.tsx
│   │   ├── PlannerPage.tsx
│   │   ├── CreateInvoicePage.tsx
│   │   ├── EstimateWorksheetPage.tsx
│   │   ├── ViewActivityPage.tsx
│   │   └── Dashboard.tsx     # Main dashboard
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client config
│   │   ├── colorUtils.ts     # Chart color utilities
│   │   └── useAudioFeedback.ts  # Audio feedback hook
│   ├── App.tsx               # Main app component
│   ├── main.tsx              # Entry point
│   └── index.css             # Global styles
├── supabase/
│   ├── migrations/           # Database migrations
│   └── functions/            # Edge Functions
│       └── reset-user-password/
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
├── eslint.config.js          # ESLint configuration
└── package.json              # Dependencies
```

## 🤝 Contributing

This is a private project. For questions or support, contact the repository owner.

## 📄 License

Private - All rights reserved

## 💬 Support

For issues or questions, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ using React, TypeScript, and Supabase**

Designed for small businesses and contractors who need simple, powerful time tracking and project management.

**Latest Version**: February 2026 | **Node**: 18+ | **React**: 18.3+
