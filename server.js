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
  getClaims,
  getClaimById,
  createClaim,
  updateClaimStatus,
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

// Middleware with payload limit to allow camera snapshots
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.json({ limit: '15mb' }));

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
  console.warn('Firestore bootstrap notice:', err.message);
});

// -----------------------------------------------------------------------------
// Firebase Auth API Endpoints
// -----------------------------------------------------------------------------
app.get('/api/firebase-config', (req, res) => {
  res.json(clientConfig);
});

// Establish session from client-side Firebase Auth (Google Sign-In)
app.post('/api/auth/firebase-session', async (req, res) => {
  try {
    let { uid, email, displayName, photoURL, role, credential } = req.body;

    // Handle Google Identity Services (GIS) JWT credential
    if (credential && (!email || !uid)) {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          uid = payload.sub || uid;
          email = payload.email || email;
          displayName = payload.name || displayName;
          photoURL = payload.picture || photoURL;
        }
      } catch (err) {
        console.warn('Could not parse Google JWT credential:', err.message);
      }
    }

    if (!uid && email) {
      uid = 'usr_' + email.replace(/[^a-zA-Z0-9]/g, '_');
    }

    if (!uid) {
      return res.status(400).json({ success: false, message: 'Missing user identification' });
    }

    // Determine role (default bootstrapped admin or requested admin)
    const isAdmin =
      role === 'ADMIN' ||
      email === 'alokinfo30@gmail.com' ||
      (email && email.toLowerCase().includes('admin'));

    const determinedRole = isAdmin ? 'ADMIN' : 'CUSTOMER';

    const names = (displayName || '').split(' ');
    const firstName = names[0] || (determinedRole === 'ADMIN' ? 'Admin' : 'Customer');
    const lastName = names.slice(1).join(' ') || '';

    const savedProfile = await saveUser({
      uid,
      email: email || `${uid}@example.com`,
      role: determinedRole,
      first_name: firstName,
      last_name: lastName,
      profile_pic: photoURL || '/static/image/avatar-default.svg'
    });

    req.session.user = {
      id: uid,
      uid,
      customerId: uid,
      username: email || displayName || uid,
      first_name: savedProfile.first_name,
      last_name: savedProfile.last_name,
      email: savedProfile.email,
      role: determinedRole,
      profile_pic: savedProfile.profile_pic || '/static/image/avatar-default.svg'
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
  res.redirect('/static/image/avatar-default.svg');
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
      role: 'ADMIN',
      profile_pic: '/static/image/admin.png'
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
  
  if (username === 'customer' && password === 'customer') {
    const existing = await getUserById('cust_default');
    req.session.user = {
      id: 'cust_default',
      uid: 'cust_default',
      customerId: 'cust_default',
      username: 'customer',
      first_name: existing ? existing.first_name : 'Dinara',
      last_name: existing ? existing.last_name : 'Kurbanova',
      email: 'customer@insurance.local',
      role: 'CUSTOMER',
      profile_pic: existing ? existing.profile_pic : '/static/image/avatar-default.svg'
    };
    return res.redirect('/customer/customer-dashboard');
  }

  // Check persistent customers
  const customers = await getCustomers();
  const found = customers.find(c => c.username === username || c.email === username);
  if (found) {
    req.session.user = {
      id: found.id || found.uid,
      uid: found.uid || found.id,
      customerId: found.id || found.uid,
      username: found.username || found.email,
      first_name: found.first_name,
      last_name: found.last_name || '',
      email: found.email,
      role: 'CUSTOMER',
      profile_pic: found.profile_pic || '/static/image/avatar-default.svg'
    };
    return res.redirect('/customer/customer-dashboard');
  }

  res.render('customer/customerlogin', {
    error: 'Account not found. Sign in with Google (Firebase Auth) or create an account.'
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
      username: username || 'customer',
      email: `${username}@insurance.local`,
      role: 'CUSTOMER',
      first_name: first_name || username,
      last_name: last_name || '',
      mobile: mobile || '',
      address: address || '',
      profile_pic: profile_pic || '/static/image/avatar-default.svg'
    });

    res.redirect('/customer/customerlogin');
  } catch (err) {
    console.error('Customer signup notice:', err.message);
    res.redirect('/customer/customerlogin');
  }
});

// -----------------------------------------------------------------------------
// Admin Portal Routes
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
      customers,
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
    profile_pic: profile_pic || '/static/image/avatar-default.svg'
  });
  res.redirect('/admin-view-customer');
});

app.get('/delete-customer/:id', requireAdmin, async (req, res) => {
  await deleteUser(req.params.id);
  res.redirect('/admin-view-customer');
});

// Category management (Guarded against function crashes)
app.get('/admin-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_category');
});

app.get('/admin-add-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_add_category');
});

app.post('/admin-add-category', requireAdmin, async (req, res) => {
  try {
    const { category_name } = req.body;
    if (category_name) {
      await addCategory(category_name);
    }
  } catch (err) {
    console.error('Error adding category:', err.message);
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
  try {
    if (req.body.category_name) {
      await updateCategory(req.params.id, req.body.category_name);
    }
  } catch (err) {
    console.error('Error updating category:', err.message);
  }
  res.redirect('/admin-update-category');
});

app.get('/admin-delete-category', requireAdmin, async (req, res) => {
  const categories = await getCategories();
  res.render('insurance/admin_delete_category', { categories });
});

app.get('/delete-category/:id', requireAdmin, async (req, res) => {
  try {
    await deleteCategory(req.params.id);
  } catch (err) {
    console.error('Error deleting category:', err.message);
  }
  res.redirect('/admin-delete-category');
});

// Policy management (Guarded against function crashes)
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
  try {
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
  } catch (err) {
    console.error('Error adding policy:', err.message);
  }
  res.redirect('/admin-view-policy');
});

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
  try {
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
  } catch (err) {
    console.error('Error updating policy:', err.message);
  }
  res.redirect('/admin-view-policy');
});

