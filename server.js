import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  db,
  getCategoryById,
  getPolicyById,
  getCustomerByUserId,
  getCustomerById,
  getFormattedRecords,
  getFormattedQuestions
} from './data/store.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Set template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.static(path.join(__dirname, 'static')));

// Global view variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
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

app.post('/adminlogin', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(
    u => u.username === username && u.password === password && u.role === 'ADMIN'
  );
  if (user) {
    req.session.user = {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      role: 'ADMIN'
    };
    return res.redirect('/admin-dashboard');
  }
  res.render('insurance/adminlogin', { error: 'Invalid admin username or password' });
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

app.post('/customer/customerlogin', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(
    u => u.username === username && u.password === password && u.role === 'CUSTOMER'
  );
  if (user) {
    const customer = getCustomerByUserId(user.id);
    req.session.user = {
      id: user.id,
      customerId: customer ? customer.id : null,
      username: user.username,
      first_name: user.first_name,
      role: 'CUSTOMER'
    };
    return res.redirect('/customer/customer-dashboard');
  }
  res.render('customer/customerlogin', {
    error: 'Only registered customer accounts can log in here.'
  });
});

app.get('/customer/customersignup', (req, res) => {
  res.render('customer/customersignup', { error: null });
});

app.post('/customer/customersignup', (req, res) => {
  const { username, password, first_name, last_name, mobile, address, profile_pic } = req.body;

  if (db.users.find(u => u.username === username)) {
    return res.render('customer/customersignup', {
      error: 'Username already taken, please choose another.'
    });
  }

  const newUserId = db.nextUserId++;
  const newUser = {
    id: newUserId,
    username,
    password,
    first_name,
    last_name,
    role: 'CUSTOMER'
  };
  db.users.push(newUser);

  const newCustomerId = db.nextCustomerId++;
  const newCustomer = {
    id: newCustomerId,
    user_id: newUserId,
    username,
    first_name,
    last_name,
    mobile: mobile || '',
    address: address || '',
    profile_pic: profile_pic || '/static/profile_pic/Customer/lazy.PNG'
  };
  db.customers.push(newCustomer);

  res.redirect('/customer/customerlogin');
});

// -----------------------------------------------------------------------------
// Admin Portal Routes
// -----------------------------------------------------------------------------
app.get('/admin-dashboard', requireAdmin, (req, res) => {
  const total_user = db.customers.length;
  const total_policy = db.policies.length;
  const total_category = db.categories.length;
  const total_question = db.questions.length;
  const total_policy_holder = db.policyRecords.length;
  const approved_policy_holder = db.policyRecords.filter(r => r.status === 'Approved').length;
  const disapproved_policy_holder = db.policyRecords.filter(r => r.status === 'Disapproved').length;
  const waiting_policy_holder = db.policyRecords.filter(r => r.status === 'Pending').length;

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
});

// Customer management
app.get('/admin-view-customer', requireAdmin, (req, res) => {
  res.render('insurance/admin_view_customer', { customers: db.customers });
});

app.get('/update-customer/:id', requireAdmin, (req, res) => {
  const customer = getCustomerById(req.params.id);
  if (!customer) return res.redirect('/admin-view-customer');
  res.render('insurance/update_customer', { customer });
});

app.post('/update-customer/:id', requireAdmin, (req, res) => {
  const customer = getCustomerById(req.params.id);
  if (customer) {
    const { first_name, last_name, mobile, address, username, password, profile_pic } = req.body;
    customer.first_name = first_name || customer.first_name;
    customer.last_name = last_name || customer.last_name;
    customer.mobile = mobile || customer.mobile;
    customer.address = address || customer.address;
    customer.username = username || customer.username;
    if (profile_pic) customer.profile_pic = profile_pic;

    const user = db.users.find(u => u.id === customer.user_id);
    if (user) {
      user.first_name = customer.first_name;
      user.last_name = customer.last_name;
      user.username = customer.username;
      if (password && password.trim()) user.password = password;
    }
  }
  res.redirect('/admin-view-customer');
});

app.get('/delete-customer/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const custIndex = db.customers.findIndex(c => c.id === id);
  if (custIndex !== -1) {
    const userId = db.customers[custIndex].user_id;
    db.customers.splice(custIndex, 1);
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) db.users.splice(userIndex, 1);
    db.policyRecords = db.policyRecords.filter(r => r.customer_id !== id);
    db.questions = db.questions.filter(q => q.customer_id !== id);
  }
  res.redirect('/admin-view-customer');
});

// Category management
app.get('/admin-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_category');
});

app.get('/admin-add-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_add_category');
});

