const express = require('express');
const PDFDocument = require('pdfkit');
const path = require('path');
const db = require('./db');
const bodyParser = require('body-parser');
const session = require('express-session');
const { body, validationResult } = require('express-validator');

const bcrypt = require('bcrypt');



const app = express();


const crypto = require('crypto');
const { render, name } = require('ejs');
const { Console } = require('console');

// Generate a strong session secret
app.use(express.urlencoded({ extended: true }));


const port = process.env.PORT || 4555;

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
    res.render('At_First');
  
});
app.get('/login', async (req, res) => {  
    res.render('login');
});
app.get('/pharma_login', async (req, res) => {  
    res.render('pharma_login');
});
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Check if password is exactly 8 characters
    if (password.length !== 8) {
      return res.render('login', { errorMessage: 'Wrong password length. Password must be 8 characters.' });
    }
  
    // Check if password matches the predefined password (12345678)
    if (password !== '12345678') {
      return res.render('login', { errorMessage: 'Wrong password. Please try again.' });
    }
    res.redirect('/first_page');
  });
  

app.get('/first_page', async (req, res) => {
    try {
        // Fetch data from the database
        const pharmacyDataResult = await db.query('SELECT pda.pharmacy_id, p.name as pharmacy_name, SUM(pda.customer_order) AS total_sell FROM pharmacy p JOIN pharmacy_drug_association pda ON p.id = pda.pharmacy_id GROUP BY pda.pharmacy_id, p.name');

        // Extract rows from the result object
        const pharmacyData = pharmacyDataResult.rows;

        // Extract labels, pharmacy names, and data for the chart
        const labels = pharmacyData.map(entry => entry.pharmacy_id);
        const pharmacyNames = pharmacyData.map(entry => entry.pharmacy_name);
        const data = pharmacyData.map(entry => entry.total_sell);

        // Render the 'first_page.ejs' template and pass the data
        res.render('first_page', { labels: labels, pharmacyNames: pharmacyNames, data: data });
    } catch (error) {
        console.error("Error fetching pharmacy data:", error);
        res.status(500).send("Internal Server Error");
    }
});



