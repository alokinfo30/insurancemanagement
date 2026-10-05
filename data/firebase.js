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
  return errInfo;
}

// Initial connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Non-fatal warning
  }
}
testConnection().catch(() => {});

// Default in-memory cache to guarantee zero-crash resilience
let inMemoryCategories = [
  { id: 'cat_life', category_name: 'Life Insurance', creation_date: '2026-01-15' },
  { id: 'cat_health', category_name: 'Health Insurance', creation_date: '2026-02-10' },
  { id: 'cat_motor', category_name: 'Motor Insurance', creation_date: '2026-03-05' },
  { id: 'cat_travel', category_name: 'Travel Insurance', creation_date: '2026-04-12' }
];

let inMemoryPolicies = [
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

let inMemoryUsers = [
  {
    id: 'cust_default',
    uid: 'cust_default',
    email: 'customer@insurance.local',
    username: 'customer',
    role: 'CUSTOMER',
    first_name: 'Dinara',
    last_name: 'Kurbanova',
    mobile: '9876543210',
    address: '221B Baker Street, London',
    profile_pic: '/static/image/avatar-default.svg',
    createdAt: '2026-01-10T00:00:00.000Z'
  }
];

let inMemoryRecords = [
  {
    id: 'rec_1',
    customer_id: 'cust_default',
    customer_name: 'Dinara Kurbanova',
    customer_email: 'customer@insurance.local',
    policy_id: 'pol_1',
    policy_name: 'Jeevan Anand Term Plan',
    status: 'Approved',
    creation_date: '2026-02-10'
  },
  {
    id: 'rec_2',
    customer_id: 'cust_default',
    customer_name: 'Dinara Kurbanova',
    customer_email: 'customer@insurance.local',
    policy_id: 'pol_2',
    policy_name: 'Optima Health Super Shield',
    status: 'Pending',
    creation_date: '2026-03-01'
  }
];

let inMemoryClaims = [
  {
    id: 'claim_1',
    customer_id: 'cust_default',
    customer_name: 'Dinara Kurbanova',
    customer_email: 'customer@insurance.local',
    policy_id: 'pol_2',
    policy_name: 'Optima Health Super Shield',
    claim_amount: 35000,
    incident_date: '2026-02-25',
    reason: 'Emergency Hospitalisation for acute appendicitis surgery',
    supporting_details: 'Admitted at City Hospital for 3 days. Discharge summary and final hospital bill attached. Pre-authorization was verified.',
    status: 'Approved',
    admin_remarks: 'Approved after verification with City Hospital medical desk. Full settlement disbursed.',
    settlement_amount: 35000,
    createdAt: '2026-02-26T10:00:00.000Z'
  }
];

let inMemoryQuestions = [
  {
    id: 'q_1',
    customer_id: 'cust_default',
    customer_name: 'Dinara Kurbanova',
    description: 'What documents are required to initiate an emergency cashless hospital claim?',
    admin_comment: 'You need your Policy Card, Government ID proof, and pre-authorization form signed at the network hospital.',
    asked_date: '2026-02-18'
  }
];

// Seed initial data to Firestore
export async function seedInitialFirestoreData() {
  try {
    const catSnapshot = await getDocs(collection(db, 'categories'));
    if (catSnapshot.empty) {
      for (const cat of inMemoryCategories) {
        await setDoc(doc(db, 'categories', cat.id), cat).catch(() => {});
      }
    } else {
      inMemoryCategories = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const polSnapshot = await getDocs(collection(db, 'policies'));
    if (polSnapshot.empty) {
      for (const pol of inMemoryPolicies) {
        await setDoc(doc(db, 'policies', pol.id), pol).catch(() => {});
      }
    } else {
      inMemoryPolicies = polSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Seed default customer
    const userSnapshot = await getDocs(collection(db, 'users'));
    if (userSnapshot.empty) {
      for (const u of inMemoryUsers) {
        await setDoc(doc(db, 'users', u.uid), u).catch(() => {});
      }
    } else {
      inMemoryUsers = userSnapshot.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
    }

    // Seed default claim
    const claimSnapshot = await getDocs(collection(db, 'claims'));
    if (claimSnapshot.empty) {
      for (const cl of inMemoryClaims) {
        await setDoc(doc(db, 'claims', cl.id), cl).catch(() => {});
      }
    } else {
      inMemoryClaims = claimSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Initial Firestore seeding completed with fallback cache active:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Categories Operations
// -----------------------------------------------------------------------------
export async function getCategories() {
  try {
    const snapshot = await getDocs(collection(db, 'categories'));
    if (!snapshot.empty) {
      inMemoryCategories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Error fetching categories from Firestore, using cache:', err.message);
  }
  return inMemoryCategories;
}

export async function addCategory(categoryName) {
  const id = 'cat_' + Date.now();
  const newCat = {
    category_name: categoryName,
    creation_date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  inMemoryCategories.push({ id, ...newCat });
  try {
    await setDoc(doc(db, 'categories', id), newCat);
  } catch (err) {
    console.warn('Firestore setDoc category error, kept in memory:', err.message);
  }
  return { id, ...newCat };
}

export async function updateCategory(id, categoryName) {
  const cat = inMemoryCategories.find(c => c.id === id);
  if (cat) cat.category_name = categoryName;
  try {
    await updateDoc(doc(db, 'categories', id), { category_name: categoryName });
  } catch (err) {
    console.warn('Firestore updateDoc category error, updated in memory:', err.message);
  }
}

export async function deleteCategory(id) {
  inMemoryCategories = inMemoryCategories.filter(c => c.id !== id);
  try {
    await deleteDoc(doc(db, 'categories', id));
  } catch (err) {
    console.warn('Firestore deleteDoc category error:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Policies Operations
// -----------------------------------------------------------------------------
export async function getPolicies() {
  try {
    const snapshot = await getDocs(collection(db, 'policies'));
    if (!snapshot.empty) {
      inMemoryPolicies = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Error fetching policies from Firestore, using cache:', err.message);
  }
  return inMemoryPolicies;
}

export async function getPolicyById(id) {
  const cached = inMemoryPolicies.find(p => p.id === id);
  if (cached) return cached;
  try {
    const d = await getDoc(doc(db, 'policies', id));
    if (d.exists()) return { id: d.id, ...d.data() };
  } catch (err) {
    // fallback
  }
  return null;
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
  inMemoryPolicies.push({ id, ...newPolicy });
  try {
    await setDoc(doc(db, 'policies', id), newPolicy);
  } catch (err) {
    console.warn('Firestore setDoc policy error, kept in memory:', err.message);
  }
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
  const idx = inMemoryPolicies.findIndex(p => p.id === id);
  if (idx !== -1) {
    inMemoryPolicies[idx] = { ...inMemoryPolicies[idx], ...updatePayload };
  }
  try {
    await updateDoc(doc(db, 'policies', id), updatePayload);
  } catch (err) {
    console.warn('Firestore updateDoc policy error:', err.message);
  }
}

export async function deletePolicy(id) {
  inMemoryPolicies = inMemoryPolicies.filter(p => p.id !== id);
  try {
    await deleteDoc(doc(db, 'policies', id));
  } catch (err) {
    console.warn('Firestore deleteDoc policy error:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Users / Customers Operations
// -----------------------------------------------------------------------------
export async function getCustomers() {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'CUSTOMER'))
    );
    if (!snapshot.empty) {
      inMemoryUsers = snapshot.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Error fetching customers from Firestore, using cache:', err.message);
  }
  return inMemoryUsers.filter(u => u.role === 'CUSTOMER');
}

export async function getUserById(uid) {
  const cached = inMemoryUsers.find(u => u.uid === uid || u.id === uid);
  if (cached) return cached;
  try {
    const d = await getDoc(doc(db, 'users', uid));
    if (d.exists()) return { id: d.id, uid: d.id, ...d.data() };
  } catch (err) {
    // fallback
  }
  return null;
}

export async function saveUser(userData) {
  const uid = userData.uid || 'usr_' + Date.now();
  const profile = {
    id: uid,
    uid,
    email: userData.email,
    username: userData.username || userData.email,
    role: userData.role || 'CUSTOMER',
    first_name: userData.first_name || 'Customer',
    last_name: userData.last_name || '',
    mobile: userData.mobile || '',
    address: userData.address || '',
    profile_pic: userData.profile_pic || '/static/image/avatar-default.svg',
    createdAt: userData.createdAt || new Date().toISOString()
  };

  const existingIdx = inMemoryUsers.findIndex(u => u.uid === uid || u.id === uid);
  if (existingIdx !== -1) {
    inMemoryUsers[existingIdx] = { ...inMemoryUsers[existingIdx], ...profile };
  } else {
    inMemoryUsers.push(profile);
  }

  try {
    await setDoc(doc(db, 'users', uid), profile, { merge: true });
  } catch (err) {
    console.warn('Firestore setDoc user warning, saved in memory:', err.message);
  }
  return profile;
}

export async function updateUser(uid, updateFields) {
  const idx = inMemoryUsers.findIndex(u => u.uid === uid || u.id === uid);
  if (idx !== -1) {
    inMemoryUsers[idx] = { ...inMemoryUsers[idx], ...updateFields };
  }
  try {
    await updateDoc(doc(db, 'users', uid), updateFields);
  } catch (err) {
    console.warn('Firestore updateUser error:', err.message);
  }
}

export async function deleteUser(uid) {
  inMemoryUsers = inMemoryUsers.filter(u => u.uid !== uid && u.id !== uid);
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    console.warn('Firestore deleteUser error:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Policy Records (Applications)
// -----------------------------------------------------------------------------
export async function getPolicyRecords(statusFilter = null) {
  try {
    const snapshot = await getDocs(collection(db, 'policy_records'));
    if (!snapshot.empty) {
      inMemoryRecords = snapshot.docs.map(d => ({
        id: d.id,
        customer: d.data().customer_name || 'Customer',
        Policy: d.data().policy_name || 'Policy',
        ...d.data()
      }));
    }
  } catch (err) {
    console.warn('Error fetching policy records, using cache:', err.message);
  }
  if (statusFilter) {
    return inMemoryRecords.filter(r => r.status.toLowerCase() === statusFilter.toLowerCase());
  }
  return inMemoryRecords;
}

export async function getPolicyRecordsByCustomer(customerId) {
  const allRecords = await getPolicyRecords();
  return allRecords.filter(r => r.customer_id === customerId);
}

export async function createPolicyRecord(data) {
  const id = 'rec_' + Date.now();
  const newRec = {
    id,
    customer_id: data.customer_id,
    customer_name: data.customer_name || 'Customer',
    customer_email: data.customer_email || '',
    policy_id: data.policy_id,
    policy_name: data.policy_name,
    status: 'Pending',
    creation_date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  inMemoryRecords.push(newRec);
  try {
    await setDoc(doc(db, 'policy_records', id), newRec);
  } catch (err) {
    console.warn('Firestore createPolicyRecord error, saved in memory:', err.message);
  }
  return newRec;
}

export async function updateRecordStatus(id, newStatus) {
  const rec = inMemoryRecords.find(r => r.id === id);
  if (rec) rec.status = newStatus;
  try {
    await updateDoc(doc(db, 'policy_records', id), { status: newStatus });
  } catch (err) {
    console.warn('Firestore updateRecordStatus error:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Claims Operations (Submit and Track Insurance Claims)
// -----------------------------------------------------------------------------
export async function getClaims(customerId = null) {
  try {
    const snapshot = await getDocs(collection(db, 'claims'));
    if (!snapshot.empty) {
      inMemoryClaims = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Error fetching claims, using cache:', err.message);
  }
  if (customerId) {
    return inMemoryClaims.filter(c => c.customer_id === customerId);
  }
  return inMemoryClaims;
}

export async function getClaimById(id) {
  const cached = inMemoryClaims.find(c => c.id === id);
  if (cached) return cached;
  try {
    const d = await getDoc(doc(db, 'claims', id));
    if (d.exists()) return { id: d.id, ...d.data() };
  } catch (err) {
    // fallback
  }
  return null;
}

export async function createClaim(data) {
  const id = 'claim_' + Date.now();
  const newClaim = {
    id,
    customer_id: data.customer_id,
    customer_name: data.customer_name || 'Customer',
    customer_email: data.customer_email || '',
    policy_id: data.policy_id,
    policy_name: data.policy_name || 'Insurance Policy',
    claim_amount: Number(data.claim_amount) || 0,
    incident_date: data.incident_date || new Date().toISOString().split('T')[0],
    reason: data.reason || 'General Claim',
    supporting_details: data.supporting_details || '',
    status: 'Pending',
    admin_remarks: 'Under initial documentation verification',
    settlement_amount: 0,
    createdAt: new Date().toISOString()
  };
  inMemoryClaims.push(newClaim);
  try {
    await setDoc(doc(db, 'claims', id), newClaim);
  } catch (err) {
    console.warn('Firestore createClaim error, saved in memory:', err.message);
  }
  return newClaim;
}

export async function updateClaimStatus(id, status, adminRemarks = '', settlementAmount = 0) {
  const cl = inMemoryClaims.find(c => c.id === id);
  if (cl) {
    cl.status = status;
    if (adminRemarks) cl.admin_remarks = adminRemarks;
    if (settlementAmount) cl.settlement_amount = Number(settlementAmount);
  }
  try {
    await updateDoc(doc(db, 'claims', id), {
      status,
      admin_remarks: adminRemarks,
      settlement_amount: Number(settlementAmount) || 0
    });
  } catch (err) {
    console.warn('Firestore updateClaimStatus error:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Questions Operations
// -----------------------------------------------------------------------------
export async function getQuestions(customerId = null) {
  try {
    const snapshot = await getDocs(collection(db, 'questions'));
    if (!snapshot.empty) {
      inMemoryQuestions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Error fetching questions, using cache:', err.message);
  }
  if (customerId) {
    return inMemoryQuestions.filter(q => q.customer_id === customerId);
  }
  return inMemoryQuestions;
}

export async function createQuestion(data) {
  const id = 'q_' + Date.now();
  const newQ = {
    id,
    customer_id: data.customer_id,
    customer_name: data.customer_name || 'Customer',
    description: data.description,
    admin_comment: 'Nothing',
    asked_date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  inMemoryQuestions.push(newQ);
  try {
    await setDoc(doc(db, 'questions', id), newQ);
  } catch (err) {
    console.warn('Firestore createQuestion error, saved in memory:', err.message);
  }
  return newQ;
}

export async function updateQuestionComment(id, comment) {
  const q = inMemoryQuestions.find(item => item.id === id);
  if (q) q.admin_comment = comment;
  try {
    await updateDoc(doc(db, 'questions', id), { admin_comment: comment });
  } catch (err) {
    console.warn('Firestore updateQuestionComment error:', err.message);
  }
}