app.post('/admin-add-category', requireAdmin, (req, res) => {
  const { category_name } = req.body;
  if (category_name) {
    const today = new Date().toISOString().split('T')[0];
    db.categories.push({
      id: db.nextCategoryId++,
      category_name,
      creation_date: today
    });
  }
  res.redirect('/admin-view-category');
});

app.get('/admin-view-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_view_category', { categories: db.categories });
});

app.get('/admin-update-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_update_category', { categories: db.categories });
});

app.get('/update-category/:id', requireAdmin, (req, res) => {
  const category = getCategoryById(req.params.id);
  if (!category) return res.redirect('/admin-view-category');
  res.render('insurance/update_category', { category });
});

app.post('/update-category/:id', requireAdmin, (req, res) => {
  const category = getCategoryById(req.params.id);
  if (category && req.body.category_name) {
    category.category_name = req.body.category_name;
    // update category_name on existing policies
    db.policies.forEach(p => {
      if (p.category_id === category.id) {
        p.category_name = category.category_name;
      }
    });
  }
  res.redirect('/admin-update-category');
});

app.get('/admin-delete-category', requireAdmin, (req, res) => {
  res.render('insurance/admin_delete_category', { categories: db.categories });
});

app.get('/delete-category/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.categories = db.categories.filter(c => c.id !== id);
  db.policies = db.policies.filter(p => p.category_id !== id);
  res.redirect('/admin-delete-category');
});

// Policy management
app.get('/admin-policy', requireAdmin, (req, res) => {
  const total_policy_holder = db.policyRecords.length;
  const approved_policy_holder = db.policyRecords.filter(r => r.status === 'Approved').length;
  const disapproved_policy_holder = db.policyRecords.filter(r => r.status === 'Disapproved').length;
  const waiting_policy_holder = db.policyRecords.filter(r => r.status === 'Pending').length;

  res.render('insurance/admin_policy', {
    total_policy_holder,
    approved_policy_holder,
    disapproved_policy_holder,
    waiting_policy_holder
  });
});

app.get('/admin-add-policy', requireAdmin, (req, res) => {
  res.render('insurance/admin_add_policy', { categories: db.categories });
});

app.post('/admin-add-policy', requireAdmin, (req, res) => {
  const { category_id, policy_name, sum_assurance, premium, tenure } = req.body;
  const cat = getCategoryById(category_id);
  const today = new Date().toISOString().split('T')[0];
  db.policies.push({
    id: db.nextPolicyId++,
    category_id: parseInt(category_id),
    category_name: cat ? cat.category_name : 'General',
    policy_name,
    sum_assurance: parseInt(sum_assurance) || 0,
    premium: parseInt(premium) || 0,
    tenure: parseInt(tenure) || 1,
    creation_date: today
  });
  res.redirect('/admin-view-policy');
});

app.get('/admin-view-policy', requireAdmin, (req, res) => {
  res.render('insurance/admin_view_policy', { policies: db.policies });
});

app.get('/admin-update-policy', requireAdmin, (req, res) => {
  res.render('insurance/admin_update_policy', { policies: db.policies });
});

app.get('/update-policy/:id', requireAdmin, (req, res) => {
  const policy = getPolicyById(req.params.id);
  if (!policy) return res.redirect('/admin-view-policy');
  res.render('insurance/update_policy', { policy, categories: db.categories });
});

app.post('/update-policy/:id', requireAdmin, (req, res) => {
  const policy = getPolicyById(req.params.id);
  if (policy) {
    const { category_id, policy_name, sum_assurance, premium, tenure } = req.body;
    const cat = getCategoryById(category_id);
    policy.category_id = parseInt(category_id);
    policy.category_name = cat ? cat.category_name : policy.category_name;
    policy.policy_name = policy_name;
    policy.sum_assurance = parseInt(sum_assurance) || policy.sum_assurance;
    policy.premium = parseInt(premium) || policy.premium;
    policy.tenure = parseInt(tenure) || policy.tenure;
  }
  res.redirect('/admin-update-policy');
});

app.get('/admin-delete-policy', requireAdmin, (req, res) => {
  res.render('insurance/admin_delete_policy', { policies: db.policies });
});

app.get('/delete-policy/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.policies = db.policies.filter(p => p.id !== id);
  db.policyRecords = db.policyRecords.filter(r => r.policy_id !== id);
  res.redirect('/admin-delete-policy');
});

// Policy holder records
app.get('/admin-view-policy-holder', requireAdmin, (req, res) => {
  res.render('insurance/admin_view_policy_holder', {
    policyrecords: getFormattedRecords()
  });
});