app.get('/pharma_signup', async (req, res) => {
    
    res.render('pharma_signup');
});
app.post('/pharma_signup', async (req, res) => {
    const pharmacyName = req.body.pharmacyName;

    try {
        const insertQuery = 'INSERT INTO pharmacy (name) VALUES ($1) RETURNING *';
        const result = await db.query(insertQuery, [pharmacyName]);
        
        // Redirect to the AT_First page after successful signup
        res.render('At_First');
    } catch (error) {
        console.error('Error processing pharmacy signup:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/show_drugs', async (req, res) => {
    try {
        let drugs;
        

        // Check if there is a search query parameter
     
            // If no search query, fetch all medicines
            drugs = await db.query(`
                SELECT Drug_Square.*, Category.Description as descp, Category.Generic_Name as gn
                FROM Drug_Square
                JOIN CATEGORY ON Drug_Square.Category_ID=Category.ID;
            `);

       // console.log(drugs);
        
        res.render('show_drugs', { drugs: drugs.rows, msg: req.query.msg });
    } catch (error) {
        console.error("Error fetching medicine data:", error);
        res.status(500).send("Internal Server Error");
    }
});
app.get('/update_medicine/:id', async(req, res) => {
    // Retrieve the medicine details based on the provided ID
    try {
        const medicineId = req.params.id;
        // Fetch the drug information from the database using the ID
        const result = await db.query('SELECT * FROM Drug_Square WHERE id = $1', [medicineId]);
        const drug = result.rows[0];
    
        // Render the update_medicine.ejs file with the drug information
        res.render('update_medicine', { drug });
      } catch (error) {
        console.error('Error fetching drug for update:', error);
        res.status(500).send('Internal Server Error');
      }
});

app.get('/update_date/:id', async(req, res) => {
    // Retrieve the medicine details based on the provided ID
    try {
        const medicineId = req.params.id;
        // Fetch the drug information from the database using the ID
        const result = await db.query('SELECT * FROM Drug_Square WHERE id = $1', [medicineId]);
        const drug = result.rows[0];
    
        // Render the update_medicine.ejs file with the drug information
        res.render('update_date', { drug });
      } catch (error) {
        console.error('Error fetching drug for update:', error);
        res.status(500).send('Internal Server Error');
      }
});

// Update Medicine route
// Update Expiration and Manufacturing Date route
app.post('/update_date/:id', async (req, res) => {
    const medicineId = req.params.id;
    const { expire_date, manufacturing_date } = req.body;
  
    try {
      // Fetch the current medicine information from the database
      const fetchQuery = 'SELECT * FROM Drug_Square WHERE id = $1';
      const fetchResult = await db.query(fetchQuery, [medicineId]);
      const currentMedicine = fetchResult.rows[0];
  
      // Validate manufacturing date and expiration date if they change
      if (
        manufacturing_date !== currentMedicine.manufacturing_date ||
        expire_date !== currentMedicine.expire_date
      ) {
        const expireDate = new Date(expire_date);
        const manufacturingDate = new Date(manufacturing_date);
  
        if (manufacturingDate >= expireDate) {
          // Manufacturing date should be less than the expiration date
          return res.redirect(`/update_date/${medicineId}?error=date`);
        }
      }
  
      // Update only the expiration and manufacturing date in the database
      const updateQuery = `
        UPDATE Drug_Square
        SET
          expire_date = $1,
          manufacturing_date = $2
        WHERE id = $3
      `;
  
      const values = [expire_date, manufacturing_date, medicineId];
  
      await db.query(updateQuery, values);
  
      // Redirect to the show_drugs page or any other page you want
      res.redirect('/show_drugs');
    } catch (error) {
      console.error('Error updating expiration and manufacturing date:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
// Update Medicine route
app.post('/update_medicine/:id', async (req, res) => {
    const medicineId = req.params.id;
    const {
      medicine_name,
      category_id,
      strip_price,
      unit_price,
      quantity,
      remedies,
    } = req.body;
  
    try {
      // Fetch the current medicine information from the database
      const fetchQuery = 'SELECT * FROM Drug_Square WHERE id = $1';
      const fetchResult = await db.query(fetchQuery, [medicineId]);
      const currentMedicine = fetchResult.rows[0];
  
      // Update the medicine in the database
      const updateQuery = `
        UPDATE Drug_Square
        SET
          medicine_name = $1,
          category_id = $2,
          strip_price = $3,
          unit_price = $4,
          quantity = $5,
          remedies = $6
        WHERE id = $7
      `;
  
      const values = [
        medicine_name,
        category_id,
        strip_price,
        unit_price,
        quantity,
        remedies,
        medicineId,
      ];
  
      await db.query(updateQuery, values);
  
      // Redirect to the show_drugs page or any other page you want
      res.redirect('/show_drugs');
    } catch (error) {
      console.error('Error updating medicine:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  
app.get('/add_medicine', async (req, res) => {
    try {
        // Fetch all medical representatives for the dropdown
        const representatives = await db.query('SELECT id, name FROM medical_representative');

        // Render the add_medicine.ejs page with the representatives data
        res.render('add_medicine', { representatives: representatives.rows });
    } catch (error) {
        console.error("Error fetching medical representatives:", error);
        res.status(500).send("Internal Server Error");
    }
});

  app.post('/add_medicine', async (req, res) => {
    try {
        // Extract form data
        const {
            medicineName,
            unitPrice,
            expireDate,
            manufacturingDate,
            quantity,
            description,
            generic_name,
            remedies, // Add remedies to the list of extracted variables
            representative
        } = req.body;

        // Check if generic_name already exists in the Category table
        const categoryResult = await db.query(`
            SELECT ID FROM Category WHERE Generic_Name = $1;
        `, [generic_name]);

        let categoryId;

        if (categoryResult.rows.length > 0) {
            // If generic_name exists, use the existing category ID
            categoryId = categoryResult.rows[0].id;
            console.log('found');
        } else {
            // If generic_name doesn't exist, insert it into the Category table
            const categoryInsertResult = await db.query(`
                INSERT INTO Category (Generic_Name, Description) VALUES ($1, $2) RETURNING ID;
            `, [generic_name, description]);
            console.log(' not found');

            categoryId = categoryInsertResult.rows[0].id;
        }

        // Calculate Strip Price based on Unit Price
        const stripPrice = unitPrice * 10;

        // Insert data into the Drug_Square table
        const drugResult = await db.query(`
            INSERT INTO Drug_Square (Medicine_Name, Category_ID, Unit_Price, Strip_Price, Expire_Date, Manufacturing_Date, Quantity, Remedies,representative_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9)
            RETURNING ID;
        `, [medicineName, categoryId, unitPrice, stripPrice, expireDate, manufacturingDate, quantity, remedies,representative]);

        const drugId = drugResult.rows[0].id;
        console.log('Inserted drug with ID:', drugId);

        res.redirect('/show_drugs'); // Redirect to the drug list after successful submission
    } catch (error) {
        console.error("Error adding medicine:", error);
        res.status(500).send("Internal Server Error");
    }
});


////ADVANCE QUERY--JOIN (4 TABLES)

///JOIN (4 TABLES)


app.get('/medical_representatives', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                mr.id AS rep_id,
                mr.name,
                mr.designation,
                  p.id AS pharmacy_id,
                p.name AS pharmacy_name,
                d.id AS drug_id,
                d.medicine_name
            FROM medical_representative mr
            JOIN pharmacy_medical_representative pmr ON mr.id = pmr.representative_id
            JOIN pharmacy p ON pmr.pharmacy_id = p.id
            LEFT JOIN drug_square d ON mr.id = d.representative_id
        `);

        const representatives = [];
        
        // Organize data into a structured format
        result.rows.forEach(row => {
            const existingRep = representatives.find(rep => rep.id === row.rep_id);

            if (!existingRep) {
                const newRep = {
                    id: row.rep_id,
                    name: row.name,
                    designation: row.designation,
                    pharmacies: [{ id: row.pharmacy_id, name: row.pharmacy_name }],
                    medicines: []
                };

                if (row.drug_id) {
                    newRep.medicines.push({
                        medicine_name: row.medicine_name
                    });
                }

                representatives.push(newRep);
            } else {
                // Check if the pharmacy is not already in the list
                if (!existingRep.pharmacies.find(pharmacy => pharmacy.id === row.pharmacy_id)) {
                    existingRep.pharmacies.push({
                        id: row.pharmacy_id,
                        name: row.pharmacy_name
                    });
                }

                if (row.drug_id) {
                    existingRep.medicines.push({
                        medicine_name: row.medicine_name
                    });
                }
            }
        });

        res.render('medical_representatives', { representatives });
    } catch (error) {
        console.error("Error fetching medical representatives:", error);
        res.status(500).send("Internal Server Error");
    }
});



app.get('/show_medicine_pharma', async (req, res) => {
    const pharmacyName = req.query.pharmacyName;
    console.log(pharmacyName);

    

        const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
        const result1 = await db.query(query1, [pharmacyName]);
        const pharmacyId = result1.rows[0].id;

const query = `
SELECT ds.*, c.generic_name,pda.amount_od_drug
FROM Drug_Square ds
JOIN Pharmacy_Drug_Association pda ON ds.id = pda.drug_id
JOIN Category c ON ds.category_id = c.id
WHERE pda.pharmacy_id = $1
`;

const result = await db.query(query, [pharmacyId]);
//WHERE pda.pharmacy_id = $1
const drugs = result.rows;
//console.log('Pharmacy ID:', pharmacyId);
//const result = await db.query(query, [pharmacyId]);

try {

    console.log('Medicines:',drugs);

    res.render('show_medicine_pharma', { pharmacyName: pharmacyName, drugs });
    console.log('hivskhbjs');
} catch (error) {
    console.error('Error fetching medicine information:', error);
    res.status(500).send('Internal Server Error');
}
    


});


app.get('/show_generics', async (req, res) => {
    const pharmacyName = req.query.pharmacyName;
    console.log(pharmacyName);

    const searchQuery = req.query.search; // Get the search query from the request

    const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
    const result1 = await db.query(query1, [pharmacyName]);

    if (result1.rows.length === 0) {
        // Handle case where no pharmacy is found with the provided name
        console.error('No pharmacy found with the name:', pharmacyName);
        return res.status(404).send('Pharmacy not found');
    }

    const pharmacyId = result1.rows[0].id;

    let query = `
        SELECT  c.generic_name,c.description,pda.amount_od_drug
        FROM Drug_Square ds
        JOIN Pharmacy_Drug_Association pda ON ds.id = pda.drug_id
        JOIN Category c ON ds.category_id = c.id
        WHERE pda.pharmacy_id = $1
    `;

    const params = [pharmacyId];

    

    try {
        const result = await db.query(query, params);
        const categories = result.rows;

        console.log('Medicines:', categories);

        res.render('categoryInfo_pharmacy', { pharmacyName: pharmacyName, categories });
        console.log('hivskhbjs');
    } catch (error) {
        console.error('Error fetching medicine information:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/show_medicines', async (req, res) => {
    const pharmacyName = req.query.pharmacyName;
    console.log(pharmacyName);

    const searchQuery = req.query.search; // Get the search query from the request

    const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
    const result1 = await db.query(query1, [pharmacyName]);

    if (result1.rows.length === 0) {
        // Handle case where no pharmacy is found with the provided name
        console.error('No pharmacy found with the name:', pharmacyName);
        return res.status(404).send('Pharmacy not found');
    }

    const pharmacyId = result1.rows[0].id;

    let query = `
        SELECT ds.*, c.generic_name,pda.amount_od_drug
        FROM Drug_Square ds
        JOIN Pharmacy_Drug_Association pda ON ds.id = pda.drug_id
        JOIN Category c ON ds.category_id = c.id
        WHERE pda.pharmacy_id = $1
    `;

    const params = [pharmacyId];

    // If search query is provided, add filter condition to the query
    if (searchQuery) {
        query += ` AND ds.medicine_name ILIKE $2`; // Assuming you want to filter by medicine name (case-insensitive)
        params.push(`%${searchQuery}%`); // Append search query to the parameters
    }

    try {
        const result = await db.query(query, params);
        const drugs = result.rows;

        console.log('Medicines:', drugs);

        res.render('show_medicines', { pharmacyName: pharmacyName, drugs });
        console.log('hivskhbjs');
    } catch (error) {
        console.error('Error fetching medicine information:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/show_purchase', async (req, res) => {

    const pharmacyName = req.query.pharmacyName;
    console.log('Pharmacy Name:', pharmacyName);

    
    try {

        const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
        const result1 = await db.query(query1, [pharmacyName]);

        // Check if any rows were returned
        if (result1.rows.length > 0) {
            const pharmacyId = result1.rows[0].id;
        // Fetch data from the backup_table_temp_order_pharma table
        const query = `
            SELECT 
                b.*, 
                d.medicine_name, 
                c.generic_name AS drug_generics
            FROM 
                backup_table_temp_order_pharma b
            JOIN 
            Drug_Square d ON b.drug_id = d.id
            JOIN 
                category c ON d.category_id = c.id
            WHERE 
                b.pharmacy_id = $1`;

        const result = await db.query(query, [pharmacyId]);

        // Extract the purchases from the query result
        const purchases = result.rows;

        // Render the view to display the purchases
        res.render('show_purchase',  { pharmacyName,purchases });
    } else {
        // No pharmacy found with the provided name
        res.status(404).send('Pharmacy not found');
    } 
}catch (error) {
        console.error('Error fetching purchase information:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/view_sales', async (req, res) => {
    const pharmacyName = req.query.pharmacyName;
    console.log('Pharmacy Name:', pharmacyName);

    try {
        // Fetch pharmacy ID based on the provided name
        const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
        const result1 = await db.query(query1, [pharmacyName]);

        // Check if any rows were returned
        if (result1.rows.length > 0) {
            const pharmacyId = result1.rows[0].id;

            // Fetch sales data from done_purchased_medicines_backup table
            const query = `
                SELECT 
                    d.*, 
                    m.medicine_name, 
                    c.generic_name AS drug_generics,current_timestamp AS sale_date
                FROM 
                    done_purchased_medicines_backup d
                JOIN 
                    Drug_Square m ON d.drug_id = m.id
                JOIN 
                    category c ON m.category_id = c.id
                WHERE 
                    d.pharmacy_id = $1`;

            const result = await db.query(query, [pharmacyId]);

            // Extract the sales from the query result
            const sales = result.rows;

            // Render the view to display the sales
            res.render('show_sales', { pharmacyName, sales });
        } else {
            // No pharmacy found with the provided name
            res.status(404).send('Pharmacy not found');
        }
    } catch (error) {
        console.error('Error fetching sales information:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/order_req', async (req, res) => {
    try {
        const query = `
            SELECT tor.id, tor.pharmacy_id, tor.drug_id, tor.count, tor.total_price,
            p.name AS pharmacy_name, ds.Medicine_Name AS medicine_name
            FROM temp_order_pharma tor
            JOIN pharmacy p ON tor.pharmacy_id = p.id
            JOIN Drug_Square ds ON tor.drug_id = ds.ID
        `;

        const result = await db.query(query);
        const orders = result.rows;
console.log(orders);
        res.render('order_req', { orders });
    } catch (error) {
        console.error('Error fetching order requests:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/my_pharmacies', async (req, res) => {
    const representativeId = req.query.representativeId;
    console.log('^^^^^^^^^^^');
console.log(representativeId);
    try {
        // Fetch pharmacies associated with the representative from pharmacy_medical_representative table
        // Join pharmacy, medical_representative, and pharmacy_medical_representative tables
        const query1 = `
            SELECT pharmacy.*, medical_representative.id AS rep_id
            FROM pharmacy
            JOIN pharmacy_medical_representative ON pharmacy.id = pharmacy_medical_representative.pharmacy_id
            JOIN medical_representative ON pharmacy_medical_representative.representative_id = medical_representative.id
            WHERE pharmacy_medical_representative.representative_id = $1`;

            const result1 = await db.query(query1, [representativeId]);
            const query = 'select * from pharmacy';

        const result = await db.query(query);

        const pharmacies = result.rows;
       // console.log(pharmacies);
console.log(pharmacies);
        res.render('my_pharmacies', { pharmacies ,representativeId});
    } catch (error) {
        console.error('Error fetching pharmacies:', error);
        res.status(500).send('Internal Server Error');
    }
 });


 app.get('/advertise_mr', async (req, res) => {
    try {
        const pharmacyName = req.query.pharmacyName;

        // Fetch all advertises for a specific pharmacy along with additional information
        const query = `
            SELECT
                a.advertises,
                m.name AS representative_name,
                d.Medicine_Name AS medicine_name,
                c.generic_name,
                d.strip_price,d.id AS d_id
            FROM
                advertise a
            JOIN
                medical_representative m ON a.medical_representative_id = m.id
            JOIN
                drug_square d ON a.drug_id = d.ID
            JOIN 
            
                Category c ON d.category_id = c.id
            WHERE
                a.pharmacy_id = (SELECT id FROM pharmacy WHERE name = $1)
        `;
        const result = await db.query(query, [pharmacyName]);
        const advertises = result.rows;

        res.render('advertise_mr', { advertises, pharmacyName });
    } catch (error) {
        console.error('Error fetching advertises:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/pharmacy_view', async (req, res) => {
    const pharmacyId = req.query.pharmacyId;
    console.log(pharmacyId);
    const customerId = req.query.customerId;
    try {
        const pharmacyQuery = 'SELECT name FROM pharmacy WHERE id = $1';
        const pharmacyResult = await db.query(pharmacyQuery, [pharmacyId]);
        const pharmacyName = pharmacyResult.rows[0].name;
        console.log(pharmacyName);
        // Fetch total count of medicines for the given pharmacy
        const medicineCountQuery = 'SELECT COUNT(*) FROM Pharmacy_Drug_Association WHERE pharmacy_id = $1';
        const medicineCountResult = await db.query(medicineCountQuery, [pharmacyId]);
        const totalMedicineCount = medicineCountResult.rows[0].count;

        // Fetch total count of distinct categories for the given pharmacy
        const categoryCountQuery = `
            SELECT COUNT(DISTINCT DS.Category_ID)
            FROM Drug_Square DS
            WHERE DS.ID IN (
                SELECT PDA.drug_id
                FROM Pharmacy_Drug_Association PDA
                WHERE PDA.pharmacy_id = $1
            );
        `;
        const categoryCountResult = await db.query(categoryCountQuery, [pharmacyId]);
        const totalCategoryCount = categoryCountResult.rows[0].count;

        // Fetch total sell information for the given pharmacy (replace this with your actual logic)
        const totalSell = 0; // Replace with your logic to fetch total sell information

        // Render pharmacy_view.ejs with the total counts and total sell
        res.render('pharmacy_view', {
            totalMedicineCount,
            totalCategoryCount,
            totalSell,
            pharmacyId,
            pharmacyName,
            customerId
        });
    } catch (error) {
        console.error('Error fetching pharmacy data:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/category_details', async (req, res) => {
    try {
        const customerId=req.query.customerId;
        const categoryId = req.query.categoryId;
        const pharmacyId = req.query.pharmacyId;
console.log('**********************');
console.log(customerId);
console.log('*******************');
        // Fetch all drugs of the specified category and pharmacy
        const query = `
            SELECT *
            FROM Drug_Square
            WHERE category_id = $1
                AND ID IN (
                    SELECT drug_id
                    FROM Pharmacy_Drug_Association
                    WHERE pharmacy_id = $2
                );
        `;

        const result = await db.query(query, [categoryId, pharmacyId]);
        const drugs = result.rows;

        // Render the category_details.ejs file with the list of drugs
        res.render('category_details', { drugs, pharmacyId, categoryId ,customerId});
    } catch (error) {
        console.error('Error fetching category details:', error);
        res.status(500).send('Internal Server Error');
    }
});

/////////////PROCEDURE

////////procedure to DELETE representative



app.get('/delete_representative/:id', async (req, res) => {
    const repId = req.params.id;
    
    try {
        // Call the stored procedure to delete the representative and their associations
        const deleteProcedure = 'CALL delete_representative_and_associations($1)';
        await db.query(deleteProcedure, [repId]);
        
        res.send('Representative deleted successfully');
    } catch (error) {
        console.error('Error deleting representative:', error);
        res.status(500).send('Internal Server Error');
    }
});

////////////////procedure to ADD representative
app.post('/add_mr', async (req, res) => {
    try {
        const { name, designation, salary, pharmacies } = req.body;
        const salary1 = parseInt(salary);

        // Call the stored procedure to add the medical representative
        await db.query('CALL add_medical_representative($1, $2, $3, $4)', [name, designation, salary1, pharmacies]);

        res.redirect('/medical_representatives'); // Redirect to the home page after successful submission
    } catch (error) {
        console.error("Error adding medical representative:", error);
        res.status(500).send("Internal Server Error");
    }
});

//////////FUNCTION //////////

app.post('/update_cart', async (req, res) => {
    try {
        const customerId = parseInt(req.body.customerId);
        const medicineId = parseInt(req.body.medicineId);
        const pharmacyId = parseInt(req.body.pharmacyId);
        const updateQuantity = parseInt(req.body.updateQuantity);

        // Check if the update quantity is valid
        if (!isNaN(updateQuantity) && updateQuantity >= 0) {
            // Call the stored function to update cart quantity
            await db.query('SELECT update_cart_quantity($1, $2, $3, $4)', [customerId, medicineId, pharmacyId, updateQuantity]);

            console.log('Updated cart quantity successfully.');
            res.send('Updated cart quantity successfully.');
        } else {
            console.log('Invalid update quantity.');
            res.status(400).send('Invalid update quantity.');
        }
    } catch (error) {
        console.error('Error updating cart quantity:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Add this route in your server code
app.post('/delete_cart', async (req, res) => {
    try {
        const customerId = req.body.customerId;
        const medicineId = req.body.medicineId;
        const pharmacyId = req.body.pharmacyId;

        // Call the stored function to delete from the cart
        await db.query('SELECT delete_cart($1, $2, $3)', [customerId, medicineId, pharmacyId]);

        res.send('Deleted medicine from cart successfully.');
    } catch (error) {
        console.error('Error deleting medicine from cart:', error);
        res.status(500).send('Internal Server Error');
    }
});


////TRIGGER //////////


///////////////////////////////////////////////////

app.post('/order_req', async (req, res) => {
    console.log('^^^^^^^^^^^^^^^^^^^^^');

    const pharmacyId = req.body.pharmacyId;
    const drugId = req.body.drugId;
    const count1 = parseInt(req.body.count);
    const sell = parseFloat(req.body.totalPrice);
    console.log(pharmacyId);
    console.log(drugId);
    console.log(count1);
    console.log(sell);
      // Use totalPrice instead of undefined variable
    console.log('^^^^^^^^^^^^^^^^^^^^^');
    try { 
        const checkQuery1 = 'SELECT * FROM Drug_Square WHERE ID= $1';
        const checkResult1 = await db.query(checkQuery1, [drugId]);
        let temp_total_sell = parseFloat(checkResult1.rows[0].total_sell);
        let temp_drug_out = parseInt(checkResult1.rows[0].total_drug_out);
        console.log(sell);
        console.log('^^^^^^^^^^^^^^^^^^^^^');
        const checkQuery = 'SELECT * FROM Pharmacy_Drug_Association WHERE pharmacy_id = $1 AND drug_id = $2';
        const checkResult = await db.query(checkQuery, [pharmacyId, drugId]);
         
        if (checkResult.rows.length > 0) {

            let temp = parseInt(checkResult.rows[0].amount_od_drug);
            temp = temp + parseInt(count1);
            let temp2=parseFloat(checkResult.rows[0].total_sell_med);
            temp2 = temp2 + parseFloat(sell);
            temp_total_sell = temp_total_sell +parseFloat(sell);
            temp_drug_out = temp_drug_out + count1;
            console.log('^^^^^^^^^',temp_total_sell);
            console.log(temp_drug_out);
            console.log('^^^^^^^^^',temp_total_sell);
           
            const updateQuery11 = 'UPDATE Drug_Square SET total_sell = $1 WHERE  ID = $2';
            await db.query(updateQuery11, [temp_total_sell, drugId]);
          
           const updateQuery12 = 'UPDATE Drug_Square SET total_drug_out = $1 WHERE  ID = $2';
         await db.query(updateQuery12, [temp_drug_out, drugId]);
        
            const updateQuery = 'UPDATE Pharmacy_Drug_Association SET amount_od_drug = $1 WHERE pharmacy_id = $2 AND drug_id = $3';
            await db.query(updateQuery, [temp, pharmacyId, drugId]);
            console.log('^^^^^^^^^^^^^^^^^^^^^sadia');
            const updateQuery2 = 'UPDATE Pharmacy_Drug_Association SET total_sell_med = $1 WHERE pharmacy_id = $2 AND drug_id = $3';
            await db.query(updateQuery2, [temp2, pharmacyId, drugId]);
            
           




        } else {
            const insertQuery = 'INSERT INTO Pharmacy_Drug_Association (pharmacy_id, drug_id, amount_od_drug,total_sell_med) VALUES ($1, $2, $3,$4)';
            await db.query(insertQuery, [pharmacyId, drugId, count1,sell]);
            temp_total_sell = temp_total_sell +parseFloat(sell);
           
            temp_drug_out = temp_drug_out + count1;
         console.log(temp_total_sell);
          console.log(temp_drug_out);
          
            const updateQuery11 = 'UPDATE Drug_Square SET total_sell = $1 WHERE  ID = $2';
await db.query(updateQuery11, [temp_total_sell, drugId]);
console.log('^^^^^^^^^^^^^^^^^^^^^234');
const updateQuery12 = 'UPDATE Drug_Square SET total_drug_out = $1 WHERE  ID = $2';
await db.query(updateQuery12, [temp_drug_out, drugId]);

        }


        res.redirect('/first_page');
    } catch (error) {
        console.error('Error processing buy request:', error);
        res.status(500).send('Internal Server Error');
    }
});


// GET method for rendering the add_mr.ejs page
app.get('/add_mr', async (req, res) => {
    try {
        // Fetch all pharmacies for the dropdown
        const pharmacies = await db.query('SELECT id, name FROM pharmacy');

        // Render the add_mr.ejs page with the pharmacies data
        res.render('add_mr', { pharmacies: pharmacies.rows });
    } catch (error) {
        console.error("Error fetching pharmacies:", error);
        res.status(500).send("Internal Server Error");
    }
});






// POST method for handling the form submission

app.get('/pharmacies_', async (req, res) => {
    try {
        // Fetch all pharmacies with id, name, and photo_path
        const pharmacies = await db.query('SELECT id, name, photo_path FROM pharmacy');

        // Render the pharmacies.ejs page with the pharmacies data
        res.render('pharmacies_', { pharmacies: pharmacies.rows });
    } catch (error) {
        console.error("Error fetching pharmacies:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Assuming you have Express set up

app.get('/delete_pharmacy/:id', async (req, res) => {
    const pharmacyId = req.params.id;

    try {
        // Perform a cascading delete to remove entries from pharmacy_medical_representative
        await db.query('DELETE FROM pharmacy_medical_representative WHERE pharmacy_id = $1', [pharmacyId]);

        // Now, delete the pharmacy from the pharmacy table
        await db.query('DELETE FROM pharmacy WHERE id = $1', [pharmacyId]);

        res.status(200).send('Pharmacy deleted successfully');
       // res.redirect('/pharmacies');
    } catch (error) {
        console.error('Error deleting pharmacy:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/pharma_login', async (req, res) => {
    const { pharmacyName } = req.body;

    try {
        // Query to check if pharmacyName matches any name in the pharmacy table
        const query = 'SELECT * FROM pharmacy WHERE name = $1';
        const result = await db.query(query, [pharmacyName]);

        if (result.rows.length > 0) {
            // If a match is found, redirect to pharma_first.ejs
            res.redirect('/pharma_first?pharmacyName=' + pharmacyName);
        } else {
            // If no match is found, show an error or handle accordingly
            res.render('pharma_login', { errorMessage: 'Invalid pharmacy name' });
        }
    } catch (error) {
        console.error('Error checking pharmacy name:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/pharma_first', async (req, res) => {
    try {
        const pharmacyName = req.query.pharmacyName;
        console.log(pharmacyName);
        //res.render('pharma_first', { pharmacyName });
        res.render('pharmacy_home',{ pharmacyName: pharmacyName });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Assuming you have already set up your database connection (db)



app.get('/show_dashboard', async (req, res) => {
    const pharmacyName = req.query.pharmacyName;
    console.log(pharmacyName);
    
    const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
    const result1 = await db.query(query1, [pharmacyName]);
    const pharmacyId = result1.rows[0].id;
    
    try {
        // Query the database to get the total number of medicines
        const medicinesResult = await db.query(`SELECT COUNT(*)  FROM drug_square ds JOIN pharmacy_drug_association pda ON ds.id = pda.drug_id WHERE pda.pharmacy_id = $1`, [pharmacyId]);
        const totalMedicines = medicinesResult.rows[0].count;
    
        // Query the database to get the total number of generics
        const genericsResult = await db.query('SELECT COUNT(*) FROM Drug_Square ds JOIN Pharmacy_Drug_Association pda ON ds.id = pda.drug_id JOIN Category c ON ds.category_id = c.id WHERE pda.pharmacy_id = $1', [pharmacyId]);
        const totalGenerics = genericsResult.rows[0].count;
    
        // Query the database to get the total number of purchases
        const purchasesResult = await db.query('SELECT COUNT(*)  FROM backup_table_temp_order_pharma WHERE pharmacy_id = $1', [pharmacyId]);
        const totalPurchases = purchasesResult.rows[0].count;
         console.log(totalPurchases);
         console.log(totalGenerics);
         console.log(totalMedicines);
        // Query the database to get the total number of sales
        const salesResult = await db.query('SELECT COUNT(*)  FROM done_purchased_medicines_backup WHERE pharmacy_id = $1', [pharmacyId]);
        const totalSales = salesResult.rows[0].count;
    
        console.log(totalSales);
        // Render the dashboard view with the retrieved data
        res.render('dashboard', {
            pharmacyName,
            totalMedicines,
            totalGenerics,
            totalPurchases,
            totalSales
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).send('Internal Server Error');
    }
});




  
app.get('/buy_medicine', async (req, res) => {
    const pharmacyName = req.query.pharmacyName;
    console.log(pharmacyName);

    try {
        const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
        const result1 = await db.query(query1, [pharmacyName]);

        // Check if result1.rows is empty or not
        if (result1.rows.length === 0) {
            throw new Error('Pharmacy not found');
        }

        const pharmacyId = result1.rows[0].id;

        const query = `
            SELECT ds.*, c.generic_name, c.description
            FROM Drug_Square ds
            JOIN Category c ON ds.category_id = c.id
        `;
        
        const result = await db.query(query);
        const medicines = result.rows;

        console.log('Medicines:', medicines);

        res.render('buy_medicine', { pharmacyName, medicines });
    } catch (error) {
        console.error('Error fetching medicine information:', error);
        res.status(500).send('Internal Server Error');
    }
});




app.post('/buy_medicine', async (req, res) => {
    const pharmacyName = req.body.pharmacyName;
   
    console.log('Pharmacy Name:', pharmacyName);

    // Get pharmacy ID based on the current user or session
    const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
    const result1 = await db.query(query1, [pharmacyName]);
    const pharmacyId = result1.rows[0].id;

    try {
        // Loop through the form fields to extract drug information
        const drugEntries = Object.entries(req.body).filter(([key, value]) => key.startsWith('count_') && parseInt(value) > 0);
        console.log(' e db n*************************');

        // Insert data into temp_order_pharma table
        for (const [key, count] of drugEntries) {
            const drugId = parseInt(key.replace('count_', ''));
            const drug = await getDrugInfo(drugId);

            if (drug) {
                const total_price = drug.strip_price * count;
                console.log(' *************************');

                const insertQuery = 'INSERT INTO temp_order_pharma (pharmacy_id, drug_id, count, total_price) VALUES ($1, $2, $3, $4)';
                await db.query(insertQuery, [pharmacyId, drugId, count, total_price]);
            }
        }
        res.redirect('/pharma_first'); // Redirect to the pending_orders page or any other page as needed
        //res.redirect('/order_req'); // Redirect to the pending_orders page or any other page as needed
    } catch (error) {
        console.error('Error processing buy request:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/buy_medicine1', async (req, res) => {
    console.log('^^^^^^^^^^^^^^^^^');
    const pharmacyName = req.body.pharmacyName;
    const drugId = req.body.drugId;
    const quantity = req.body.quantity;
    console.log(pharmacyName);
    console.log(drugId);
    console.log(quantity);
    console.log('^^^^^^^^^^^^^^^^^');
    try {
        // Get pharmacy ID based on the current user or session
        const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
        const result1 = await db.query(query1, [pharmacyName]);
        const pharmacyId = result1.rows[0].id;
console.log(pharmacyId);
  console.log('^^^^^^^^^^^^^^^^^');
        // Get strip price based on the provided drug ID
        const query2 = 'SELECT strip_price FROM drug_square WHERE ID = $1';
        const result2 = await db.query(query2, [drugId]);
        const stripPrice = result2.rows[0].strip_price;
console.log(stripPrice);
console.log('^^^^^^^^^^^^^^^^^');
        // Calculate total price
        const totalPrice = stripPrice * quantity;
console.log(totalPrice);
console.log('^^^^^^^^^^^^^^^^^');
        // Insert data into temp_order_pharma table
        const insertQuery = 'INSERT INTO temp_order_pharma (pharmacy_id, drug_id, count, total_price) VALUES ($1, $2, $3, $4)';
        await db.query(insertQuery, [pharmacyId, drugId, quantity, totalPrice]);
        console.log('^^^^^^^^^^^^^^^^^');

        res.redirect('/pharma_first'); // Redirect to the pending_orders page or any other page as needed
    } catch (error) {
        console.error('Error processing buy request:', error);
        res.status(500).send('Internal Server Error');
    }
});





// Import necessary modules and setup database connection

// Import necessary modules and setup database connection

app.get('/purchase_data', async (req, res) => {
    const pharmacyName = req.query.pharmacyName;

    try {
        const query1 = 'SELECT id FROM pharmacy WHERE name = $1';
        const result1 = await db.query(query1, [pharmacyName]);

        if (result1.rows.length > 0) {
            const pharmacyId = result1.rows[0].id;

            // Calculate the start time for the last 24 hours
            const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Query to fetch purchase amounts in the last 24 hours
            const query = `
                SELECT SUM(total_price) AS amount, DATE_TRUNC('hour', purchase_date) AS hour
                FROM backup_table_temp_order_pharma
                WHERE pharmacy_id = $1 AND purchase_date >= $2
                GROUP BY hour
                ORDER BY hour`;

            const result = await db.query(query, [pharmacyId, startTime]);

            // Extract amounts and corresponding labels (hours) from the query result
            const amounts = result.rows.map(row => row.amount);
            const labels = result.rows.map(row => row.hour);

            res.json({ amounts, labels });
        } else {
            res.status(404).send('Pharmacy not found');
        }
    } catch (error) {
        console.error('Error fetching purchase data:', error);
        res.status(500).send('Internal Server Error');
    }
});




// Assuming you have already set up your database connection (db)

async function getDrugInfo(drugId) {
    try {
        const query = 'SELECT * FROM Drug_Square WHERE id = $1';
        const result = await db.query(query, [drugId]);

        if (result.rows.length > 0) {
            // Assuming the query returns a single drug based on the drugId
            return result.rows[0];
        } else {
            // Drug not found
            console.log(`Drug with ID ${drugId} not found.`);
            return null;
        }
    } catch (error) {
        console.error('Error getting drug information:', error);
        throw error;
    }
}

app.post('/delete_order', async (req, res) => {
    const pharmacyId = req.body.pharmacyId;
    const drugId = req.body.drugId;

    try {
        // Delete the order from temp_order_pharma
        await db.query('DELETE FROM temp_order_pharma WHERE temp_order_pharma.pharmacy_id = $1 AND temp_order_pharma.drug_id = $2', [pharmacyId, drugId]);

        // Redirect back to the order_req page or any other page as needed
        res.redirect('/order_req');
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).send('Internal Server Error');
    }
});



///////////////////////////////////////

app.get('/login_mr', async (req, res) => {

    res.render('login_mr');
});
app.post('/login_mr', async (req, res) => {
    const name = req.body.name;

    try {
        // Check if the name exists in the medical_representative table
        const query = 'SELECT * FROM medical_representative WHERE name = $1';
        const result = await db.query(query, [name]);

        if (result.rows.length > 0) {
            // Name is valid, redirect to mr_first.ejs
           // res.redirect('/mr_first?name=' + encodeURIComponent(name));
           res.render('mr_first', { representative: result.rows[0] });
        } else {
            // Invalid name, you may want to handle this case accordingly
            res.status(401).send('Invalid credentials');
        }
    } catch (error) {
        console.error('Error processing MR login:', error);
        res.status(500).send('Internal Server Error');
    }
});


 app.get('/go_to_pharmacy', async (req, res) => {
    const pharmacyId = req.query.pharmacyId;
    const representativeId = req.query.representativeId;

    try {
        const query = `
            SELECT
                drug_square.*,
                pda.amount_od_drug
            FROM
                drug_square
            JOIN
                Pharmacy_Drug_Association AS pda ON drug_square.id = pda.drug_id
            WHERE
                drug_square.representative_id = $1
                AND pda.pharmacy_id = $2`;

        const result = await db.query(query, [representativeId, pharmacyId]);

        const drugs = result.rows;
console.log(drugs);
        // Render the go_to_pharmacy.ejs file with the necessary data
        res.render('go_to_pharmacy', { pharmacyId, representativeId, drugs });
    } catch (error) {
        console.error('Error processing go_to_pharmacy request:', error);
        res.status(500).send('Internal Server Error');
    }
});

//                    <p><strong>Order from Pharmacy:</strong> <%= drug.order_from_pharm || 0 %></p>
// Drug_Association AS pda ON drug_square.id = pda.drug_id AND pda.pharmacy_id = pharmacy_medical_representative.pharmacy_id
app.get('/advertise_here', (req, res) => {
    // Retrieve pharmacyId, medicalRepresentativeId, and drugId from query parameters or wherever they are available
    const pharmacyId = req.query.pharmacyId;
    const medicalRepresentativeId = req.query.medicalRepresentativeId;
    const drugId = req.query.drugId;
console.log(pharmacyId);
console.log(medicalRepresentativeId);
console.log(drugId);
    res.render('advertise_here', { pharmacyId, medicalRepresentativeId, drugId });
});
// Assuming you have set up your database connection (db)
app.post('/advertise_here', async (req, res) => {
    const pharmacyId = req.body.pharmacyId;
    const medicalRepresentativeId = req.body.medicalRepresentativeId;
    const drugId = req.body.drugId;
    const advertiseText = req.body.advertiseText;
console.log(pharmacyId);
console.log(medicalRepresentativeId);
console.log(drugId);
console.log(advertiseText);
const representativeId=medicalRepresentativeId;
    try {
        // Check if the entry already exists
        const checkQuery = `
            SELECT * FROM advertise
            WHERE pharmacy_id = $1 AND medical_representative_id = $2 AND drug_id = $3
        `;
        const checkResult = await db.query(checkQuery, [pharmacyId, medicalRepresentativeId, drugId]);

        if (checkResult.rows.length > 0) {
            // If entry exists, update the advertisement text
            const updateQuery = `
                UPDATE advertise
                SET advertises = $1
                WHERE pharmacy_id = $2 AND medical_representative_id = $3 AND drug_id = $4
            `;
            await db.query(updateQuery, [advertiseText, pharmacyId, medicalRepresentativeId, drugId]);
        } else {
            // If no entry exists, insert a new row
            const insertQuery = `
                INSERT INTO advertise (pharmacy_id, medical_representative_id, drug_id, advertises)
                VALUES ($1, $2, $3, $4)
            `;
            await db.query(insertQuery, [pharmacyId, medicalRepresentativeId, drugId, advertiseText]);
        }
        const incrementCountQuery = `
        UPDATE advertise_salary
        SET count_advertise = count_advertise + 1
        WHERE medical_representative_id = $1
    `;
    await db.query(incrementCountQuery, [medicalRepresentativeId]);
res.redirect('/');
    //res.send("Advertise send successfully");
      //  res.redirect('/go_to_pharmacy'); // Redirect to the pharmacy information page or any other page as needed
    } catch (error) {
        console.error('Error processing advertisement request:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/customer_SIGNUP', async (req, res) => {
    res.render('customer_SIGNUP');
});


app.post('/customer_SIGNUP', async (req, res) => {
    console.log('prity');
    const { name, age, location, email, phone_number, gender, password } = req.body;

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

        // Insert data into the customer table
        const insertQuery = `
            INSERT INTO customer (name, age, location, email, phone_number, gender, password)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ID;
        `;
        await db.query(insertQuery, [name, age, location, email, phone_number, gender, hashedPassword]);

        // Redirect to the home page or any other page as needed
        res.redirect('/');
    } catch (error) {
        console.error('Error processing customer signup:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Assuming you have a customer table in your database
// const db = ... // Your database connection

app.get('/customer_login', async (req, res) => {
    res.render('customer_login');
});



app.post('/customer_login', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Retrieve the customer from the database based on name or email
        const query = 'SELECT * FROM customer WHERE name = $1 OR email = $2';
        const result = await db.query(query, [name, email]);

        if (result.rows.length > 0) {
            const customer = result.rows[0];
            const hashedPassword = customer.password;

            // Compare the provided password with the hashed password from the database
            const passwordMatch = await bcrypt.compare(password, hashedPassword);

            if (passwordMatch) {
                // Passwords match, proceed with login
                const customerId = customer.id;
                res.redirect(`/cus_first_page?name=${encodeURIComponent(name)}&id=${customerId}`);
            } else {
                // Passwords do not match, render login page with an error message
                res.render('customer_login', { error: 'Invalid credentials' });
            }
        } else {
            // Customer not found, render login page with an error message
            res.render('customer_login', { error: 'Customer not found' });
        }
    } catch (error) {
        console.error('Error processing customer login:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/cus_first_page', async (req, res) => {
    const name = req.query.name;
    const id = req.query.id;

    try {
        // Fetch customer data from the database using customer ID
        const query = 'SELECT * FROM customer WHERE id = $1';
        const result = await db.query(query, [id]);

        if (result.rows.length > 0) {
            const customer = result.rows[0];

            // Render cus_first_page.ejs with customer information
            res.render('cus_first_page', { name, id, customer });
        } else {
            res.status(404).send('Customer not found');
        }
    } catch (error) {
        console.error('Error fetching customer data:', error);
        res.status(500).send('Internal Server Error');
    }
});
// GET route to handle customer update
app.get('/customer_update', async (req, res) => {
    try {
        const customerId = req.query.customerId;
        console.log('prity');
console.log(customerId);
        // Fetch customer details from the database using customerId
        const customerQuery = 'SELECT * FROM customer WHERE id = $1';
        const customerResult = await db.query(customerQuery, [customerId]);

        if (customerResult.rows.length === 0) {
            // Handle the case where the customer with the given id is not found
            return res.status(404).send('Customer not found');
        }

        const customer = customerResult.rows[0];

        // Render the customer update form with customer details
        res.render('customer_update', { customer });
    } catch (error) {
        console.error('Error fetching customer details for update:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Import necessary modules and configure your database connection

app.post('/customer_update', async (req, res) => {
    const customerId = req.body.id;
    const updatedName = req.body.name;
    const updatedAge = req.body.age;
    const updatedLocation = req.body.location;
    const updatedEmail = req.body.email;
    const updatedPhoneNumber = req.body.phone_number;
    const updatedGender = req.body.gender;

    try {
        // Update the customer information in the database
        const updateQuery = `
            UPDATE customer
            SET name = $1, age = $2, location = $3, email = $4, phone_number = $5, gender = $6
            WHERE id = $7
        `;

        await db.query(updateQuery, [updatedName, updatedAge, updatedLocation, updatedEmail, updatedPhoneNumber, updatedGender, customerId]);
        
        res.redirect('/'); // Redirect to a customer list page, for example

    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/manufacturer_details', async (req, res) => {


res.render('manufacturer_details');

});

// GET method to render cus_pharmacies.ejs and display the list of pharmacies
app.get('/cus_pharmacies', async (req, res) => {
    const customerId = req.query.customerId;
    try {
        // Replace the following line with your logic to fetch pharmacy data from the database
        const pharmacies = 'SELECT * FROM pharmacies ';
const result = await db.query('SELECT * FROM pharmacy');
res.render('cus_pharmacies', { pharmacies: result.rows, customerId});
        // Render cus_pharmacies.ejs with the list of pharmacies
        //res.render('cus_pharmacies', { pharmacies });
    } catch (error) {
        console.error('Error fetching pharmacies:', error);
        res.status(500).send('Internal Server Error');
    }
});

// POST method to handle the selection of a specific pharmacy and redirect to pharmacy_view page
app.post('/cus_pharmacies', async (req, res) => {
    const selectedPharmacyId = req.body.selectedPharmacyId;

    try {
        // Check if the selectedPharmacyId is valid (perform any additional validation if needed)
        if (!selectedPharmacyId) {
            return res.status(400).send('Invalid selected pharmacy ID');
        }

        // Redirect to the pharmacy_view page with the selected pharmacy ID
        res.redirect(`/pharmacy_view?id=${selectedPharmacyId}`);
    } catch (error) {
        console.error('Error processing selected pharmacy:', error);
        res.status(500).send('Internal Server Error');
    }
});
/// GET method for pharmacy_view page

// Assuming you have a database connection named 'db'

app.get('/cat_pharma_cus', async (req, res) => {
    const pharmacyId = req.query.pharmacyId;
console.log(pharmacyId);
const customerId=req.query.customerId;
console.log(customerId);

    try {
        // Fetch all categories for the given pharmacy
        const query = `
            SELECT DISTINCT c.*
            FROM Category c
            JOIN Drug_Square ds ON c.ID = ds.category_id
            JOIN Pharmacy_Drug_Association pda ON ds.ID = pda.drug_id
            WHERE pda.pharmacy_id = $1;
        `;
        const result = await db.query(query, [pharmacyId]);
        const categories = result.rows;
        const searchQuery = req.query.searchQuery || '';
        res.render('cat_pharma_cus', { categories, pharmacyId, searchQuery,customerId });
        // Render cat_pharma_cus.ejs with the list of categories
       // res.render('cat_pharma_cus', { categories, pharmacyId });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Assuming you have a database connection named 'db'

app.get('/med_pharma_cus', async (req, res) => {
    const pharmacyId = req.query.pharmacyId;
    const customerId = req.query.customerId;
console.log(pharmacyId);
    try {
        // Fetch all medicines for the given pharmacy
         const query = `
             SELECT ds.*,pda.amount_od_drug as amount,c.generic_name as gen,c.id as category_id, c.description as des
            FROM Drug_Square ds JOIN Category c on c.id=ds.category_id
            JOIN Pharmacy_Drug_Association pda ON ds.ID = pda.drug_id
            WHERE pda.pharmacy_id = $1;
         `;
       

        const result = await db.query(query, [pharmacyId]);
        const medicines = result.rows;

        // Render med_pharma_cus.ejs with the list of medicines
        res.render('med_pharma_cus', { medicines, pharmacyId, customerId });
    } catch (error) {
        console.error('Error fetching medicines:', error);
        res.status(500).send('Internal Server Error');
    }
});

 app.get('/search_cat', async (req, res) => {
    const searchQuery = req.query.searchQuery || '';
console.log(searchQuery);
const customerId=req.query.customerId;
const pharmacyId = req.query.pharmacyId;
console.log('$$$$$$$$$$$$$$$$$$$$');
console.log(customerId);
console.log('&&&&&&&&&&&&&&&&&&&&&&&&');
    try {
        const query = `
        SELECT *
        FROM Category
        WHERE id IN (
            SELECT DISTINCT c.id
            FROM Category c
            JOIN Drug_Square ds ON c.id = ds.category_id
            JOIN Pharmacy_Drug_Association pda ON ds.id = pda.drug_id
            WHERE pda.pharmacy_id = $1
                AND c.generic_name ILIKE $2
        );
    `;
    
    console.log('SQL Query:', query);
    console.log('Query Parameters:', [pharmacyId, `%${searchQuery}%`]);
    
    const result = await db.query(query, [pharmacyId, `%${searchQuery}%`]);
    const searchResults = result.rows;
    
console.log(searchResults);
        // Render the search_cat.ejs file with the search results
        res.render('search_cat', { searchQuery, searchResults,pharmacyId,customerId});
    } catch (error) {
        console.error('Error performing search:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Assuming you have a database connection named 'db'
app.get('/view_medicines', async (req, res) => {
    try {

        const customerId=req.query.customerId;
        const categoryId = req.query.categoryId;
        const pharmacyId = req.query.pharmacyId;

        const query = `
        SELECT ds.*, pda.amount_od_drug AS amount, c.generic_name AS gen, c.id AS category_id, c.description AS des
        FROM Drug_Square ds
        JOIN Category c ON c.id = ds.category_id
        JOIN Pharmacy_Drug_Association pda ON ds.ID = pda.drug_id
        WHERE pda.pharmacy_id = $1 AND category_id = $2;
    `;
    
    const result = await db.query(query, [pharmacyId, categoryId]);
    
      
        const drugs = result.rows;
        //res.render(' med_pharma_cus', { drugs, pharmacyId, categoryId });
       
        // Render the category_details.ejs file with the list of drugs
        res.render('category_details', { drugs, pharmacyId, categoryId,customerId });
    } catch (error) {
        console.error('Error fetching category details:', error);
        res.status(500).send('Internal Server Error');
    }
});



// Add this route in your server code
app.post('/add_to_cart', async(req, res) => {
    // Retrieve data from the form submission
    const medicineIds = req.body.medicineIds || [];
    const pharmacyId = req.body.pharmacyId;
    const customerId = req.body.customerId;
    console.log('Medicine IDs:', pharmacyId);
    //const quantities = req.body.quantities.map(qty => parseInt(qty));

// Ensure that quantities is a flat array of integers
//onst quantities = [].concat.apply([], req.body.quantities.map(qty => parseInt(qty)));

    const quantities = req.body.quantities || [];
//  const quantities = req.body.quantities ? req.body.quantities.flat().map(quantity => parseInt(quantity)) : [];
    // Log the order information to the console
    console.log('Medicine IDs:', medicineIds);
    console.log('Pharmacy ID:', pharmacyId);
    console.log('Customer ID:', customerId);
    console.log('Quantities:', quantities);
   const phar=parseInt(pharmacyId);
    const cus=parseInt(customerId);
    for (let i = 0; i < medicineIds.length; i++) {
        let medicineId = parseInt(medicineIds[i]);
        let  quantity = parseInt(quantities[i]);
       // const quantity = quantities[i];
      
       console.log(medicineId);
       console.log(quantity);
        
       
        
if (quantity > 0) {
    console.log('quantity > 0');

    // Insert into add_cart table, update if conflict
    await db.query(`
        INSERT INTO add_cart (customer_id, pharmacy_id, drug_id, amount_of_cart)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (customer_id, pharmacy_id, drug_id)
        DO UPDATE SET amount_of_cart = add_cart.amount_of_cart + $4
    `, [cus, phar, medicineId, quantity]);

    console.log('inserted into cart ');
}



    }
   
 //res.render('cus_pharmacies',{customerId});
    res.send('Order received successfully!');
});
// Add this route in your server code// Add this route in your server code
app.get('/show_cart', async (req, res) => {
    const customerId = req.query.customerId;

    try {
        // Fetch cart information for the given customer, including drug details and pharmacy association
        const query = `
            SELECT ac.*, ds.medicine_name, ds.strip_price, pda.amount_od_drug as pharmacy_amount
            FROM add_cart ac
            JOIN Drug_Square ds ON ac.drug_id = ds.ID
            JOIN Pharmacy_Drug_Association pda ON ac.drug_id = pda.drug_id AND ac.pharmacy_id = pda.pharmacy_id
            WHERE ac.customer_id = $1;
        `;

        const result = await db.query(query, [customerId]);
        const cartItems = result.rows;

        // Render show_cart.ejs with the cart information
        res.render('show_cart', { cartItems, customerId });
    } catch (error) {
        console.error('Error fetching cart information:', error);
        res.status(500).send('Internal Server Error');
    }
});




// Add this route in your server code
app.post('/buy_all_medicines', async (req, res) => {
    const customerId = req.body.customerId;

    try {
        // Move all medicines from add_cart to purchased_medicines table
        const moveQuery = `
            INSERT INTO purchased_medicines (customer_id, pharmacy_id, drug_id, amount_purchased)
            SELECT customer_id, pharmacy_id, drug_id, amount_of_cart
            FROM add_cart
            WHERE customer_id = $1
            RETURNING *;
        `;

        const movedMedicines = await db.query(moveQuery, [customerId]);

        // Delete all medicines from add_cart table
        const deleteQuery = `
            DELETE FROM add_cart
            WHERE customer_id = $1;
        `;

        await db.query(deleteQuery, [customerId]);

        // Respond with a success message or redirect to a confirmation page
        res.send('Order request sent successfully!');
    } catch (error) {
        console.error('Error buying all medicines:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Assuming you are using Express
app.get('/customer_order', async (req, res) => {
    try { 
        const pharmacyName = req.query.pharmacyName;

        // Fetch the pharmacy ID from the pharmacy table
        const pharmacyQuery = 'SELECT id FROM pharmacy WHERE name = $1';
        const pharmacyResult = await db.query(pharmacyQuery, [pharmacyName]);
        const pharmacyId = pharmacyResult.rows[0].id;
console.log(pharmacyId);
        // Fetch customer orders from purchased_medicines where pharmacy_id matches
        const customerOrdersQuery = `
        SELECT pm.*,c.name as cname, ds.medicine_name,ds.id as drug_id,ds.strip_price as price_of_strip
        FROM purchased_medicines pm
        JOIN customer c ON pm.customer_id = c.id
        JOIN Drug_Square ds ON pm.drug_id = ds.ID
        WHERE pm.pharmacy_id = (
            SELECT id FROM pharmacy WHERE name = $1
        );
    `;

        const customerOrdersResult = await db.query(customerOrdersQuery, [pharmacyName]);
        const customerOrders = customerOrdersResult.rows;
console.log(customerOrders);
        // Render the customer_orders.ejs with the fetched data
        res.render('customer_order', { customerOrders, pharmacyName,pharmacyId });
    } catch (error) {
        console.error('Error fetching customer orders:', error);
        // Handle errors and send an appropriate response
        res.status(500).send('Internal Server Error');
    }
});
app.get('/manufacturer_details', async (req, res) => {


    res.render('manufacturer_details');
    
    });


app.post('/confirm_order', async (req, res) => {
    try {
        const customerId = req.body.customerId;
        const drugId = req.body.drugId;
        const pharmacyId = req.body.pharmacyId;
const amountPurchased = req.body.amount1;
console.log(amountPurchased);
        // Fetch drug information from Drug_Square
        const drugQuery = 'SELECT strip_price FROM Drug_Square WHERE ID = $1';
        const drugResult = await db.query(drugQuery, [drugId]);
        const stripPrice = drugResult.rows[0].strip_price;

        // Fetch profit_percent from Pharmacy_Drug_Association
        const profitQuery = 'SELECT profit_percent FROM Pharmacy_Drug_Association WHERE pharmacy_id = $1 AND drug_id = $2';
        const profitResult = await db.query(profitQuery, [pharmacyId, drugId]);
        const profitPercent = parseFloat(profitResult.rows[0].profit_percent);
          console.log(profitPercent);
          console.log(stripPrice);
          console.log(amountPurchased);
        // Calculate cost
 
       // console.log(prof);
        const  cost=parseFloat(stripPrice*amountPurchased*profitPercent);
        //const cost = stripPrice*amountPurchased * (1 + profitPercent);
console.log(cost);

       
         const amountQuery = 'SELECT amount_od_drug FROM Pharmacy_Drug_Association WHERE pharmacy_id = $1 AND drug_id = $2';
         const amountResult = await db.query(amountQuery, [pharmacyId, drugId]);
        const amountPercent = amountResult.rows[0].amount_od_drug;

        const amountQuery2 = 'SELECT customer_order FROM Pharmacy_Drug_Association WHERE pharmacy_id = $1 AND drug_id = $2';
        const amountResult2 = await db.query(amountQuery2, [pharmacyId, drugId]);
      // const amountPercent2 = amountResult2.rows[0].total_sell_med;
              const total_sell = parseFloat(amountResult2.rows[0].customer_order);
                console.log(total_sell);
                const r1=total_sell+cost;
                console.log(r1);
                const updateQuery1 ='UPDATE  pharmacy_drug_association SET customer_order= $1 WHERE drug_id = $2 AND pharmacy_id = $3 ';
                await db.query(updateQuery1, [r1,drugId,pharmacyId]);

         console.log('before ');
        console.log(amountPercent);
         console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^');
     const p1=amountPercent-amountPurchased;
         console.log(p1);
        console.log('after');
     const insertQuery1 = 'UPDATE  pharmacy_drug_association SET amount_od_drug = $1 WHERE drug_id = $2 AND pharmacy_id = $3 ';
         await db.query(insertQuery1, [p1,drugId,pharmacyId]);
     const insertQuery = 'INSERT INTO done_purchased_medicines (customer_id, pharmacy_id, drug_id, amount_purchased, cost) VALUES ($1, $2, $3, $4, $5)';
         await db.query(insertQuery, [customerId, pharmacyId, drugId, amountPurchased, cost]);

      
         const deleteQuery = 'DELETE FROM purchased_medicines WHERE customer_id = $1 AND pharmacy_id = $2 AND drug_id = $3';
        await db.query(deleteQuery, [customerId, pharmacyId, drugId]);
//res.redirect('/');
       
    } catch (error) {
        console.error('Error confirming order:', error);
        
    }
});
app.post('/delete_order_1', async (req, res) => {
console.log('prity');
console.log('^^^^^^^^^^^^');
    const customerId = req.body.customerId;
    const drugId = req.body.drugId;
    const pharmacyId = req.body.pharmacyId;
const amountPurchased = req.body.amount1;
const deleteQuery = 'DELETE FROM purchased_medicines WHERE customer_id = $1 AND pharmacy_id = $2 AND drug_id = $3';
await db.query(deleteQuery, [customerId, pharmacyId, drugId]);

console.log('deleted');
const drugQuery = 'SELECT medicine_name FROM Drug_Square WHERE ID = $1';
const drugResult = await db.query(drugQuery, [drugId]);
//const name = drugResult.rows[0].strip_price;
res.redirect('/' );
    
});

function generateUniqueOrderNumber() {
    // Implement logic to generate a unique order number
    // This can involve using a counter, timestamp, or other methods
    // For simplicity, let's use a timestamp
    return Date.now();
}

// GET route to display information of done_purchased_medicines grouped by customer_id
app.get('/done_confirmation', async (req, res) => {
    console.log('prity');
  //  const { pharmacyId } = req.params; 
  const  pharmacyId=req.query.pharmacyId;
     // Extract pharmacyId from the URL parameters
    console.log('pharmacyId:', pharmacyId);
    try {
        // Fetch aggregated information from done_purchased_medicines
        const doneMedicinesQuery = `
            SELECT
                d.customer_id,
                c.name as cname,
                SUM(d.cost) AS total_cost,
                ARRAY_AGG(d.cost) AS ds_cost,
                ARRAY_AGG(ds.medicine_name) AS medicine_names,
                ARRAY_AGG(d.amount_purchased) AS amounts_purchased
            FROM
                done_purchased_medicines d
            JOIN
                customer c ON d.customer_id = c.id
            JOIN
                Drug_Square ds ON d.drug_id = ds.ID
            GROUP BY
                d.customer_id, c.name
            ORDER BY
                d.customer_id;`;

        const doneMedicinesResult = await db.query(doneMedicinesQuery);
        const doneMedicines = doneMedicinesResult.rows;

        // Generate a unique order number for each customer
       // const uniqueOrderNumbers = doneMedicines.map(() => generateUniqueOrderNumber());

        // Render the done_confirmation.ejs with the fetched data and unique order numbers
        res.render('done_confirmation', { doneMedicines, pharmacyId});
    } catch (error) {
        console.error('Error fetching done_purchased_medicines:', error);
        // Handle errors and send an appropriate response
    }
});



app.post('/send_bill', async (req, res) => {
    console.log('prity');
    const pharmacyId = req.body.pharmacyId;
    console.log(pharmacyId);
    const customerId = parseInt(req.body.customerId);
    console.log('c');
    console.log(customerId);
    const totalCost = req.body.totalCost;
    console.log(totalCost);
    //const orderNumber1 = req.query.orderNumber;
    const cusId = req.body.cus_id;
    const orderNumber=parseInt(cusId);
     // Accessing the value of cus_id
    console.log('cusId:', orderNumber);

    //const orderNumber2 = parseInt(orderNumber1);
    //console.log('order-'||orderNumber1);
    const orderNumber1 = await getNextOrderId();
     try {


// console.log('prity1');
        const deleteQuery = 'DELETE FROM done_purchased_medicines WHERE pharmacy_id = $1 AND customer_id = $2';
       await db.query(deleteQuery, [pharmacyId, customerId]);
console.log('prity2');
 
         if (totalCost > 1000) {
            const checkSpecialQuery = 'SELECT * FROM special_customer WHERE pharmacy_id = $1 AND customer_id = $2';
            const checkSpecialResult = await db.query(checkSpecialQuery, [pharmacyId, customerId]);

        if (checkSpecialResult.rows.length === 0) {
             const insertSpecialQuery = 'INSERT INTO special_customer (pharmacy_id, customer_id) VALUES ($1, $2) RETURNING *';
                await db.query(insertSpecialQuery, [pharmacyId, customerId]);
             }
           
        }
        console.log('prity3');


const insertOrderDoneQuery = `
            INSERT INTO customer_order_done (order_id, customer_id, pharmacy_id, drug_id, amount_purchased, cost)
            SELECT $1, $2, $3, drug_id, amount_purchased, cost
            FROM done_purchased_medicines_backup
            WHERE pharmacy_id = $4 AND customer_id = $5
            RETURNING *;
        `;

        const insertOrderDoneResult = await db.query(insertOrderDoneQuery, [orderNumber, customerId, pharmacyId, pharmacyId, customerId]);
        const insertedOrderDone = insertOrderDoneResult.rows[0];

        

res.status(200).send({ success: true, message: 'Bill sent successfully.' });
    
     } catch (error) {
    console.error('Error processing send_bill:', error);
        res.sendStatus(500);
     }
 });
 async function getNextOrderId() {
    const result = await db.query('SELECT nextval(\'order_id_sequence\') as order_id');
    return result.rows[0].order_id;
}

app.get('/see_my_order', async (req, res) => {
    console.log('prity');
    try {
        const customerId = parseInt(req.query.customerId);
        console.log('cs', customerId);

        // Fetch all orders for the customer
        const ordersQuery = `
            SELECT DISTINCT order_id
            FROM customer_order_done
            WHERE customer_id = $1
            ORDER BY order_id;
        `;
        const ordersResult = await db.query(ordersQuery, [customerId]);
        console.log(ordersResult);
        console.log('prity1');

        const orderIds = ordersResult.rows.map(row => row.order_id);
        // Fetch order details for each order, including medicine_name
        const ordersDetails = [];

        for (const orderId of orderIds) {
            let totalCost = 0; // Reset totalCost for each order

            const orderDetailsQuery = `
                SELECT cod.*, ds.medicine_name
                FROM customer_order_done cod
                JOIN Drug_Square ds ON cod.drug_id = ds.ID
                WHERE cod.customer_id = $1 AND cod.order_id = $2
                ORDER BY cod.drug_id;
            `;
            const orderDetailsResult = await db.query(orderDetailsQuery, [customerId, orderId]);
            const orderDetails = orderDetailsResult.rows;

            // Calculate total cost for the order
            totalCost = orderDetails.reduce((acc, order) => acc + parseFloat(order.cost), 0);

            // Add total cost to each orderDetails object
            orderDetails.forEach(order => {
                order.totalCost = totalCost;
            });

            ordersDetails.push(orderDetails);
        }

        // Render the see_my_order.ejs with the fetched data
        res.render('see_my_order', { customerId, ordersDetails });
    } catch (error) {
        console.error('Error fetching customer orders:', error);
        // Handle errors and send an appropriate response
        res.status(500).send('Internal Server Error');
    }
});

app.get('/medicines/search', async (req, res) => {
    try {
        const pharmacyId = req.query.pharmacyId;
        const customerId = req.query.customerId;
        console.log('prity');
        console.log(pharmacyId);
        console.log(customerId);
        console.log('prity1');
        const medicineName = req.query.medicineName;

        // Fetch drug_ids from pharma_drug_association based on medicineName
        const drugIdsQuery = `
            SELECT drug_id
            FROM pharmacy_drug_association join drug_square on pharmacy_drug_association.drug_id=drug_square.ID
            WHERE LOWER(medicine_name) LIKE $1;
        `;
        const drugIdsResult = await db.query(drugIdsQuery, [`%${medicineName.toLowerCase()}%`]);
        const drugIds = drugIdsResult.rows.map(row => row.drug_id);

        // Fetch drug details from Drug_Square based on drug_ids
        const drugsQuery = `
        SELECT ds.*, pda.amount_od_drug as amount, c.generic_name as gen, c.id as category_id, c.description as des
        FROM Drug_Square ds
        JOIN Category c ON c.id = ds.category_id
        JOIN Pharmacy_Drug_Association pda ON ds.ID = pda.drug_id
        WHERE ds.ID = ANY($1);
    `;
        const drugsResult = await db.query(drugsQuery, [drugIds]);

        const searchedMedicines = drugsResult.rows;

        // Render the searched_medicines.ejs with the fetched data
        res.render('searched_medicines', { searchedMedicines,pharmacyId,customerId });
    } catch (error) {
        console.error('Error searching medicines:', error);
        // Handle errors and send an appropriate response
        res.status(500).send('Internal Server Error');
    }
});
// Assuming you have a route handler like this in your server-side code
app.get('/delete_medicine/:id', async (req, res) => {
    try {
        console.log('^^^^^^^^^^^^^^^^^^^^^');
      const medicineId = req.params.id;
  console.log(medicineId);
  console.log('^^^^^^^^^^^^^^^^^^^^^^^^^');
 console.log('1');
  const deleteMedicineQuery8= 'DELETE FROM    customer_order_done WHERE drug_id = $1';
  await db.query(deleteMedicineQuery8, [medicineId]);
  console.log('2');
  const deleteMedicineQuery7= 'DELETE FROM    done_purchased_medicines_backup WHERE drug_id = $1';
  await db.query(deleteMedicineQuery7, [medicineId]);
  console.log('3');
  const deleteMedicineQuery6= 'DELETE FROM    done_purchased_medicines WHERE drug_id = $1';
  await db.query(deleteMedicineQuery6, [medicineId]);
  console.log('4');
  const deleteMedicineQuery5= 'DELETE FROM    purchased_medicines WHERE drug_id= $1';
  await db.query(deleteMedicineQuery5, [medicineId]);
  console.log('5');
  const deleteMedicineQuery4= 'DELETE FROM  add_cart WHERE drug_id = $1';
  await db.query(deleteMedicineQuery4, [medicineId]);
  console.log('6');
  const deleteMedicineQuery3= 'DELETE FROM    advertise WHERE drug_id = $1';
  await db.query(deleteMedicineQuery3, [medicineId]);
  console.log('7');
  const deleteMedicineQuery2= 'DELETE FROM  temp_order_pharma WHERE drug_id = $1';
  await db.query(deleteMedicineQuery2, [medicineId]);
  console.log('8');
  const deleteMedicineQuery1= 'DELETE FROM   Pharmacy_Drug_Association WHERE drug_id= $1';
  await db.query(deleteMedicineQuery1, [medicineId]);
  console.log('9');
  const deleteMedicineQuery = 'DELETE FROM Drug_Square WHERE ID = $1';
  await db.query(deleteMedicineQuery, [medicineId]);
  console.log('10');
      // Perform the delete operation (implement your own logic)
  
      // Redirect back to the show_drugs page after deletion
      res.redirect('/show_drugs');
    } catch (error) {
      console.error('Error deleting medicine:', error);
      res.status(500).send('Internal Server Error');
    }
   });

  app.get('/abn', async (req, res) => {
    console.log('^^^^^^^^^^^^^');
    console.log('prity');
    const pharmacyId = req.query.pharmacyId;
    const representativeId = req.query.representativeId;

    console.log('Pharmacy ID:', pharmacyId);
    console.log('Representative ID:', representativeId);

    const adQuery = 'SELECT * FROM Drug_Square WHERE representative_id = $1';
    const Result = await db.query(adQuery, [representativeId]);
    const drugs = Result.rows;

    console.log(drugs);

    // Respond with HTML using res.render
    res.render('advertise_send', { drugs, pharmacyId, representativeId }, (err, html) => {
        if (err) {
            console.error('Error rendering HTML:', err);
            return res.status(500).send('Internal Server Error');
        }
        
        // Send the HTML response only once here
        res.send(html);
    });
});
app.get('/medicine/details', async(req, res) => {
    const customerId = req.query.customerId;
    const pharmacyId = req.query.pharmacyId;
    const medicineId = req.query.medicineId;
  console.log('prity');
  console.log(customerId);
    console.log(pharmacyId);
    console.log(medicineId);
    try {
        // Fetch all medicines for the given pharmacy
         const query = `
             SELECT ds.*,pda.amount_od_drug as amount,c.generic_name as gen,c.id as category_id, c.description as desc
            FROM Drug_Square ds JOIN Category c on c.id=ds.category_id
            JOIN Pharmacy_Drug_Association pda ON ds.ID = pda.drug_id
            WHERE pda.pharmacy_id = $1 and ds.ID=$2;
         `;
       

        const result = await db.query(query, [pharmacyId, medicineId]);
        const medicines = result.rows;

        // Render med_pharma_cus.ejs with the list of medicines
        res.render('medicine_details', { medicines, pharmacyId, customerId ,medicineId});
    } catch (error) {
        console.error('Error fetching medicines:', error);
        res.status(500).send('Internal Server Error');
    }
    // Render the details page with the provided parameters
    // res.render('medicine_details', {
    //   customerId: customerId,
    //   pharmacyId: pharmacyId,
    //   medicineId: medicineId,
    //   // Add other necessary data for the details page
    // });
  });