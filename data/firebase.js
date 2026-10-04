import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const configDirectory = process.env.LAMBDA_TASK_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Read configuration from firebase-applet-config.json
const configPath = path.join(configDirectory, 'firebase-applet-config.json');
let firebaseConfig = {};

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  firebaseConfig = JSON.parse(configFile);
} catch (e) {
  console.warn('Could not read firebase-applet-config.json, falling back to env/empty', e.message);
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const clientConfig = firebaseConfig;

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

export function handleFirestoreError(error, operationType, targetPath) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null
    },
    operationType,
    path: targetPath
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initial connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection().catch(() => {});

// Default seed data to ensure initial rich dataset in Firestore
const DEFAULT_CATEGORIES = [
  { id: 'cat_life', category_name: 'Life Insurance', creation_date: '2026-01-15' },
  { id: 'cat_health', category_name: 'Health Insurance', creation_date: '2026-02-10' },
  { id: 'cat_motor', category_name: 'Motor Insurance', creation_date: '2026-03-05' },
  { id: 'cat_travel', category_name: 'Travel Insurance', creation_date: '2026-04-12' }
];

const DEFAULT_POLICIES = [
  {
    id: 'pol_1',
    category_id: 'cat_life',
    category_name: 'Life Insurance',
    policy_name: 'Jeevan Anand Term Plan',
    sum_assurance: 500000,
    premium: 12000,
    tenure: 20,
    creation_date: '2026-01-20',
    description: 'Comprehensive term protection plan providing financial security for your family with guaranteed death benefit.'
  },
  {
    id: 'pol_2',
    category_id: 'cat_health',
    category_name: 'Health Insurance',
    policy_name: 'Optima Health Super Shield',
    sum_assurance: 1000000,
    premium: 18500,
    tenure: 1,
    creation_date: '2026-02-15',
    description: 'Cashless hospitalisation coverage across 8,000+ network hospitals with zero deductible on major illnesses.'
  },
  {
    id: 'pol_3',
    category_id: 'cat_motor',
    category_name: 'Motor Insurance',
    policy_name: 'DriveSecure Bumper-to-Bumper',
    sum_assurance: 850000,
    premium: 9200,
    tenure: 1,
    creation_date: '2026-03-01',
    description: 'Zero depreciation coverage including 24x7 roadside breakdown assistance and engine protection.'
  },
  {
    id: 'pol_4',
    category_id: 'cat_travel',
    category_name: 'Travel Insurance',
    policy_name: 'Global Wanderer Schengen Plus',
    sum_assurance: 350000,
    premium: 4500,
    tenure: 1,
    creation_date: '2026-04-18',
    description: 'Compliant with Schengen visa requirements. Covers medical emergencies, lost baggage, and trip cancellations.'
  }
];

// Helper to seed initial data in Firestore
export async function seedInitialFirestoreData() {
  try {
    const catSnapshot = await getDocs(collection(db, 'categories'));
    if (catSnapshot.empty) {
      console.log('Seeding initial categories to Firestore...');
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }
    }

    const polSnapshot = await getDocs(collection(db, 'policies'));
    if (polSnapshot.empty) {
      console.log('Seeding initial policies to Firestore...');
      for (const pol of DEFAULT_POLICIES) {
        await setDoc(doc(db, 'policies', pol.id), pol);
      }
    }

    // Seed default admin
    await setDoc(
      doc(db, 'admins', 'admin_default'),
      { email: 'alokinfo30@gmail.com', addedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.warn('Initial Firestore seeding warning:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Persistent Categories Operations
// -----------------------------------------------------------------------------
export async function getCategories() {
  try {
    const snapshot = await getDocs(collection(db, 'categories'));
    if (snapshot.empty) return DEFAULT_CATEGORIES;
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching categories from Firestore:', err);
    return DEFAULT_CATEGORIES;
  }
}

export async function addCategory(categoryName) {
  const id = 'cat_' + Date.now();
  const newCat = {
    category_name: categoryName,
    creation_date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'categories', id), newCat);
  return { id, ...newCat };
}

export async function updateCategory(id, categoryName) {
  await updateDoc(doc(db, 'categories', id), { category_name: categoryName });
}

export async function deleteCategory(id) {
  await deleteDoc(doc(db, 'categories', id));
}

// -----------------------------------------------------------------------------
// Persistent Policies Operations
// -----------------------------------------------------------------------------
export async function getPolicies() {
  try {
    const snapshot = await getDocs(collection(db, 'policies'));
    if (snapshot.empty) return DEFAULT_POLICIES;
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching policies from Firestore:', err);
    return DEFAULT_POLICIES;
  }
}

export async function getPolicyById(id) {
  try {
    const d = await getDoc(doc(db, 'policies', id));
    if (d.exists()) return { id: d.id, ...d.data() };
    return DEFAULT_POLICIES.find(p => p.id === id) || null;
  } catch (err) {
    return DEFAULT_POLICIES.find(p => p.id === id) || null;
  }
}

export async function addPolicy(policyData) {
  const id = 'pol_' + Date.now();
  const newPolicy = {
    category_id: policyData.category_id,
    category_name: policyData.category_name,
    policy_name: policyData.policy_name,
    sum_assurance: Number(policyData.sum_assurance) || 0,
    premium: Number(policyData.premium) || 0,
    tenure: Number(policyData.tenure) || 1,
    description: policyData.description || 'Comprehensive coverage tailored to your needs.',
    creation_date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'policies', id), newPolicy);
  return { id, ...newPolicy };
}

export async function updatePolicy(id, policyData) {
  const updatePayload = {
    category_id: policyData.category_id,
    category_name: policyData.category_name,
    policy_name: policyData.policy_name,
    sum_assurance: Number(policyData.sum_assurance) || 0,
    premium: Number(policyData.premium) || 0,
    tenure: Number(policyData.tenure) || 1
  };
  if (policyData.description) {
    updatePayload.description = policyData.description;
  }
  await updateDoc(doc(db, 'policies', id), updatePayload);
}

export async function deletePolicy(id) {
  await deleteDoc(doc(db, 'policies', id));
}

// -----------------------------------------------------------------------------
// Persistent Users / Customers Operations
// Customers persist indefinitely in Firestore (no TTL deletion)
// Add logging to diagnose any auto-deletion issues
// -----------------------------------------------------------------------------
export async function getCustomers() {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'CUSTOMER'))
    );
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching customers:', err);
    return [];
  }
}