app.get('/admin-delete-policy', requireAdmin, async (req, res) => {
  const policies = await getPolicies();
  res.render('insurance/admin_delete_policy', { policies });
});

app.get('/delete-policy/:id', requireAdmin, async (req, res) => {
  try {
    await deletePolicy(req.params.id);
  } catch (err) {
    console.error('Error deleting policy:', err.message);
  }
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

// Admin Question management
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
// Customer Portal Routes
// -----------------------------------------------------------------------------
app.get('/customer/customer-dashboard', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  
  // Refresh customer profile from storage to ensure current profile picture is loaded
  const freshUser = await getUserById(customerId);
  if (freshUser) {
    req.session.user.profile_pic = freshUser.profile_pic || req.session.user.profile_pic;
    req.session.user.first_name = freshUser.first_name || req.session.user.first_name;
  }

  const policies = await getPolicies();
  const categories = await getCategories();
  const customerRecords = await getPolicyRecordsByCustomer(customerId);
  const customerQuestions = await getQuestions(customerId);
  const customerClaims = await getClaims(customerId);

  res.render('customer/customer_dashboard', {
    customer: { ...req.session.user, ...(freshUser || {}) },
    available_policy: policies.length,
    applied_policy: customerRecords.length,
    total_category: categories.length,
    total_question: customerQuestions.length,
    total_claims: customerClaims.length
  });
});

// Customer View Policy Categories made by Admin
app.get('/customer/categories', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const freshUser = await getUserById(customerId);
  const categories = await getCategories();
  const policies = await getPolicies();

  res.render('customer/customer_categories', {
    customer: { ...req.session.user, ...(freshUser || {}) },
    categories,
    policies
  });
});

// Customer Claims Portal (Submit and Track Insurance Claims)
app.get('/customer/claims', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const freshUser = await getUserById(customerId);
  const claims = await getClaims(customerId);
  const policies = await getPolicies();

  res.render('customer/customer_claims', {
    customer: { ...req.session.user, ...(freshUser || {}) },
    claims,
    policies,
    successMessage: req.query.msg || null
  });
});

app.post('/customer/submit-claim', requireCustomer, async (req, res) => {
  try {
    const customerId = req.session.user.id || req.session.user.customerId;
    const { policy_id, claim_amount, incident_date, reason, supporting_details } = req.body;
    const policy = await getPolicyById(policy_id);

    await createClaim({
      customer_id: customerId,
      customer_name: `${req.session.user.first_name || ''} ${req.session.user.last_name || ''}`.trim() || req.session.user.username,
      customer_email: req.session.user.email || '',
      policy_id: policy_id || 'pol_general',
      policy_name: policy ? policy.policy_name : 'General Insurance Policy',
      claim_amount: Number(claim_amount) || 0,
      incident_date,
      reason,
      supporting_details
    });
  } catch (err) {
    console.error('Error submitting claim:', err.message);
  }
  res.redirect('/customer/claims?msg=Your insurance claim has been submitted to Firestore and is under review.');
});

// Customer Profile Section with Device Camera
app.get('/customer/profile', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const freshUser = await getUserById(customerId);

  res.render('customer/customer_profile', {
    customer: { ...req.session.user, ...(freshUser || {}) },
    successMessage: req.query.msg || null
  });
});

app.post('/customer/update-profile-pic', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const { profile_pic } = req.body;
  if (profile_pic) {
    await updateUser(customerId, { profile_pic });
    req.session.user.profile_pic = profile_pic;
  }
  res.redirect('/customer/profile?msg=Profile picture updated successfully via camera.');
});

app.post('/customer/update-profile', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const { first_name, last_name, mobile, address } = req.body;
  await updateUser(customerId, { first_name, last_name, mobile, address });
  req.session.user.first_name = first_name;
  req.session.user.last_name = last_name;
  res.redirect('/customer/profile?msg=Profile details updated successfully.');
});

// Customer Policies (Card Dashboard)
app.get('/customer/apply-policy', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const freshUser = await getUserById(customerId);
  const policies = await getPolicies();
  res.render('customer/apply_policy', {
    customer: { ...req.session.user, ...(freshUser || {}) },
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
  const freshUser = await getUserById(customerId);
  const records = await getPolicyRecordsByCustomer(customerId);
  res.render('customer/history', {
    customer: { ...req.session.user, ...(freshUser || {}) },
    policies: records
  });
});

app.get('/customer/ask-question', requireCustomer, async (req, res) => {
  const customerId = req.session.user.id || req.session.user.customerId;
  const freshUser = await getUserById(customerId);
  res.render('customer/ask_question', {
    customer: { ...req.session.user, ...(freshUser || {}) }
  });
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
  const freshUser = await getUserById(customerId);
  const questions = await getQuestions(customerId);
  res.render('customer/question_history', {
    customer: { ...req.session.user, ...(freshUser || {}) },
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
