// In-memory data store for Insurance Management System

export const db = {
  categories: [
    { id: 1, category_name: 'Life Insurance', creation_date: '2026-01-10' },
    { id: 2, category_name: 'Health Insurance', creation_date: '2026-01-15' },
    { id: 3, category_name: 'Motor Insurance', creation_date: '2026-02-01' },
    { id: 4, category_name: 'Travel Insurance', creation_date: '2026-02-12' }
  ],

  policies: [
    {
      id: 1,
      category_id: 1,
      category_name: 'Life Insurance',
      policy_name: 'Jeevan Anand Term Life',
      sum_assurance: 500000,
      premium: 12000,
      tenure: 20,
      creation_date: '2026-01-12'
    },
    {
      id: 2,
      category_id: 2,
      category_name: 'Health Insurance',
      policy_name: 'Family Health Guard Plus',
      sum_assurance: 1000000,
      premium: 18500,
      tenure: 3,
      creation_date: '2026-01-20'
    },
    {
      id: 3,
      category_id: 3,
      category_name: 'Motor Insurance',
      policy_name: 'Comprehensive Auto Shield',
      sum_assurance: 750000,
      premium: 9500,
      tenure: 1,
      creation_date: '2026-02-05'
    }
  ],

  users: [
    {
      id: 1,
      username: 'admin',
      password: 'admin',
      first_name: 'System',
      last_name: 'Admin',
      role: 'ADMIN'
    },
    {
      id: 2,
      username: 'customer',
      password: 'customer',
      first_name: 'Dinara',
      last_name: 'Kurbanova',
      role: 'CUSTOMER'
    }
  ],

  customers: [
    {
      id: 1,
      user_id: 2,
      username: 'customer',
      first_name: 'Dinara',
      last_name: 'Kurbanova',
      mobile: '9876543210',
      address: '221B Baker Street, London',
      profile_pic: '/static/profile_pic/Customer/lazy.PNG'
    }
  ],

  policyRecords: [
    {
      id: 1,
      customer_id: 1,
      policy_id: 1,
      status: 'Approved',
      creation_date: '2026-02-10'
    },
    {
      id: 2,
      customer_id: 1,
      policy_id: 2,
      status: 'Pending',
      creation_date: '2026-03-01'
    }
  ],

  questions: [
    {
      id: 1,
      customer_id: 1,
      description: 'What documents are required to initiate an emergency cashless hospital claim?',
      admin_comment: 'You need your Policy Card, ID proof, and pre-authorization form signed at the network hospital.',
      asked_date: '2026-02-18'
    },
    {
      id: 2,
      customer_id: 1,
      description: 'Can I add my parents to my existing Family Health Guard plan before renewal?',
      admin_comment: 'Nothing',
      asked_date: '2026-03-02'
    }
  ],

  nextCategoryId: 5,
  nextPolicyId: 4,
  nextUserId: 3,
  nextCustomerId: 2,
  nextRecordId: 3,
  nextQuestionId: 3
};

// Helper methods
export function getCategoryById(id) {
  return db.categories.find(c => c.id === parseInt(id));
}

export function getPolicyById(id) {
  return db.policies.find(p => p.id === parseInt(id));
}

export function getCustomerByUserId(userId) {
  return db.customers.find(c => c.user_id === parseInt(userId));
}

export function getCustomerById(id) {
  return db.customers.find(c => c.id === parseInt(id));
}

export function getFormattedRecords(filterStatus = null) {
  let list = db.policyRecords;
  if (filterStatus) {
    list = list.filter(r => r.status.toLowerCase() === filterStatus.toLowerCase());
  }
  return list.map(r => {
    const cust = getCustomerById(r.customer_id);
    const pol = getPolicyById(r.policy_id);
    return {
      id: r.id,
      customer_id: r.customer_id,
      customer: cust ? `${cust.first_name} ${cust.last_name}` : 'Unknown',
      Policy: pol ? pol.policy_name : 'Unknown Policy',
      status: r.status,
      creation_date: r.creation_date
    };
  });
}

export function getFormattedQuestions(customerId = null) {
  let list = db.questions;
  if (customerId) {
    list = list.filter(q => q.customer_id === parseInt(customerId));
  }
  return list.map(q => {
    const cust = getCustomerById(q.customer_id);
    return {
      id: q.id,
      customer_id: q.customer_id,
      customer_name: cust ? `${cust.first_name} ${cust.last_name}` : 'Customer',
      description: q.description,
      admin_comment: q.admin_comment || 'Nothing',
      asked_date: q.asked_date
    };
  });
}