export async function getUserById(uid) {
  try {
    const d = await getDoc(doc(db, 'users', uid));
    if (d.exists()) return { id: d.id, ...d.data() };
    return null;
  } catch (err) {
    return null;
  }
}

export async function saveUser(userData) {
  const uid = userData.uid || 'usr_' + Date.now();
  const profile = {
    uid,
    email: userData.email,
    role: userData.role || 'CUSTOMER',
    first_name: userData.first_name || '',
    last_name: userData.last_name || '',
    mobile: userData.mobile || '',
    address: userData.address || '',
    profile_pic: userData.profile_pic || '/static/profile_pic/Customer/lazy.PNG',
    createdAt: userData.createdAt || new Date().toISOString()
  };
  
  console.log(`[DEBUG] Saving customer with UID: ${uid}, Email: ${profile.email}`);
  
  try {
    await setDoc(doc(db, 'users', uid), profile, { merge: true });
    console.log(`[DEBUG] Customer saved successfully: ${uid}`);
    return profile;
  } catch (error) {
    console.error(`[ERROR] Failed to save customer ${uid}:`, error.message);
    throw error;
  }
}

export async function updateUser(uid, updateFields) {
  console.log(`[DEBUG] Updating customer ${uid} with fields:`, Object.keys(updateFields));
  await updateDoc(doc(db, 'users', uid), updateFields);
}

export async function deleteUser(uid) {
  console.log(`[DEBUG] Deleting customer ${uid}`);
  await deleteDoc(doc(db, 'users', uid));
}

// -----------------------------------------------------------------------------
// Persistent Policy Records (Applications)
// Policy records persist indefinitely in Firestore
// -----------------------------------------------------------------------------
export async function getPolicyRecords(statusFilter = null) {
  try {
    const snapshot = await getDocs(collection(db, 'policy_records'));
    let records = snapshot.docs.map(d => ({
      id: d.id,
      customer: d.data().customer_name || 'Customer',
      Policy: d.data().policy_name || 'Policy',
      ...d.data()
    }));
    if (statusFilter) {
      records = records.filter(r => r.status === statusFilter);
    }
    return records;
  } catch (err) {
    console.error('Error fetching policy records:', err);
    return [];
  }
}

export async function getPolicyRecordsByCustomer(customerId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'policy_records'), where('customer_id', '==', customerId))
    );
    return snapshot.docs.map(d => ({
      id: d.id,
      Policy: d.data().policy_name,
      ...d.data()
    }));
  } catch (err) {
    console.error('Error fetching customer records:', err);
    return [];
  }
}

export async function createPolicyRecord(data) {
  const id = 'rec_' + Date.now();
  const newRec = {
    customer_id: data.customer_id,
    customer_name: data.customer_name || 'Customer',
    customer_email: data.customer_email || '',
    policy_id: data.policy_id,
    policy_name: data.policy_name,
    status: 'Pending',
    creation_date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'policy_records', id), newRec);
  return { id, ...newRec };
}

export async function updateRecordStatus(id, newStatus) {
  await updateDoc(doc(db, 'policy_records', id), { status: newStatus });
}

// -----------------------------------------------------------------------------
// Persistent Questions Operations
// Questions persist indefinitely in Firestore
// -----------------------------------------------------------------------------
export async function getQuestions(customerId = null) {
  try {
    const snapshot = await getDocs(collection(db, 'questions'));
    let questions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (customerId) {
      questions = questions.filter(q => q.customer_id === customerId);
    }
    return questions;
  } catch (err) {
    console.error('Error fetching questions:', err);
    return [];
  }
}

export async function createQuestion(data) {
  const id = 'q_' + Date.now();
  const newQ = {
    customer_id: data.customer_id,
    customer_name: data.customer_name || 'Customer',
    description: data.description,
    admin_comment: 'Nothing',
    asked_date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'questions', id), newQ);
  return { id, ...newQ };
}

export async function updateQuestionComment(id, comment) {
  await updateDoc(doc(db, 'questions', id), { admin_comment: comment });
}
