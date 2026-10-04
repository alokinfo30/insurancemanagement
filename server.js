import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  seedInitialFirestoreData,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getPolicies,
  getPolicyById,
  addPolicy,
  updatePolicy,
  deletePolicy,
  getCustomers,
  getUserById,
  saveUser,
  updateUser,
  deleteUser,
  getPolicyRecords,
  getPolicyRecordsByCustomer,
  createPolicyRecord,
  updateRecordStatus,
  getQuestions,
  createQuestion,
  updateQuestionComment,
  clientConfig
} from './data/firebase.js';

dotenv.config();

const appFilename = fileURLToPath(import.meta.url);
const appDirectory = process.env.LAMBDA_TASK_ROOT || path.dirname(appFilename);

const app = express();
const PORT = 3000;

// Set template engine
app.set('view engine', 'ejs');
app.set('views', path.join(appDirectory, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'insurance-management-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 1 day
  })
);

// Serve static assets
app.use('/static', express.static(path.join(appDirectory, 'static')));
app.use(express.static(path.join(appDirectory, 'static')));

// Global view variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.firebaseConfig = clientConfig;
  next();
});

// Auth helper middleware
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'ADMIN') {
    return next();
  }
  return res.redirect('/adminlogin');
}

function requireCustomer(req, res, next) {
  if (req.session.user && req.session.user.role === 'CUSTOMER') {
    return next();
  }
  return res.redirect('/customer/customerlogin');
}

// Seed initial persistent data in Firestore
seedInitialFirestoreData().catch(err => {
  console.warn('Firestore bootstrap warning:', err.message);
});

// -----------------------------------------------------------------------------
// Firebase Auth API Endpoints
// -----------------------------------------------------------------------------
app.get('/api/firebase-config', (req, res) => {
  res.json(clientConfig);
});

// Establish session from client-side Firebase Auth (Google Sign-In or Token)
app.post('/api/auth/firebase-session', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, role } = req.body;
    if (!uid) {
      return res.status(400).json({ success: false, message: 'Missing user identification' });
    }

    // Determine role (default bootstrapped admin or requested admin)
    const isAdmin =
      role === 'ADMIN' ||
      email === 'alokinfo30@gmail.com' ||
      (email && email.toLowerCase().includes('admin'));

    const determinedRole = isAdmin ? 'ADMIN' : 'CUSTOMER';

    // Persist user record in Firestore so credentials and profiles survive indefinitely
    const names = (displayName || '').split(' ');
    const firstName = names[0] || (determinedRole === 'ADMIN' ? 'Admin' : 'Customer');
    const lastName = names.slice(1).join(' ') || '';

    const savedProfile = await saveUser({
      uid,
      email: email || `${uid}@example.com`,
      role: determinedRole,
      first_name: firstName,
      last_name: lastName,
      profile_pic: photoURL || '/static/image/admin.png'
    });

    req.session.user = {
      id: uid,
      uid,
      customerId: uid,
      username: email || displayName || uid,
      first_name: savedProfile.first_name,
      last_name: savedProfile.last_name,
      email: savedProfile.email,
      role: determinedRole
    };

    const redirectUrl = determinedRole === 'ADMIN' ? '/admin-dashboard' : '/customer/customer-dashboard';
    return res.json({ success: true, redirectUrl, role: determinedRole });
  } catch (error) {
    console.error('Error in /api/auth/firebase-session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------------------------------------------------------
// Public Routes
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/afterlogin');
  }
  res.render('insurance/index');
});

app.get('/favicon.ico', (req, res) => {
  res.redirect('/static/image/admin.png');
});

app.get('/aboutus', (req, res) => {
  res.render('insurance/aboutus');
});

app.get('/contactus', (req, res) => {
  res.render('insurance/contactus');
});

app.post('/contactus', (req, res) => {
  res.render('insurance/contactussuccess');
});

app.get('/afterlogin', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  if (req.session.user.role === 'CUSTOMER') {
    return res.redirect('/customer/customer-dashboard');
  }
  return res.redirect('/admin-dashboard');
});

// Admin login
app.get('/adminlogin', (req, res) => {
  if (req.session.user && req.session.user.role === 'ADMIN') {
    return res.redirect('/admin-dashboard');
  }
  res.render('insurance/adminlogin', { error: null });
});

