const express = require('express');
const path = require('path');
const db = require('./db');
const bodyParser = require('body-parser');
const session = require('express-session');
const { body, validationResult } = require('express-validator');

const bcrypt = require('bcrypt');

const app = express();
const crypto = require('crypto');

// Generate a strong session secret



const port = process.env.PORT || 4001;

app.listen(port, () => {
    console.log(`Listening to port ${port}`);
});

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// ... (existing code)
const sessionSecret = crypto.randomBytes(64).toString('hex');

// Use it in your express-session configuration
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true
}));
app.get('/', async (req, res) => {
    
    res.render('home');
});

// User Registration Validation
// User Registration Validation
const validateRegistration = [
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('dateofbirth').isISO8601().withMessage('Invalid date of birth'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

    body('dateofbirth').custom((value) => {
        const birthDate = new Date(value);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        if (age < 13) {
            throw new Error('You must be at least 13 years old to register');
        }
        return true;
    }),
];

// Separate middleware function
const handleRegistrationErrors = (req, res, next) => {
    const errors = validationResult(req);
    res.locals.errors = errors.array(); // Set errors in res.locals
    next();
};

// User Registration Route
app.get('/register', (req, res) => {
    res.render('register', { errors: [] });
});

app.post('/register', validateRegistration, handleRegistrationErrors, async (req, res) => {
    try {
        const { first_name, last_name, email, dateofbirth, gender, password } = req.body;

        // Add logging to check values
        console.log('Registration Data:', { first_name, last_name, email, dateofbirth, gender, password });

        // Hash the password before storing it in the database
        const hashedPassword = await bcrypt.hash(password, 10);

        // Add logging to check hashed password
        console.log('Hashed Password:', hashedPassword);

        // Insert user data into the database
        await db.query(`
            INSERT INTO users (first_name, last_name, email, dateofbirth, gender, password)
            VALUES ($1, $2, $3, $4, $5, $6);
        `, [first_name, last_name, email, dateofbirth, gender, hashedPassword]);

        if (!res.locals.errors.isEmpty()) {
            return res.status(400).render('register', { errors: res.locals.errors });
        }

        res.redirect('/login');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Internal Server Error');
    }
});



// User Login Validation
// User Login Validation
const validateLogin = [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),

    (req, res, next) => {
        const errors = validationResult(req);
        res.locals.errors = errors.array();  // Set errors in res.locals
        next();
    },
];


// User Login Route
app.get('/login', (req, res) => {
    res.render('login', { errorMessage: '', errors: [] });
});
app.post('/login', validateLogin, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Fetch user data from the database based on the email
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).render('login', { errorMessage: 'Invalid email or password', errors: res.locals.errors });
        }

        const user = result.rows[0];

        // Compare the entered password with the hashed password from the database
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).render('login', { errorMessage: 'Invalid email or password', errors: res.locals.errors });
        }

        // Set a session or token to keep the user logged in
        req.session.userId = user.id;

        // Redirect to the user dashboard or homepage
        res.redirect('/');
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Internal Server Error');
    }
});



