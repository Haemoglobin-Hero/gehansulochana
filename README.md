# SCIENCE//CLASS — HTML + CSS + JavaScript + Supabase

A modern, neon-green/black science tuition website with separate Home, Classes, About, Contact and Student Login pages, plus a protected student dashboard and optional teacher admin dashboard.

## 1. What is included
- Responsive modern UI with animations and neon green accents.
- Teacher photo already included at `assets/teacher.jpg`.
- Grades 6–11 Theory Classes.
- Rapid Revision 2026.
- Payment modal/form with student name, Student ID, month, fee and payment-slip upload.
- Supabase PostgreSQL database for students, access permissions, resources, Zoom details and payments.
- Supabase Storage for payment slips.
- Student login using Student ID + password (internally mapped to a Supabase Auth email).
- Student dashboard that only shows assigned classes/resources.
- Optional teacher admin dashboard.
- WhatsApp registration/contact using +94 77 634 5162.

## 2. Supabase setup
1. Create a free Supabase project.
2. Open **SQL Editor**.
3. Paste and run everything from `sql/schema.sql`.
4. In **Authentication → Providers → Email**, enable Email/Password.
5. For this simple Student-ID login system, turn OFF email confirmation so teacher-created student accounts can log in immediately.
6. Open **Project Settings → API** and copy the Project URL and the publishable/anon key.
7. Put those two values in `js/config.js`.
8. NEVER put the Supabase service-role/secret key in `config.js` or any browser file.

## 3. Creating a student
Because the website deliberately has no public registration form, the teacher controls account creation.

### Create the authentication account
In Supabase → Authentication → Users → Add user, create:
- Email: `gs3399@students.scienceclass.app`
- Password: a temporary/initial password you give the student

The website converts `GS3399` to that internal email automatically.

### Add the student profile
Copy the new Auth user's UUID and run:

```sql
INSERT INTO public.students(user_id, student_id, full_name)
VALUES ('AUTH-USER-UUID', 'GS3399', 'Pevin Dewnuka');
```

### Give class access
```sql
INSERT INTO public.student_access(student_id, class_name)
VALUES
('GS3399', 'Grade 11'),
('GS3399', 'Rapid Revision 2026');
```

That means GS3399 can see Grade 11 and Rapid Revision resources only.

## 4. Add recordings/materials
Use the `resources` table. Each resource has:
- `class_name` — e.g. Grade 11
- `title`
- `description`
- `type` — recording, material, paper or link
- `url` — Google Drive, YouTube unlisted, your LMS, etc.

Example:

```sql
INSERT INTO public.resources(class_name,title,description,type,url)
VALUES
('Grade 11','Lesson 01 Recording','Full Zoom recording','recording','https://example.com/recording'),
('Grade 11','Unit 01 Notes','PDF notes','material','https://example.com/notes');
```

## 5. Add Zoom details
```sql
INSERT INTO public.zoom_details(class_name,title,meeting_id,password,join_url)
VALUES
('Grade 11','Weekly Theory Class','123 456 789','science11','https://zoom.us/j/123456789');
```

Students assigned to Grade 11 will see those details in their dashboard.

## 6. Fees
The front-end currently has example monthly fees in `js/app.js`:
- Grade 6 — LKR 2,500
- Grade 7 — LKR 2,500
- Grade 8 — LKR 2,750
- Grade 9 — LKR 3,000
- Grade 10 — LKR 3,500
- Grade 11 — LKR 4,000
- Rapid Revision 2026 — LKR 3,500

Change these numbers in `classData` before publishing.

## 7. Payment slips
The SQL creates a private Supabase Storage bucket named `payment-slips`. The payment form uploads the slip and then inserts the payment record into `payments`.

For production, tighten the storage INSERT policy so uploads are tied to a known student/session rather than accepting anonymous uploads.

## 8. Run locally
You can use VS Code + Live Server, or any static web server.

Example with Python:

```bash
cd science-tuition-website
python -m http.server 5500
```

Then open `http://localhost:5500`.

Do not open the HTML with `file://` because browser modules/API requests and Supabase authentication work better through a local server.

## 9. Deploy
This project is static and works well on Vercel, Netlify or GitHub Pages. Upload the entire folder and set the same Supabase values in `js/config.js` before deployment.

## 10. Important security note
Never add a Supabase service-role/secret key to browser JavaScript. Use only the publishable/anon key. RLS policies protect the database. For a real production deployment, add an Edge Function for teacher-only account creation and server-side payment-slip verification.