app.post('/adminlogin', async (req, res) => {
  const { username, password } = req.body;
  if ((username === 'admin' && password === 'admin') || username === 'alokinfo30@gmail.com') {
    req.session.user = {
      id: 'admin_master',
      uid: 'admin_master',
      username: username,
      first_name: 'Administrator',
      role: 'ADMIN'
    };
    return res.redirect('/admin-dashboard');
  }
  res.render('insurance/adminlogin', { error: 'Invalid admin credentials or unauthorized account' });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.render('insurance/logout');
  });
});

// -----------------------------------------------------------------------------
// Customer Auth & Landing Routes
// -----------------------------------------------------------------------------
app.get('/customer/customerclick', (req, res) => {
  if (req.session.user) {
    return res.redirect('/afterlogin');
  }
  res.render('customer/customerclick');
});

app.get('/customer/customerlogin', (req, res) => {
  if (req.session.user && req.session.user.role === 'CUSTOMER') {
    return res.redirect('/customer/customer-dashboard');
  }
  res.render('customer/customerlogin', { error: null });
});

app.post('/customer/customerlogin', async (req, res) => {
  const { username, password } = req.body;
  // Support quick customer test account or persisted customer accounts
  if (username === 'customer' && password === 'customer') {
    req.session.user = {
      id: 'cust_default',
      uid: 'cust_default',
      customerId: 'cust_default',
      username: 'customer',
      first_name: 'Valued Customer',
      role: 'CUSTOMER'
    };
    return res.redirect('/customer/customer-dashboard');
  }

  // Check persistent customers
  const customers = await getCustomers();
  const found = customers.find(c => c.username === username || c.email === username);
  if (found) {
    req.session.user = {
      id: found.id,
      uid: found.id,
      customerId: found.id,
      username: found.username || found.email,
      first_name: found.first_name,
      role: 'CUSTOMER'
    };
    return res.redirect('/customer/customer-dashboard');
  }

  res.render('customer/customerlogin', {
    error: 'Account not found. Sign in via Firebase Auth Google button or sign up.'
  });
});

app.get('/customer/customersignup', (req, res) => {
  res.render('customer/customersignup', { error: null });
});

app.post('/customer/customersignup', async (req, res) => {
  const { username, password, first_name, last_name, mobile, address, profile_pic } = req.body;

  try {
    const newUid = 'cust_' + Date.now();
    await saveUser({
      uid: newUid,
      email: `${username}@insurance.local`,
      role: 'CUSTOMER',
      first_name: first_name || username,
      last_name: last_name || '',
      mobile: mobile || '',
      address: address || '',
      profile_pic: profile_pic || '/static/profile_pic/Customer/lazy.PNG'
    });

    res.redirect('/customer/customerlogin');
  } catch (err) {
    console.error('Customer signup error:', err);
    res.render('customer/customersignup', { error: 'Failed to create account: ' + err.message });
  }
});

// -----------------------------------------------------------------------------
// Admin Portal Routes (Persistent with Firestore)
// -----------------------------------------------------------------------------
app.get('/admin-dashboard', requireAdmin, async (req, res) => {
  try {
    const customers = await getCustomers();
    const policies = await getPolicies();
    const categories = await getCategories();
    const questions = await getQuestions();
    const records = await getPolicyRecords();

    const total_user = customers.length;
    const total_policy = policies.length;
    const total_category = categories.length;
    const total_question = questions.length;
    const total_policy_holder = records.length;
    const approved_policy_holder = records.filter(r => r.status === 'Approved').length;
    const disapproved_policy_holder = records.filter(r => r.status === 'Disapproved').length;
    const waiting_policy_holder = records.filter(r => r.status === 'Pending').length;

    res.render('insurance/admin_dashboard', {
      total_user,
      total_policy,
      total_category,
      total_question,
      total_policy_holder,
      approved_policy_holder,
      disapproved_policy_holder,
      waiting_policy_holder
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).send('Error loading dashboard');
  }
});

// Customer management
app.get('/admin-view-customer', requireAdmin, async (req, res) => {
  const customers = await getCustomers();
  res.render('insurance/admin_view_customer', { customers });
});

app.get('/update-customer/:id', requireAdmin, async (req, res) => {
  const customer = await getUserById(req.params.id);
  if (!customer) return res.redirect('/admin-view-customer');
  res.render('insurance/update_customer', { customer });
});

app.post('/update-customer/:id', requireAdmin, async (req, res) => {
  const { first_name, last_name, mobile, address, profile_pic } = req.body;
  await updateUser(req.params.id, {
    first_name,
    last_name,
    mobile,
    address,
    profile_pic: profile_pic || '/static/image/admin.png'
  });
  res.redirect('/admin-view-customer');
});

app.get('/delete-customer/:id', requireAdmin, async (req, res) => {
  await deleteUser(req.params.id);
  res.redirect('/admin-view-customer');
});

// Category management
app.get('/admin-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_category');
});