app.get('/admin-view-approved-policy-holder', requireAdmin, (req, res) => {
  res.render('insurance/admin_view_approved_policy_holder', {
    policyrecords: getFormattedRecords('Approved')
  });
});

app.get('/admin-view-disapproved-policy-holder', requireAdmin, (req, res) => {
  res.render('insurance/admin_view_disapproved_policy_holder', {
    policyrecords: getFormattedRecords('Disapproved')
  });
});

app.get('/admin-view-waiting-policy-holder', requireAdmin, (req, res) => {
  res.render('insurance/admin_view_waiting_policy_holder', {
    policyrecords: getFormattedRecords('Pending')
  });
});

app.get('/approve-request/:id', requireAdmin, (req, res) => {
  const record = db.policyRecords.find(r => r.id === parseInt(req.params.id));
  if (record) record.status = 'Approved';
  res.redirect('/admin-view-policy-holder');
});

app.get('/reject-request/:id', requireAdmin, (req, res) => {
  const record = db.policyRecords.find(r => r.id === parseInt(req.params.id));
  if (record) record.status = 'Disapproved';
  res.redirect('/admin-view-policy-holder');
});

// Question management
app.get('/admin-question', requireAdmin, (req, res) => {
  res.render('insurance/admin_question', {
    questions: getFormattedQuestions()
  });
});

app.get('/update-question/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const qList = getFormattedQuestions();
  const question = qList.find(q => q.id === id);
  if (!question) return res.redirect('/admin-question');
  res.render('insurance/update_question', { question });
});

app.post('/update-question/:id', requireAdmin, (req, res) => {
  const question = db.questions.find(q => q.id === parseInt(req.params.id));
  if (question && req.body.admin_comment) {
    question.admin_comment = req.body.admin_comment;
  }
  res.redirect('/admin-question');
});

// -----------------------------------------------------------------------------
// Customer Portal Routes
// -----------------------------------------------------------------------------
app.get('/customer/customer-dashboard', requireCustomer, (req, res) => {
  const customer = getCustomerByUserId(req.session.user.id);
  const customerId = customer ? customer.id : null;
  const appliedCount = customerId
    ? db.policyRecords.filter(r => r.customer_id === customerId).length
    : 0;
  const questionCount = customerId
    ? db.questions.filter(q => q.customer_id === customerId).length
    : 0;

  res.render('customer/customer_dashboard', {
    customer,
    available_policy: db.policies.length,
    applied_policy: appliedCount,
    total_category: db.categories.length,
    total_question: questionCount
  });
});

app.get('/customer/apply-policy', requireCustomer, (req, res) => {
  const customer = getCustomerByUserId(req.session.user.id);
  res.render('customer/apply_policy', {
    customer,
    policies: db.policies
  });
});

app.get('/customer/apply/:id', requireCustomer, (req, res) => {
  const customer = getCustomerByUserId(req.session.user.id);
  const policyId = parseInt(req.params.id);
  if (customer && getPolicyById(policyId)) {
    const today = new Date().toISOString().split('T')[0];
    db.policyRecords.push({
      id: db.nextRecordId++,
      customer_id: customer.id,
      policy_id: policyId,
      status: 'Pending',
      creation_date: today
    });
  }
  res.redirect('/customer/history');
});

app.get('/customer/history', requireCustomer, (req, res) => {
  const customer = getCustomerByUserId(req.session.user.id);
  const records = customer
    ? getFormattedRecords().filter(r => r.customer_id === customer.id)
    : [];
  res.render('customer/history', {
    customer,
    policies: records
  });
});

app.get('/customer/ask-question', requireCustomer, (req, res) => {
  const customer = getCustomerByUserId(req.session.user.id);
  res.render('customer/ask_question', { customer });
});

app.post('/customer/ask-question', requireCustomer, (req, res) => {
  const customer = getCustomerByUserId(req.session.user.id);
  const { description } = req.body;
  if (customer && description) {
    const today = new Date().toISOString().split('T')[0];
    db.questions.push({
      id: db.nextQuestionId++,
      customer_id: customer.id,
      description,
      admin_comment: 'Nothing',
      asked_date: today
    });
  }
  res.redirect('/customer/question-history');
});

app.get('/customer/question-history', requireCustomer, (req, res) => {
  const customer = getCustomerByUserId(req.session.user.id);
  const questions = customer ? getFormattedQuestions(customer.id) : [];
  res.render('customer/question_history', {
    customer,
    questions
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('insurance/index');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Insurance Management System server running on http://0.0.0.0:${PORT}`);
});