// Admin Login Route
// Admin Login Validation
const validateAdminLogin = [
    body('adminUsername').notEmpty().withMessage('Admin username is required'),
    body('adminPassword').notEmpty().withMessage('Admin password is required'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('adminLogin', { errors: errors.array() });
        }
        next();
    },
];
app.get('/admin/login', (req, res) => {
    res.render('adminLogin', { errorMessage: '', errors: [] }); // Render the admin login form
});
app.post('/admin/login', validateAdminLogin, async (req, res) => {
    try {
        const { adminUsername, adminPassword } = req.body;

        // Hardcoded admin credentials (replace with database validation)
        const validAdminUsername = 'admin';
        const validAdminPassword = '$2b$10$RQxpgFe6ViP7/VjQpSR2l.3mBY8glw8DJiMMR7QmIXPKrg1pW05LO'; // bcrypt hash for 'admin123'

        // Check admin credentials (compare with hashed password)
        //if (adminUsername === validAdminUsername && await bcrypt.compare(adminPassword, validAdminPassword)) {
            req.session.adminId = 1; // You may use a better way to identify admin sessions

            // Redirect to the admin dashboard or homepage
            return res.redirect('/admin/homepage');
       // } else {
            return res.status(401).render('adminLogin', { errorMessage: 'Invalid admin credentials', errors: [] });
       // }
    } catch (error) {
        console.error('Error logging in as admin:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/admin/homepage', (req, res) => {
    // Check if the admin is logged in
    if (req.session.adminId) {
        console.log('Accessed admin dashboard route');
        res.render('nav');
    } else {
        res.redirect('/admin/login'); // Redirect to admin login if not logged in
    }
});



// Admin Dashboard Route (replace with your actual admin dashboard route)
app.get('/admin/dashboard',async (req, res) => {
    // Check if the admin is logged in
    if (req.session.adminId) {
        console.log('Accessed admin dashboard route');
        try {
            // Query to get total medicines
            const medicinesResult = await db.query('SELECT COUNT(*) FROM Drug');
            const totalMedicines = medicinesResult.rows[0].count;
        
            // Query to get total suppliers
            const suppliersResult = await db.query('SELECT COUNT(*) FROM Drug_Manufacturer');
            const totalSuppliers = suppliersResult.rows[0].count;
      
            const genericsResult=await db.query('SELECT COUNT(*) FROM CATEGORY');
            const totalGenerics=genericsResult.rows[0].count;
            const totalSales=0;
            const totalPurchases=0;
            const outOfStockMedicines=0;
            const totalUsers=0;
        
            // ... (similar queries for other variables)
        
            // Determine the selected section based on the route or any other criteria
            const selectedSection = 'dashboard';
        
            // Render the 'adminDashboard.ejs' file with the data and selected section
            res.render('finalDashboard',{ totalMedicines, totalSuppliers, totalGenerics,totalSales,totalPurchases,outOfStockMedicines,totalUsers});
          } catch (error) {
            console.error('Error fetching data:', error);
            res.status(500).send('Internal Server Error');
          }
    } else {
        res.redirect('/admin/login'); // Redirect to admin login if not logged in
    }
});

// ... (existing code)




// Assuming you have a route for viewing drugs as follows:
/*app.get('/admin/viewdrugs', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT Drug.*, Drug_Manufacturer.Name as company,Category.Description as descp,Category.Generic_Name as gn
            FROM Drug
            JOIN Drug_Manufacturer ON Drug.Manufacturer_ID = Drug_Manufacturer.ID
            JOIN CATEGORY ON Drug.Category_ID=Category.ID;
        `);

        const drugs = result.rows;

        // Log the fetched drugs for debugging
        console.log('Fetched drugs:', drugs);

        res.render('drugInfo', { drugs });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Internal Server Error");
    }
});*/
app.get('/admin/viewdrugs', async (req, res) => {
    try {
        let drugs;

        // Check if there is a search query parameter
        if (req.query.search) {
            const searchQuery = req.query.search.toLowerCase();

            // Use a case-insensitive search by converting both the medicine name and the search query to lowercase
            drugs = await db.query(`
            SELECT Drug.*, Drug_Manufacturer.Name as company,Category.Description as descp,Category.Generic_Name as gn
            FROM Drug
            JOIN Drug_Manufacturer ON Drug.Manufacturer_ID = Drug_Manufacturer.ID
            JOIN CATEGORY ON Drug.Category_ID=Category.ID WHERE LOWER(Drug.medicine_name) LIKE $1
            `, [`%${searchQuery}%`]);
        } else {
            // If no search query, fetch all medicines
             drugs = await db.query(`
            SELECT Drug.*, Drug_Manufacturer.Name as company,Category.Description as descp,Category.Generic_Name as gn
            FROM Drug
            JOIN Drug_Manufacturer ON Drug.Manufacturer_ID = Drug_Manufacturer.ID
            JOIN CATEGORY ON Drug.Category_ID=Category.ID;
            `);
        }

        res.render('drugInfo', { drugs: drugs.rows, msg: req.query.msg });
    } catch (error) {
        console.error("Error fetching medicine data:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get('/admin/viewmedicines', (req, res) => {
    // Log that the /admin/viewmedicines route is accessed
    console.log('Accessed /admin/viewmedicines route');

    // Redirect to the '/admin/viewdrugs' route
    res.redirect('/admin/viewdrugs');
});


// server.js

// ... (existing code)
app.get('/addMedicine',async (req, res) => {
    try {
        const result = await db.query(`
            SELECT  Name 
            
            from Drug_Manufacturer ;
        `);

        const suppliers = result.rows;
        // Log the fetched drugs for debugging
        console.log(suppliers);
        

        res.render('addMedicine', {  suppliers });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Internal Server Error");
    }
    
});

app.post('/addMedicine', async (req, res) => {
    let manufacturerId; // Declare manufacturerId here

    try {
        // Extract form data
        const {
            medicineName,
            unitPrice,
            expireDate,
            manufacturingDate,
            quantity,
            supplier,
            generic_name,
            description
        } = req.body;

        // Check if the supplier already exists in the Drug_Manufacturer table
        const manufacturerResult = await db.query(`
            SELECT ID FROM Drug_Manufacturer WHERE Name = $1;
        `, [supplier]);
      

        if (manufacturerResult.rows.length > 0) {
            // If the manufacturer exists, use the existing manufacturer ID
            manufacturerId = manufacturerResult.rows[0].id;
        } 
        
       
        // Check if generic_name already exists in the Category table
        const categoryResult = await db.query(`
            SELECT ID FROM Category WHERE Generic_Name = $1;
        `, [generic_name]);

        let categoryId;

        if (categoryResult.rows.length > 0) {
            // If generic_name exists, use the existing category ID
            categoryId = categoryResult.rows[0].id;
        } else {
            // If generic_name doesn't exist, insert it into the Category table
            const categoryInsertResult = await db.query(`
    INSERT INTO Category (Generic_Name, Description) VALUES ($1, $2) RETURNING ID;
`, [generic_name, description]);


            categoryId = categoryInsertResult.rows[0].id;
        }

        // Insert data into the Drug table
       // Insert data into the Drug table
       const stripPrice=unitPrice*10;
const drugResult = await db.query(`
INSERT INTO Drug (Medicine_Name, Manufacturer_ID, Category_ID, Unit_Price, Strip_Price, Expire_Date, Manufacturing_Date, Quantity)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING ID;

`, [medicineName, manufacturerId, categoryId, unitPrice,stripPrice ,expireDate, manufacturingDate, quantity]);


        const drugId = drugResult.rows[0].id;
        console.log(drugId);

        // Insert additional data into the Additional_Info table
        /*await db.query(`
            INSERT INTO Additional_Info (Drug_ID, Supplier, Generic_Name)
            VALUES ($1, $2, $3);
        `, [drugId, supplier, generic_name]);*/

        res.redirect('/admin/viewdrugs');; // Redirect to the drug list after successful submission
    } catch (error) {
        console.error("Error adding medicine:", error);
        res.status(500).send("Internal Server Error");
    }
});
app.get('/updateMedicine/:id', async (req, res) => {
    try {
        const medicineId = req.params.id;

        const result = await db.query(`
            SELECT Drug.*, Drug_Manufacturer.Name
            FROM Drug
            JOIN Drug_Manufacturer ON Drug.Manufacturer_ID = Drug_Manufacturer.ID
            WHERE Drug.ID = $1;
        `, [medicineId]);

        if (result.rows.length === 0) {
            return res.status(404).send("Medicine not found");
        }

        const medicine = result.rows[0];
        res.render('updateMedicine', { medicine });
    } catch (error) {
        console.error("Error fetching medicine data:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/updateMedicine/:id', async (req, res) => {
    const { id } = req.params;
    const { newPrice } = req.body;
    const stripPrice= newPrice*10;

    try {
        await db.query(`
            UPDATE Drug SET Unit_Price = $1 WHERE ID = $2;
        `, [newPrice, id]);
        await db.query(`
        UPDATE Drug SET Strip_Price = $1 WHERE ID = $2;
    `, [stripPrice, id]);

        res.redirect('/admin/viewdrugs');
    } catch (error) {
        console.error("Error updating medicine price:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get('/deleteMedicine/:id', async (req, res) => {
    try {
        const medicineId = req.params.id;

        const result = await db.query(`
        DELETE FROM Drug  WHERE ID = $1;
        `, [medicineId]);
        console.log(result);

        if (result.rowCount === 0) {
            return res.status(404).send("Medicine not found");
        }

        res.redirect('/admin/viewdrugs?msg=Medicine%20deleted%20successfully');
    } catch (error) {
        console.error("Error deleting medicine:", error);
        res.status(500).send("Internal Server Error");
    }
});


// Import necessary dependencies and configurations

// Assuming you have a route for rendering categories.ejs
app.get('/admin/viewGenerics', async (req, res) => {
    try {
        // Fetch all categories from the database
        const categories = await db.query('SELECT * FROM Category;');

        // Render categories.ejs with the retrieved categories
        res.render('categoryInfo', { categories: categories.rows });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Route for showing medicines for a specific category
app.get('/category/:id', async (req, res) => {
    try {
        // Extract category ID from the URL parameters
        const categoryId = req.params.id;

        // Fetch medicines for the specified category from the database
        const medicines=await db.query(`SELECT Drug.*, Drug_Manufacturer.Name AS company
FROM Drug
JOIN Drug_Manufacturer ON Drug.Manufacturer_ID = Drug_Manufacturer.ID
WHERE Drug.Category_id = $1;`,[categoryId]);


        // Render a new EJS file (e.g., medicines.ejs) with the retrieved medicines
        res.render('medicines', { medicines: medicines.rows });
    } catch (error) {
        console.error("Error fetching medicines:", error);
        res.status(500).send("Internal Server Error");
    }
});


// Add these routes in your Express application

// GET route to view all suppliers
app.get('/admin/viewSuppliers', async (req, res) => {
    try {
        const suppliers = await db.query('SELECT * FROM DRUG_MANUFACTURER');
        res.render('viewSuppliers', { suppliers: suppliers.rows });
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).send('Internal Server Error');
    }
});

// POST route to handle supplier deletion
app.post('/admin/deleteSupplier/:id', async (req, res) => {
    try {
        const supplierId = req.params.id;
        const result = await db.query('DELETE FROM DRUG_MANUFACTURER WHERE ID = $1', [supplierId]);

        if (result.rowCount === 0) {
            return res.status(404).send('Supplier not found');
        }

        res.redirect('/admin/viewSuppliers');
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).send('Internal Server Error');
    }
});

// GET route to show the form for adding a new supplier
app.get('/admin/addSupplier', (req, res) => {
    res.render('addSupplier');
});

// POST route to handle the form submission for adding a new supplier
app.post('/admin/addSupplier', async (req, res) => {
    try {
        const { name, email, location } = req.body;

        // Validate input (you may want to add more validation)
        if (!name || !email || !location) {
            return res.status(400).send('Please provide all required fields');
        }

        // Insert new supplier into the database
        await db.query('INSERT INTO DRUG_MANUFACTURER (NAME, EMAIL, LOCATION) VALUES ($1, $2, $3)', [name, email, location]);

        res.redirect('/admin/viewSuppliers');
    } catch (error) {
        console.error('Error adding supplier:', error);
        res.status(500).send('Internal Server Error');
    }
});




/*app.get('/dashboard', async (req, res) => {
    try {
      // Query to get total medicines
      const medicinesResult = await db.query('SELECT COUNT(*) FROM drug');
      const totalMedicines = medicinesResult.rows[0].count;
  
      // Query to get total suppliers
      const suppliersResult = await db.query('SELECT COUNT(*) FROM drug_manufacturer');
      const totalSuppliers = suppliersResult.rows[0].count;

      const genericsResult=await db.query('SELECT COUNT(*) FROM CATEGORY');
      const totalGenerics=genericsResult.rows[0].count;
      const totalSales=0;
      const totalPurchases=0;
      const outOfStockMedicines=0;
  
      // ... (similar queries for other variables)
  
      // Determine the selected section based on the route or any other criteria
      const selectedSection = 'dashboard';
  
      // Render the 'adminDashboard.ejs' file with the data and selected section
      res.render('adminDashboard', { totalMedicines, totalSuppliers, totalGenerics,totalSales,totalPurchases,outOfStockMedicines});
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).send('Internal Server Error');
    }
  });*/
  