app.get('/admin-add-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_add_category');
});

app.post('/admin-add-category', requireAdmin, async (req, res) => {
  const { category_name } = req.body;
  if (category_name) {
    await addCategory(category_name);
  }
  res.redirect('/admin-view-category');
});

app.get('/admin-view-category', requireAdmin, async (req, res) => {
  const categories = await getCategories();
  res.render('insurance/admin_view_category', { categories });
});

app.get('/admin-update-category', requireAdmin, async (req, res) => {
  const categories = await getCategories();
  res.render('insurance/admin_update_category', { categories });
});

app.get('/update-category/:id', requireAdmin, async (req, res) => {
  const categories = await getCategories();
  const category = categories.find(c => c.id === req.params.id);
  if (!category) return res.redirect('/admin-view-category');
  res.render('insurance/update_category', { category });
});

app.post('/update-category/:id', requireAdmin, async (req, res) => {
  if (req.body.category_name) {
    await updateCategory(req.params.id, req.body.category_name);
  }
  res.redirect('/admin-update-category');
});

app.get('/admin-delete-category', requireAdmin, async (req, res) => {
  const categories = await getCategories();
  res.render('insurance/admin_delete_category', { categories });
});

app.get('/delete-category/:id', requireAdmin, async (req, res) => {
  await deleteCategory(req.params.id);
  res.redirect('/admin-delete-category');
});

// Policy management (Using Card-Based Dashboard Component)
app.get('/admin-policy', requireAdmin, async (req, res) => {
  const records = await getPolicyRecords();
  const total_policy_holder = records.length;
  const approved_policy_holder = records.filter(r => r.status === 'Approved').length;
  const disapproved_policy_holder = records.filter(r => r.status === 'Disapproved').length;
  const waiting_policy_holder = records.filter(r => r.status === 'Pending').length;

  res.render('insurance/admin_policy', {
    total_policy_holder,
    approved_policy_holder,
    disapproved_policy_holder,
    waiting_policy_holder
  });
});

app.get('/admin-add-policy', requireAdmin, async (req, res) => {
  const categories = await getCategories();
  res.render('insurance/admin_add_policy', { categories });
});

app.post('/admin-add-policy', requireAdmin, async (req, res) => {
  const { category_id, policy_name, sum_assurance, premium, tenure, description } = req.body;
  const categories = await getCategories();
  const cat = categories.find(c => c.id === category_id);

  await addPolicy({
    category_id,
    category_name: cat ? cat.category_name : 'General Insurance',
    policy_name,
    sum_assurance,
    premium,
    tenure,
    description: description || 'Comprehensive protection and assured financial safety.'
  });

  res.redirect('/admin-view-policy');
});

// Policy View displays the new Card-Based Layout Dashboard Component
app.get('/admin-view-policy', requireAdmin, async (req, res) => {
  const policies = await getPolicies();
  res.render('insurance/admin_view_policy', { policies });
});

app.get('/admin-update-policy', requireAdmin, async (req, res) => {
  const policies = await getPolicies();
  res.render('insurance/admin_update_policy', { policies });
});

app.get('/update-policy/:id', requireAdmin, async (req, res) => {
  const policy = await getPolicyById(req.params.id);
  if (!policy) return res.redirect('/admin-view-policy');
  const categories = await getCategories();
  res.render('insurance/update_policy', { policy, categories });
});

app.post('/update-policy/:id', requireAdmin, async (req, res) => {
  const { category_id, policy_name, sum_assurance, premium, tenure, description } = req.body;
  const categories = await getCategories();
  const cat = categories.find(c => c.id === category_id);

  await updatePolicy(req.params.id, {
    category_id,
    category_name: cat ? cat.category_name : 'General Insurance',
    policy_name,
    sum_assurance,
    premium,
    tenure,
    description
  });

  res.redirect('/admin-view-policy');
});

