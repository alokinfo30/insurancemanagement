# Insurance Management
![developer](https://img.shields.io/badge/Developed%20By%20%3A-Sumit%20Kumar-red)
---
## screenshots
### Homepage
![homepage snap](https://github.com/sumitkumar1503/insurancemanagement/blob/master/static/screenshots/homepage.png?raw=true)
### Admin Dashboard
![dashboard snap](https://github.com/sumitkumar1503/insurancemanagement/blob/master/static/screenshots/dashboard.png?raw=true)
### Policy Record
![invoice snap](https://github.com/sumitkumar1503/insurancemanagement/blob/master/static/screenshots/policyrecord.png?raw=true)
### Policy 
![doctor snap](https://github.com/sumitkumar1503/insurancemanagement/blob/master/static/screenshots/policy.png?raw=true)
---
## Functions
### Admin
- Admin account can be created using createsuperuser command.
- After login, admin can view/update/delete customer
- Can view/add/update/delete policy category like Life, Health, Motor, Travel
- Can view/add/update/delete policy
- Can view total policy holder, approved policy holder, disapproved policy holder
- Can approve policy, applied by customer
- Can answer customer question

### Customer
- Create account (no approval required by admin)
- After login, can view all policy that are added by admin.
- If customer likes any policy, then they can apply for it.
- When customer will apply for any policy, it will go into pending status, admin can approve it.
- Customer can check status of his policy under history section
- Customer can ask question from admin. 

---

## HOW TO RUN THIS PROJECT
This version uses Node.js, Express, and EJS. Install dependencies and start the local server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

### Netlify deployment

Netlify runs `npm run build`, which prepares static assets in `public/static`, and publishes `public`. The application is server-rendered rather than a single-page application: page routes and API requests are handled by the `app` Netlify Function, while published static files take precedence. EJS templates, static assets, and the existing Firebase configuration are included in the function bundle.

Configure `SESSION_SECRET` in the Netlify environment. The existing Firebase-backed data and authentication behavior are unchanged; the current in-memory session store is not shared across function instances.

## CHANGES REQUIRED FOR CONTACT US PAGE
- In settins.py file, You have to give your email and password
```
EMAIL_HOST_USER = 'youremail@gmail.com'
EMAIL_HOST_PASSWORD = 'your email password'
EMAIL_RECEIVING_USER = 'youremail@gmail.com'
```
- Login to gmail through host email id in your browser and open following link and turn it ON
```
https://myaccount.google.com/lesssecureapps
```


## Disclaimer
This project is developed for demo purpose and it's not supposed to be used in real application.

## Feedback
Any suggestion and feedback is welcome. You can message me on facebook
- [Contact on Facebook](https://fb.com/sumit.luv)
- [Subscribe my Channel LazyCoder On Youtube](https://youtube.com/lazycoderonline)