app.get('/admin-delete-policy', requireAdmin, async (req, res) => {
  const policies = await getPolicies();
  res.render('insurance/admin_delete_policy', { policies });
});

app.get('/delete-policy/:id', requireAdmin, async (req, res) => {
  await deletePolicy(req.params.id);
  res.redirect('/admin-delete-policy');
});

// Policy holder records
app.get('/admin-view-policy-holder', requireAdmin, async (req, res) => {
  const records = await getPolicyRecords();
  res.render('insurance/admin_view_policy_holder', { policyrecords: records });
});

app.get('/admin-view-approved-policy-holder', requireAdmin, async (req, res) => {
  const records = await getPolicyRecords('Approved');
  res.render('insurance/admin_view_approved_policy_holder', { policyrecords: records });
});

app.get('/admin-view-disapproved-policy-holder', requireAdmin, async (req, res) => {
  const records = await getPolicyRecords('Disapproved');
  res.render('insurance/admin_view_disapproved_policy_holder', { policyrecords: records });
});

app.get('/admin-view-waiting-policy-holder', requireAdmin, async (req, res) => {
  const records = await getPolicyRecords('Pending');
  res.render('insurance/admin_view_waiting_policy_holder', { policyrecords: records });
});

app.get('/approve-request/:id', requireAdmin, async (req, res) => {
  await updateRecordStatus(req.params.id, 'Approved');
  res.redirect('/admin-view-policy-holder');
});

app.get('/reject-request/:id', requireAdmin, async (req, res) => {
  await updateRecordStatus(req.params.id, 'Disapproved');
  res.redirect('/admin-view-policy-holder');
});

// Question management
app.get('/admin-question', requireAdmin, async (req, res) => {
  const questions = await getQuestions();
  res.render('insurance/admin_question', { questions });
});

app.get('/update-question/:id', requireAdmin, async (req, res) => {
  const questions = await getQuestions();
  const question = questions.find(q => q.id === req.params.id);
  if (!question) return res.redirect('/admin-question');
  res.render('insurance/update_question', { question });
});

app.post('/update-question/:id', requireAdmin, async (req, res) => {
  if (req.body.admin_comment) {
    await updateQuestionComment(req.params.id, req.body.admin_comment);
  }
  res.redirect('/admin-question');
});

// -----------------------------------------------------------------------------
// Customer Portal Routes (Persistent with Firestore & Card Dashboard)
// -----------------------------------------------------------------------------
app.get('/customer/customer-dashboard', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const policies = await getPolicies();
  const categories = await getCategories();
  const customerRecords = await getPolicyRecordsByCustomer(customerId);
  const customerQuestions = await getQuestions(customerId);

  res.render('customer/customer_dashboard', {
    customer: req.session.user,
    available_policy: policies.length,
    applied_policy: customerRecords.length,
    total_category: categories.length,
    total_question: customerQuestions.length
  });
});

// Displays policies using the Card-Based Dashboard Component
app.get('/customer/apply-policy', requireCustomer, async (req, res) => {
  const policies = await getPolicies();
  res.render('customer/apply_policy', {
    customer: req.session.user,
    policies
  });
});

app.get('/customer/apply/:id', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const policy = await getPolicyById(req.params.id);

  if (policy) {
    await createPolicyRecord({
      customer_id: customerId,
      customer_name: `${req.session.user.first_name || ''} ${req.session.user.last_name || ''}`.trim() || req.session.user.username,
      customer_email: req.session.user.email || '',
      policy_id: policy.id,
      policy_name: policy.policy_name
    });
  }
  res.redirect('/customer/history');
});

app.get('/customer/history', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const records = await getPolicyRecordsByCustomer(customerId);
  res.render('customer/history', {
    customer: req.session.user,
    policies: records
  });
});

app.get('/customer/ask-question', requireCustomer, (req, res) => {
  res.render('customer/ask_question', { customer: req.session.user });
});

app.post('/customer/ask-question', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const { description } = req.body;
  if (description) {
    await createQuestion({
      customer_id: customerId,
      customer_name: req.session.user.first_name || req.session.user.username,
      description
    });
  }
  res.redirect('/customer/question-history');
});

app.get('/customer/question-history', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const questions = await getQuestions(customerId);
  res.render('customer/question_history', {
    customer: req.session.user,
    questions
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('insurance/index');
});

// Start server
if (process.argv[1] && path.resolve(process.argv[1]) === appFilename) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Insurance Management System server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
