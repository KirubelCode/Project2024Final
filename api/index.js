const express = require("express");
const session = require('express-session');
const mysql = require('mysql');
const cors = require('cors');
const { google } = require('googleapis');

const bodyParser = require("body-parser");

const app = express();

app.use(express.urlencoded({ extended: true }));
// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));

const masterDbConfig = {
    host: 'localhost',
    user: 'masterUser',
    password: 'SetuCarlow2024',
    database: 'MasterDB'
};


// Function to establish a connection to the user's database
function establishUserDbConnection(userDbConfig) {
    return mysql.createConnection(userDbConfig);
}

// Route to render the signup page
app.get('/', (req, res) => {
    const SignUpPageHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sign Up</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                overflow: auto; /* Enable page scrolling */
            }
    
            .container {
                max-width: 600px;
                width: 80%; /* Adjust container width for larger screens */
                margin: 10% auto;
                padding: 20px;
                background-color: #fff;
                border: 1px solid #ccc;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                overflow: hidden; /* Hide overflow content */
            }
    
            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 20px;
            }
    
            input[type="text"],
            input[type="password"],
            button {
                width: 100%;
                padding: 10px;
                margin-bottom: 10px;
                border-radius: 5px;
                border: 1px solid #ccc;
                box-sizing: border-box;
                font-size: 16px;
            }
    
            button {
                background-color: #007bff;
                color: #fff;
                cursor: pointer;
                transition: background-color 0.3s;
            }
    
            button:hover {
                background-color: #0056b3;
            }
    
            .note {
                background-color: #f8d7da;
                color: #721c24;
                padding: 10px;
                border-radius: 5px;
                margin-top: 20px;
                white-space: pre-line; /* Allow line breaks in notes */
                overflow: auto; /* Enable overflow scrolling for notes */
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Sign Up</h1>
            <form action="/signup" method="post">
                <input type="text" placeholder="Enter your username" name="username" required>
                <input type="password" placeholder="Enter your password" name="password" required>
                <input type="text" placeholder="Enter your database name" name="dbname" required>
                <input type="text" placeholder="Enter your Google Client ID" name="clientId" required>
                <input type="text" placeholder="Enter your Google Client Secret" name="clientSecret" required>
                <input type="text" placeholder="Enter your Google Redirect URI" name="redirectUri" required>
                <button type="submit">Sign Up</button>
                
            </form>
            <button onclick="location.href='/login'">Login</button>
            <div class="note">
                <p><strong>Note:</strong> Before signing up, please set up your Google Console account (create credentials) with a oAuth Client <BR><br>  1. Retrieve Client secret and Client Id <br><br> 2. Add the following scopes:</p>
                <ul>
                    <li>'https://www.googleapis.com/auth/user.addresses.read'</li>
                    <li>'https://www.googleapis.com/auth/user.phonenumbers.read'</li>
                    <li>'https://www.googleapis.com/auth/userinfo.email'</li>
                    <li>'profile' (Include the profile scope and people api)</li>
                </ul>
                <p> Use this redirect URI http://localhost:3000/authorised-client in your google account and here.<p>
                <p>Also, configure the google console Redirect URI to match the one used in this signup page.</p>
            </div>
        </div>
    </body>
    </html>
    
    `;

    // Send the login page HTML as the response
    res.send(SignUpPageHTML);
});

// Route for handling signup requests
app.post("/signup", async (req, res) => {
    const { username, dbname, clientId, clientSecret, redirectUri, password } = req.body;

    // Database connection parameters for administrative tasks
    const adminUsername = "masterUser";
    const adminPassword = "SetuCarlow2024";
    const adminDbname = "MasterDB";
    const adminHost = "localhost";

    // Create connection to perform administrative tasks
    const adminConn = mysql.createConnection({
        host: adminHost,
        user: adminUsername,
        password: adminPassword,
        database: adminDbname
    });

    // Check connection for administrative tasks
    adminConn.connect((err) => {
        if (err) {
            console.error('Error connecting to MasterDB:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // Prepare SQL statement to check for existing client
        const checkExistingSql = `SELECT COUNT(*) AS count_exists FROM ClientData WHERE ClientUsername = ?`;

        // Execute query to check if the client already exists
        adminConn.query(checkExistingSql, [username], (err, results) => {
            if (err) {
                console.error('Error querying MasterDB:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const countExists = results[0].count_exists;

            if (countExists > 0) {
                res.status(400).json({ error: 'Client already exists in the database.' });
            } else {
                // Proceed with inserting the new record into ClientData table
                const insertSql = `
                    INSERT INTO ClientData (ClientUsername, DatabaseName, GoogleClientId, GoogleClientSecret, RedirectUri, ClientPassword)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;

                // Execute insert query
                adminConn.query(insertSql, [username, dbname, clientId, clientSecret, redirectUri, password], (err, results) => {
                    if (err) {
                        console.error('Error inserting client information:', err);
                        res.status(500).json({ error: 'Internal Server Error' });
                        return;
                    }

                    // Client information inserted successfully
                    const newDbname = dbname;

                    // Create the client's database (ClientsDB)
                    const createDbSql = `CREATE DATABASE IF NOT EXISTS ${newDbname}`;
                    adminConn.query(createDbSql, (err, result) => {
                        if (err) {
                            console.error('Error creating database:', err);
                            res.status(500).json({ error: 'Internal Server Error' });
                            return;
                        }

                        // Grant privileges to the new user on their database
                        const grantPrivilegesSql = `GRANT ALL PRIVILEGES ON ${newDbname}.* TO '${username}'@'localhost' IDENTIFIED BY '${password}'`;
                        adminConn.query(grantPrivilegesSql, (err, result) => {
                            if (err) {
                                console.error('Error granting privileges:', err);
                                res.status(500).json({ error: 'Internal Server Error' });
                                return;
                            }

                            // Switch to the newly created database (ClientsDB)
                            adminConn.changeUser({ database: newDbname }, (err) => {
                                if (err) {
                                    console.error('Error switching database:', err);
                                    res.status(500).json({ error: 'Internal Server Error' });
                                    return;
                                }

                                // Create clientInfo table in ClientsDB database
                                const createTableSql = `
                                    CREATE TABLE IF NOT EXISTS clientInfo (
                                        ID INT AUTO_INCREMENT PRIMARY KEY,
                                        firstName VARCHAR(255),
                                        lastName VARCHAR(255),
                                        email VARCHAR(255),
                                        phone VARCHAR(20),
                                        address VARCHAR(255)
                                    )
                                `;
                                adminConn.query(createTableSql, (err, result) => {
                                    if (err) {
                                        console.error('Error creating table:', err);
                                        res.status(500).json({ error: 'Internal Server Error' });
                                        return;
                                    }

                                    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Client Added</title>
    </head>
    <body>
        <script>
            alert('Client information inserted successfully.');
            window.location.href = '/login'; // Redirect to the dashboard page
        </script>
    </body>
    </html>
`);

                                });
                            });
                        });
                    });
                });
            }
        });
    });
});


// Route to render the login page
app.get('/login', (req, res) => {
    const loginPageHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f5f5f5;
                    overflow: auto; /* Enable page scrolling */
                }
                .container {
                    max-width: 600px;
                    width: 80%;
                    margin: 10% auto;
                    padding: 20px;
                    background-color: #fff;
                    border: 1px solid #ccc;
                    border-radius: 5px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                    overflow: hidden; /* Hide overflow content */
                }
                h1 {
                    text-align: center;
                    color: #333;
                    margin-bottom: 20px;
                }
                input[type="text"],
                input[type="password"],
                button {
                    width: 100%;
                    padding: 10px;
                    margin-bottom: 10px;
                    border-radius: 5px;
                    border: 1px solid #ccc;
                    box-sizing: border-box;
                    font-size: 16px;
                }
                button {
                    background-color: #007bff;
                    color: #fff;
                    cursor: pointer;
                    transition: background-color 0.3s;
                }
                button:hover {
                    background-color: #0056b3;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Login</h1>
                <form action="/login" method="post">
                    <input type="text" placeholder="Enter your username" name="username" required>
                    <input type="password" placeholder="Enter your password" name="password" required>
                    <button type="submit">Login</button>
                </form>
                <button onclick="location.href='/signup'">Sign Up</button>
            </div>
        </body>
        </html>
    `;

    // Send the login page HTML as the response
    res.send(loginPageHTML);
});

// Route for handling login requests
app.post("/login", async (req, res) => {
    try {

        
        const { username, password } = req.body;
        const sql = `SELECT * FROM ClientData WHERE ClientUsername = ? AND ClientPassword = ?`;

        const masterDbConnection = mysql.createConnection(masterDbConfig);

        masterDbConnection.connect((err) => {
            if (err) {
                console.error('Error connecting to MasterDB:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            masterDbConnection.query(sql, [username, password], (err, results) => {
                if (err) {
                    console.error('Error querying MasterDB:', err);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                if (results.length === 1) {
                    const userData = results[0];

                    // Store user data and database config in session
                    req.session.userData = userData;
                    const userDbConfig = {
                        host: masterDbConfig.host,
                        user: userData.ClientUsername,
                        password: userData.ClientPassword,
                        database: userData.DatabaseName
                    };

                    // Store user data in session
                    req.session.userData = {
                        ClientUsername: userData.ClientUsername,
                        DatabaseName: userData.DatabaseName,
                        ClientPassword: userData.ClientPassword,
                        GoogleClientId: userData.GoogleClientId,
                        GoogleClientSecret: userData.GoogleClientSecret,
                        RedirectUri: userData.RedirectUri,
                        
                    };
                    
                    req.session.userDbConfig = userDbConfig;

                    // Redirect user after successful login
                    res.redirect('/dashboard');
                } else {
                    
res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Error</title>
</head>
<body>
    <script>
        alert('Invalid credentials. Please try again.');
        window.history.back(); // Go back to the previous page
    </script>
</body>
</html>
`);

                }
            });
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to render the dashboard page
app.get('/dashboard', (req, res) => {
    const DashboardPageHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <script src="script.js"></script>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Client Management System</title>
        <style>
        .container {
            max-width: 800px;
            margin: 0 auto; 
            padding: 20px; 
            padding-bottom: 25px;
            border: 2px solid;
            border-radius: 10px; 
            border-style:outset;
           
        }
        
        .btn {
            padding: 15px 30px;
            border-width: 2px;
            border-style: outset;
            font-size: 18px;
            text-decoration: none;
            border-radius: 5px;
            border-color: #000000;
            color: #fff;
            background-color: #007bff;
            transition: background-color 0.3s, color 0.3s;
            cursor: pointer;
            
        }
        
        .btn:hover {
            background-color: #0056b3;
        }
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }        
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Client Onboarding and Management System</h1>
            <br>
            <a href="/onboard" class="btn">Onboard Client</a>
            <a href="/manage-clients" class="btn">Manage Clients</a>
            <a href="/searchClientsPage" class="btn">Extract Clients</a>
            <br>
        </div>
        <br><br>
    </body>
    </html>
    
    `;

    // Send the login page HTML as the response
    res.send(DashboardPageHTML);
});


// Route to render the login page
app.get('/onboard', (req, res) => {
    const OnboardPageHTML = `
    <!DOCTYPE html>
<html lang="en">
<head>
    <script>function goBack() {
        window.history.back(); // Previous page
    }</script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Onboard Client</title>
    <style> body {
        font-family: Arial, sans-serif;
        background-color: #f5f5f5;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }
    
    .container {
        max-width: 800px;
        margin: 0 auto; 
        padding: 20px; 
        padding-bottom: 25px;
        border: 2px solid;
        border-radius: 10px; 
        border-style:outset;
       
    }
    
    .btn {
        padding: 15px 30px;
        border-width: 2px;
        border-style: outset;
        font-size: 18px;
        text-decoration: none;
        border-radius: 5px;
        border-color: #000000;
        color: #fff;
        background-color: #007bff;
        transition: background-color 0.3s, color 0.3s;
        cursor: pointer;
        
    }

    .btn:hover {
        background-color: #0056b3;
    }

    .index-button {
        display: flex;
        justify-content: center;
    }

    .back-button {
        position: fixed;
        bottom: 20px; 
        left: 20px;
        padding: 10px 20px;
        font-size: 16px;
        background-color: #007bff;
        color: #fff;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        
    }
    
    .back-button:hover {
        background-color: #0056b3;
    }
    </style>
</head>
<body>
    <div class="container">
        <h1>Onboard Client</h1>
        <a href="/use-social" class="btn">Use Social Details</a>
        <a href="/manually-input" class="btn">Manually Add Client</a>
    </div>
</body>
<button onclick="goBack()" class="back-button">Back</button>
</html>

    
    `;

    // Send the login page HTML as the response
    res.send(OnboardPageHTML);
});


// Route to render the login page
app.get('/use-social', (req, res) => {
    // Retrieve userData from session
    const userData = req.session.userData;

    if (!userData) {
        // Handle case where userData is not found in session (e.g., user not logged in)
        res.status(401).send('Unauthorized');
        return;
    }

    // Extract necessary data from userData
    const clientId = userData.GoogleClientId;
    const redirectUri = userData.RedirectUri;
    const scope = 'openid profile email phone';

    // Construct the OAuth2 URL using template 
    const generatedLink = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;

    // Construct the HTML content for the page
    const UseSocialPageHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Retrieve Details</title>
            <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto; 
                padding: 20px; 
                padding-bottom: 25px;
                border: 2px solid;
                border-radius: 10px; 
                border-style:outset;
               
            }
        
            .use-social {
                border: 1px solid #ddd; 
                padding: 20px; 
                border-radius: 5px; 
            }
        
            .title {
                font-size: 24px;
                margin-bottom: 30px;
                text-align: center; 
            }
            
            .form {
                display: flex;
                flex-direction: column;
                align-items: flex-start; /* Left align form items */
            }
            
            .checkboxes {
                margin-bottom: 20px;
            }
            
            .checkbox-item {
                margin-bottom: 10px;
            }
            
            .btn {
                padding: 15px 30px;
                border-width: 2px;
                border-style: outset;
                font-size: 18px;
                text-decoration: none;
                border-radius: 5px;
                border-color: #000000;
                color: #fff;
                background-color: #007bff;
                transition: background-color 0.3s, color 0.3s;
                cursor: pointer;
                
            }

            .back-button {
                position: fixed;
                bottom: 20px; 
                left: 20px;
                padding: 10px 20px;
                font-size: 16px;
                background-color: #007bff;
                color: #fff;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                
            }
            
            .back-button:hover {
                background-color: #0056b3;
            }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="title">Retrieve Details</h1>
                <form class="form">
                    <fieldset class="form-fieldset use-social">
                        <legend>Select Application</legend>
                        <div class="checkboxes">
                            <label class="checkbox-item">
                                <input type="radio" name="platform" value="Google"> Google
                            </label>
                        </div>
                    </fieldset>
                    <button type="button" class="btn" onclick="generateLink()">Generate Link</button>
                </form>
                <button onclick="goBack()" class="back-button">Back</button>
            </div>
            <script>
                function goBack() {
                    window.history.back(); // Previous page
                }
                
                function generateLink() {
                    var selectedPlatform = document.querySelector('input[name="platform"]:checked');
                
                    if (selectedPlatform) {
                        var platformValue = selectedPlatform.value;
                        var generatedLink = '${generatedLink}'; // Ensure generatedLink is properly set
                
                        if (platformValue === 'Google') {
                            generatedLink = '${generatedLink}'; // Add correct values to generatedLink
                        }
                
                        // Redirect to checkPermissions.html with the generated link as a URL parameter
                        window.location.href = '/check-permission?link=' + encodeURIComponent(generatedLink);
                    } else {
                        alert('Please select a platform.');
                    }
                }
                
            </script>
        </body>
        </html>
    `;

    // Send the HTML content as the response
    res.send(UseSocialPageHTML);
});


// Route to render the addClient page
app.get('/manually-input', (req, res) => {
   

    // Construct the HTML content for the page
    const ManuallyInputPageHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Add Client</title>
       <style>
       body {
        font-family: Arial, sans-serif;
        background-color: #f5f5f5;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }
    
    .container {
        max-width: 800px;
        margin: 0 auto; 
        padding: 20px; 
        padding-bottom: 25px;
        border: 2px solid;
        border-radius: 10px; 
        border-style:outset;
       
    }

    .title {
        font-size: 24px;
        margin-bottom: 30px;
        text-align: center; 
    }
    
    .form {
        display: flex;
        flex-direction: column;
        align-items: flex-start; /* Left align form items */
    }

    .btn {
        padding: 15px 30px;
        border-width: 2px;
        border-style: outset;
        font-size: 18px;
        text-decoration: none;
        border-radius: 5px;
        border-color: #000000;
        color: #fff;
        background-color: #007bff;
        transition: background-color 0.3s, color 0.3s;
        cursor: pointer;
        
    }
    
    .index-button {
        display: flex;
        justify-content: center;
    }
    
    .btn:hover {
        background-color: #0056b3;
    }
    
    h1 {
        color: #000000;
        margin-bottom: 50px;
    }
    
    .back-button {
        position: fixed;
        bottom: 20px; 
        left: 20px;
        padding: 10px 20px;
        font-size: 16px;
        background-color: #007bff;
        color: #fff;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        
    }
    
    .back-button:hover {
        background-color: #0056b3;
    }
       </style>
    </head>
    <body>
        <div class="container">
            <h1>Add Client</h1>
            <form id="clientForm" action="/addClient" method="POST"> 
                <div class="client-details">
                    <label for="firstName">First Name:</label>
                    <input type="text" id="firstName" name="firstName" required>
                    <br><br>
                    <label for="lastName">Last Name:</label>
                    <input type="text" id="lastName" name="lastName" required>
                    <br><br>
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" required>
                    <br><br>
                    <label for="phone">Phone:</label>
                    <input type="text" id="phone" name="phone" required>
                    <br><br>
                    <label for="address">Address:</label>
                    <input type="text" id="address" name="address" required>
                    <br><br>
                </div>
                <button type="submit" class="btn add-client">Add Client</button>
            </form>
            <a href="/dashboard" class="btn main-menu">Main Menu</a>
        </div>
    </body>
    </html>
    `;

    // Send the HTML content as the response
    res.send(ManuallyInputPageHTML);
});

// Route to render the login page
app.get('/check-permission', (req, res) => {
   

    // Construct the HTML content for the page
    const CheckPermissionPageHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Check Permissions</title>
        <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto; 
            padding: 20px; 
            padding-bottom: 25px;
            border: 2px solid;
            border-radius: 10px; 
            border-style:outset;
           
        }
        
        
        
        .
        .title {
            font-size: 24px;
            margin-bottom: 30px;
            text-align: center; 
        }
        
     
        .btn {
            padding: 15px 30px;
            border-width: 2px;
            border-style: outset;
            font-size: 18px;
            text-decoration: none;
            border-radius: 5px;
            border-color: #000000;
            color: #fff;
            background-color: #007bff;
            transition: background-color 0.3s, color 0.3s;
            cursor: pointer;
            
        }
        
      
        .btn:hover {
            background-color: #0056b3;
        }
        
        h1 {
            color: #000000;
            margin-bottom: 50px;
        }
        
        .back-button {
            position: fixed;
            bottom: 20px; 
            left: 20px;
            padding: 10px 20px;
            font-size: 16px;
            background-color: #007bff;
            color: #fff;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            
        }
        
        .back-button:hover {
            background-color: #0056b3;
        }
        
        .generated-link {
            margin-top: 20px; 
            font-size: 16px; 
            color: #000; 
            border: 1px solid #ddd; 
            padding: 10px; 
            display: block; /*link is displayed as a block element */
        }
        
        
        .next-button {
            display: block;
            padding: 10px 20px;
            font-size: 16px;
            text-decoration: none;
            border-radius: 5px;
            background-color: #007bff;
            color: #fff;
            text-align: center;
            border: 2px;
            border-color: #000;
              
        
        }
        
        .buttons {
            display: flex;
            justify-content: space-between;
        }
    
        
        
        
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="title">Checking Permissions</h1>
            <div id="linkContainer" class="generated-link"></div>
            <br><br>
            <button onclick="copyLink()" class="btn">Copy Link</button>
            <br><br>
            <button onclick="goBack()" class="btn back-button">Back</button>
        </div>
    
        <script>
            // Retrieve the generated link from the URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const generatedLink = urlParams.get('link');
    
            // Insert line breaks into the generated link
            const wrappedLink = generatedLink.replace(/(.{50})/g, "$1<br>");
    
            // Set the wrapped link as the content of the linkContainer element
            document.getElementById("linkContainer").innerHTML = wrappedLink;
    
            // Function to copy the generated link to the clipboard
            function copyLink() {
                const linkToCopy = generatedLink;
    
                // Copy the link to the clipboard
                navigator.clipboard.writeText(linkToCopy)
                    .then(() => {
                        alert("Link copied to clipboard: " + linkToCopy);
                    })
                    .catch((error) => {
                        console.error("Error copying link to clipboard:", error);
                        alert("Failed to copy link to clipboard. Please try again.");
                    });
    
                // Redirect to 
                window.location.href = '/retrieved-client';
            }
    
            // Function to navigate back
            function goBack() {
                window.history.back(); // Go back to the previous page
            }
        </script>
    </body>
    </html>
    
    `;

    // Send the HTML content as the response
    res.send(CheckPermissionPageHTML);
});

app.get("/oauth2callback", async (req, res) => {

const userData = req.session.userData;

const oauth2Client = new google.auth.OAuth2(
    userData.GoogleClientId,
    userData.GoogleClientSecret,
    userData.RedirectUri
  );
  


    try {
      const { code } = req.query;
      const { tokens } = await oauth2Client.getToken(code);
  
      // Automatically set the credentials for the OAuth2 client
      oauth2Client.setCredentials(tokens);
  
      // Create a new OAuth2 client with the obtained tokens
      const oauth2ClientWithTokens = new google.auth.OAuth2(userData.GoogleClientId, userData.GoogleClientSecret, userData.RedirectUri);
      oauth2ClientWithTokens.setCredentials(tokens);
  
      const people = google.people({ version: 'v1', auth: oauth2ClientWithTokens });
      const profile = await people.people.get({
        resourceName: 'people/me',
        personFields: 'addresses,names,phoneNumbers,emailAddresses' // Include addresses, names, phoneNumbers, and emailAddresses
      });
  
      const { addresses, names, phoneNumbers, emailAddresses } = profile.data;
      const address = addresses && addresses.length > 0 ? addresses[0].formattedValue : '';
      const phoneNumber = phoneNumbers && phoneNumbers.length > 0 ? phoneNumbers[0].canonicalForm : '';
      const email = emailAddresses && emailAddresses.length > 0 ? emailAddresses[0].value : '';
      const firstName = names && names.length > 0 ? names[0].givenName : '';
      const lastName = names && names.length > 0 ? names[0].familyName : '';
  
      // Update client data
      clientData = { email, phone: phoneNumber, address, firstName, lastName };
  
      
      res.redirect('/authorised-client');
  
    } catch (error) {
      console.error('Error retrieving user information:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  
  let clientData = {};
  app.use(bodyParser.json());
  
  // Endpoint to set client data
  app.post("/setClientData", (req, res) => {
    const { email, phone, address } = req.body;
    clientData = { email, phone, address };
    res.json({ message: "Client data updated successfully" });
  });
  
  // Endpoint to get client data
  app.get("/getClientData", (req, res) => {
    res.json(clientData);
  });


  // Route to render the success registration page
app.get('/authorised-client', (req, res) => {
   

    // Construct the HTML content for the page
    const AuthorisedClientPageHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Successfully Onboarded!</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 50px;
            }
            h1 {
                color: green;
            }
            p {
                color: #333;
            }
        </style>
    </head>
    <body>
        <h1>Successfully Onboarded!</h1>
        <p>Thank you for onboarding!</p>
    </body>
    </html>
    
    
    `;

    // Send the HTML content as the response
    res.send(AuthorisedClientPageHTML);
});

// Route to render the retrieved client page
app.get('/retrieved-client', (req, res) => {
   

    // Construct the HTML content for the page
    const RetrievedClientPageHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Retrieved Client</title>
        <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto; 
            padding: 20px; 
            padding-bottom: 25px;
            border: 2px solid;
            border-radius: 10px; 
            border-style:outset;
           
        }

        .title {
            font-size: 24px;
            margin-bottom: 30px;
            text-align: center; 
        }
        
        .form {
            display: flex;
            flex-direction: column;
            align-items: flex-start; /* Left align form items */
        }
        
       
        .btn {
            padding: 15px 30px;
            border-width: 2px;
            border-style: outset;
            font-size: 18px;
            text-decoration: none;
            border-radius: 5px;
            border-color: #000000;
            color: #fff;
            background-color: #007bff;
            transition: background-color 0.3s, color 0.3s;
            cursor: pointer;
            
        }
        
       
        
        .btn:hover {
            background-color: #0056b3;
        }
        
        h1 {
            color: #000000;
            margin-bottom: 50px;
        }
        
        .back-button {
            position: fixed;
            bottom: 20px; 
            left: 20px;
            padding: 10px 20px;
            font-size: 16px;
            background-color: #007bff;
            color: #fff;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            
        }
        
        .back-button:hover {
            background-color: #0056b3;
        }
        
        
     
        
        .client-details {
        
            margin-bottom: 20px
        }
        
        .detail {
            display: flex;
            align-items: center;
        }
        
        .detail label {
            width: 120px;
            margin-right: 10px;
        }
        
        .detail input {
         
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        
        .buttons {
            display: flex;
            justify-content: space-between;
        }
        
        .add-client {
            padding: 15px 30px;
            font-size: 18px;
            text-decoration: none;
            border-radius: 5px;
            border: 2px outset #000000;
            color: #fff;
            background-color: #007bff;
            transition: background-color 0.3s, color 0.3s;
            cursor: pointer;
            margin-top: 20px; /* Adjust margin as needed */
        }
        
        .add-client:hover {
            background-color: #0056b3;
        }
        
        
        
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Retrieved Client (Reload page periodically)</h1>
            <div id="clientDetails" class="client-details">
                <label for="firstName">First Name:</label>
                <input type="text" id="firstName" name="firstName" value="" readonly>
                <br><br>
                <label for="lastName">Last Name:</label>
                <input type="text" id="lastName" name="lastName" value="" readonly>
                <br><br>
                <label for="email">Email:</label>
                <input type="text" id="email" name="email" value="" readonly>
                <br><br>
                <label for="phone">Phone:</label>
                <input type="text" id="phone" name="phone" value="" readonly>
                <br><br>
                <label for="address">Address:</label>
                <input type="text" id="address" name="address" value="" readonly>
                <br><br>
            </div>
            <button class="btn add-client" onclick="addClient()">Add Client</button>
            <a href="/dashboard" class="btn main-menu">Main Menu</a>
    
        </div>
    
        <script>
            
            // Function to populate text boxes with client data
            async function populateClientData() {
        try {
            const response = await fetch('/getClientData');
            const data = await response.json();
    
            // Populate text boxes with client data
            document.getElementById('firstName').value = data.firstName || '';
            document.getElementById('lastName').value = data.lastName || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('phone').value = data.phone || '';
            document.getElementById('address').value = data.address || '';
        } catch (error) {
            console.error('Error fetching client data:', error);
        }
    }
    
    populateClientData();
    
        
            // Function to add client
            async function addClient() {
                // Populate text boxes with client data first
                await populateClientData();
        
                // Get the populated values from text boxes
                const firstName = document.getElementById('firstName').value;
                const lastName = document.getElementById('lastName').value;
                const email = document.getElementById('email').value;
                const phone = document.getElementById('phone').value;
                const address = document.getElementById('address').value;
        
                // Send a POST request to addClient.php
                const response = await fetch('/addClient', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ firstName, lastName, email, phone, address })
                });
        
                if (response.ok) {
                    // If the response is OK, display a success message
                    alert('Client inserted successfully!');
                } else {
                    // If there was an error, display the error message
                    const errorMessage = await response.text();
                    alert('Error inserting client: ' + errorMessage);
                }
            }
        </script>
    </body>
    </html>
    
    `;

    // Send the HTML content as the response
    res.send(RetrievedClientPageHTML);
});

// Route handler to add a client to the user's database
app.post("/addclient", (req, res) => {
    const userDbConfig = req.session.userDbConfig;

    if (!userDbConfig) {
        res.status(401).json({ error: 'User not authenticated or database configuration missing' });
        return;
    }

    const { firstName, lastName, email, phone, address } = req.body;

    const userDbConnection = establishUserDbConnection(userDbConfig);

    userDbConnection.connect((err) => {
        if (err) {
            console.error('Error connecting to user database:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const sql = `INSERT INTO clientInfo (firstName, lastName, phone, address, email) VALUES (?, ?, ?, ?, ?)`;
        const values = [firstName, lastName, phone, address, email];

        userDbConnection.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error inserting client into user database:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            } else {
                res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alert Message</title>
    </head>
    <body>
        <script>
            alert('Client added successfully');
            window.history.back(); // Go back to the previous page
        </script>
    </body>
    </html>
`);

            }

            userDbConnection.end(); // Close the database connection
        });
    });
});

// Route handler to select client details
app.get("/selectclient", (req, res) => {
    const clientId = req.query.id;

    const userDbConfig = req.session.userDbConfig;

    if (!userDbConfig) {
        res.status(401).json({ error: 'User not authenticated or database configuration missing' });
        return;
    }

    const userDbConnection = establishUserDbConnection(userDbConfig);

    userDbConnection.connect((err) => {
        if (err) {
            console.error('Error connecting to user database:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const sql = `SELECT * FROM clientInfo WHERE id = ?`;
        const values = [clientId];

        userDbConnection.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error fetching client details:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            } else {
                res.status(200).json(result[0] || {}); // Send client details or an empty object if not found
            }

            userDbConnection.end(); // Close the database connection
        });
    });
});

// Route handler to update client details
app.post("/updateclient", (req, res) => {
    const { clientId, firstName, lastName, email, phone, address } = req.body;

    const userDbConfig = req.session.userDbConfig;

    if (!userDbConfig) {
        res.status(401).json({ error: 'User not authenticated or database configuration missing' });
        return;
    }

    const userDbConnection = establishUserDbConnection(userDbConfig);

    userDbConnection.connect((err) => {
        if (err) {
            console.error('Error connecting to user database:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const sql = `UPDATE clientInfo SET firstName = ?, lastName = ?, email = ?, phone = ?, address = ? WHERE id = ?`;
        const values = [firstName, lastName, email, phone, address, clientId];

        userDbConnection.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error updating client details:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            } else {
                res.status(200).send('Client updated successfully');
            }

            userDbConnection.end(); // Close the database connection
        });
    });
});

// Route handler to delete client
app.post("/deleteclient", (req, res) => {
    const { clientId } = req.body;

    const userDbConfig = req.session.userDbConfig;

    if (!userDbConfig) {
        res.status(401).json({ error: 'User not authenticated or database configuration missing' });
        return;
    }

    const userDbConnection = establishUserDbConnection(userDbConfig);

    userDbConnection.connect((err) => {
        if (err) {
            console.error('Error connecting to user database:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const sql = `DELETE FROM clientInfo WHERE id = ?`;
        const values = [clientId];

        userDbConnection.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error deleting client:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            } else {
                res.status(200).send('Client deleted successfully');
            }

            userDbConnection.end(); // Close the database connection
        });
    });
});

// Route for serving the client menu HTML page
app.get("/client-menu", (req, res) => {
    res.sendFile(__dirname + '/client-menu.html');
});

app.post('/deleteClient', (req, res) => {
    const userDbConfig = req.session.userDbConfig;

    if (!userDbConfig) {
        res.status(401).json({ error: 'User not authenticated or database configuration missing' });
        return;
    }

    const userDbConnection = establishUserDbConnection(userDbConfig);

    const clientId = req.body.clientId; // Extract clientId from request body

    if (!clientId) {
        res.status(400).json({ error: 'Client ID missing in request' });
        return;
    }

    userDbConnection.connect((err) => {
        if (err) {
            console.error('Error connecting to user database:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const sql = 'DELETE FROM clientInfo WHERE ID = ?';
        const values = [clientId];

        userDbConnection.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error deleting client:', err);
                res.status(500).json({ error: 'Error deleting client' });
            } else {
                if (result.affectedRows > 0) {
                    // Client deleted successfully
                    res.status(200).json({ message: 'Client deleted successfully' });
                } else {
                    // Client not found or deletion unsuccessful
                    res.status(404).json({ error: 'Client not found or deletion unsuccessful' });
                }
            }

            userDbConnection.end(); // Close the database connection
        });
    });
});

// Route handler to serve the client management page
app.get("/manage-clients", async (req, res) => {
    const userDbConfig = req.session.userDbConfig;

    if (!userDbConfig) {
        res.status(401).json({ error: 'User not authenticated or database configuration missing' });
        return;
    }

    const userDbConnection = establishUserDbConnection(userDbConfig);

    try {
        await userDbConnection.connect(); // Connect to the user database

        const sql = `SELECT ID, firstName, lastName, email, phone, address FROM clientInfo`;

        userDbConnection.query(sql, (err, results) => {
            if (err) {
                console.error('Error fetching client data:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            } else {
                // Generate HTML for client dropdown menu options and client details
                const clientOptions = results.map(client => {
                    return `<option value="${client.ID}">${client.firstName} ${client.lastName}</option>`;
                }).join('');

                const clientDetails = results.reduce((acc, client) => {
                    acc[client.ID] = {
                        firstName: client.firstName || '',
                        lastName: client.lastName || '',
                        email: client.email || '',
                        phone: client.phone || '',
                        address: client.address || ''
                    };
                    return acc;
                }, {});

                // Serve the HTML template with dynamic client data
                const htmlTemplate = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Manage Clients</title>
                        <style>
                             body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5; 
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .container {
            max-width: 800px;
            margin: 20px;
            padding: 20px;
            background-color: #fff;
            border: 2px;
            border-radius: 50px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            border-style: outset;
            margin-left: 15%;
        }

        .client-dropdown {
            margin-bottom: 20px;
        }

        .client-details {
            margin-bottom: 20px;
        }

        .client-details label {
            display: block;
            margin-bottom: 10px;
            color: #333;
            font-weight: bold;
            margin: 10px;
        }

        .client-details input {
            width: calc(100% - 22px); 
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            transition: border-color 0.3s;
        }

        .client-details input:focus {
            border-color: #007bff; /* Highlight border color on focus */
            outline: none;
        }

        .button-container {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        }

        .button-container button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s;
        }

        .button-container button:hover {
            background-color: #007bff;
            color: #fff;
            margin-right: 10px;
            
        }

        .back-button {
    position: fixed;
    bottom: 20px; 
    left: 20px;
    padding: 10px 20px;
    font-size: 16px;
    background-color: #007bff;
    color: #fff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    
}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Manage Clients</h1>
                            <div class="client-dropdown">
                                <label for="clientSelect">Select Client:</label>
                                <select id="clientSelect" onchange="selectClient()">
                                    <option value="">Select a client</option>
                                    ${clientOptions}
                                </select>
                            </div>
                            <div id="clientDetails" class="client-details">
                                <label for="firstName">First Name:</label>
                                <input type="text" id="firstName" name="firstName" readonly value="">
                                <label for="lastName">Last Name:</label>
                                <input type="text" id="lastName" name="lastName" readonly value="">
                                <label for="email">Email:</label>
                                <input type="text" id="email" name="email" readonly value="">
                                <label for="phone">Phone:</label>
                                <input type="text" id="phone" name="phone" readonly value="">
                                <label for="address">Address:</label>
                                <input type="text" id="address" name="address" readonly value="">
                            </div>
                        </div>
                        <div class="button-container">
                            <button onclick="editClient()">Edit Client</button>
                            <button onclick="updateClient()">Update Client</button>
                            <button onclick="deleteClient()">Delete Client</button>
                        </div>
                        <button onclick="goBack()" class="back-button">Back</button>
                    
                        <script>
                            const clientDetails = ${JSON.stringify(clientDetails)};

                            function selectClient() {
                                const clientId = document.getElementById('clientSelect').value;

                                if (clientId && clientDetails[clientId]) {
                                    const { firstName, lastName, email, phone, address } = clientDetails[clientId];
                                    document.getElementById('firstName').value = firstName;
                                    document.getElementById('lastName').value = lastName;
                                    document.getElementById('email').value = email;
                                    document.getElementById('phone').value = phone;
                                    document.getElementById('address').value = address;
                                } else {
                                    // Clear text boxes if no client selected or client details not found
                                    document.getElementById('firstName').value = '';
                                    document.getElementById('lastName').value = '';
                                    document.getElementById('email').value = '';
                                    document.getElementById('phone').value = '';
                                    document.getElementById('address').value = '';
                                }
                            }

                            function editClient() {
                                // Allow editing of client details
                                document.querySelectorAll('.client-details input').forEach(input => {
                                    input.removeAttribute('readonly');
                                });
                            }

                            function updateClient() {
                                const clientId = document.getElementById('clientSelect').value;
                                const firstName = document.getElementById('firstName').value;
                                const lastName = document.getElementById('lastName').value;
                                const email = document.getElementById('email').value;
                                const phone = document.getElementById('phone').value;
                                const address = document.getElementById('address').value;
                            
                                
                                if (!clientId) {
                                    alert('Please select a client to update');
                                    return;
                                }
                            
                                // Send updated client details to the server 
                                const updatedClient = {
                                    clientId,
                                    firstName,
                                    lastName,
                                    email,
                                    phone,
                                    address
                                };
                            
                                
                                fetch('/updateClient', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(updatedClient)
                                })
                                .then(response => {
                                    if (response.ok) {
                                        // Update client details in the UI 
                                        alert('Client updated successfully');
                                    } else {
                                        // Handle server-side errors or display error message
                                        alert('Failed to update client');
                                    }
                                })
                                .catch(error => {
                                    console.error('Error updating client:', error);
                                    alert('Error updating client');
                                });
                            }
                            

                            function deleteClient() {
                                const clientId = document.getElementById('clientSelect').value;
                            
                               
                                if (!clientId) {
                                    alert('Please select a client to delete');
                                    return;
                                }
                            
                                // Prompt the user for confirmation 
                                const confirmation = confirm('Are you sure you want to delete this client?');
                            
                                if (!confirmation) {
                                    return; // User canceled the deletion operation
                                }
                            
                                // Trigger the server-side deletion operation
                                fetch('/deleteClient', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ clientId })
                                })
                                .then(response => {
                                    if (response.ok) {
                                        // Client deleted successfully
                                        alert('Client deleted successfully');
                                        
                                    } else {
                                        // Failed to delete client
                                        alert('Failed to delete client');
                                    }
                                })
                                .catch(error => {
                                    console.error('Error deleting client:', error);
                                    alert('Error deleting client');
                                });
                            }                            
                            
                            

                            function goBack() {
                                window.history.back();
                            }
                        </script>
                    </body>
                    </html>
                `;

                res.send(htmlTemplate);
            }

            userDbConnection.end(); // Close the database connection
        });
    } catch (error) {
        console.error('Error connecting to user database:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// Endpoint to serve the HTML page
app.get('/searchClientsPage', (req, res) => {
    // Render the HTML content
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Search Clients</title>
            <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
            }
            
            h1 {
                color: #000000;
                text-align: center;
                margin-top: 5%;
            }
            
            .search-container {
                margin-top: 5%;
                text-align: center;
                margin-bottom: 20px;
            }
            
            #searchInput {
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
                width: 200px;
                margin-right: 10px;
            }
            
            button {
                padding: 8px 12px;
                border-radius: 5px;
                color: #000;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            
            button:hover {
                background-color: #007bff;
                color: #fff;
            }
            
            .search-results {
                margin: 0 auto;
                max-width: 600px;
                height: 300px; /* Set a fixed height for the container */
                overflow-y: auto; /* Allow vertical scrolling within the container */
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }
            
            .copy-button {
                margin-top: 20px;
                padding: 8px 12px;
                border-radius: 5px;
                background-color: #007bff;
                color: #fff;
                cursor: pointer;
                margin-left: 15%;
            }
            
            .back-button {
                position: fixed;
                bottom: 20px;
                left: 20px;
                padding: 10px 20px;
                font-size: 16px;
                background-color: #007bff;
                color: #fff;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            }
            
</style>            
        </head>
        <body>
            <h1>Search Clients</h1>
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Enter keyword...">
                <button onclick="searchClients()">Search</button>
                <br><br>
                <p>(Leave empty to search all clients)</p>
            </div>
            <div class="search-results" id="searchResults"></div>
            <script>
                function searchClients() {
                    const keyword = document.getElementById('searchInput').value.trim();
                   
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/searchClientAddress', true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.onload = function() {
                        if (xhr.status === 200) {
                            document.getElementById('searchResults').innerHTML = xhr.responseText;
                        } else {
                            alert('Error searching for clients');
                        }
                    };
                    xhr.send(JSON.stringify({ keyword }));
                }
                function copyData() {
                    const searchResults = document.getElementById('searchResults').innerText;
                    navigator.clipboard.writeText(searchResults)
                        .then(() => {
                            alert("Data copied to clipboard");
                        })
                        .catch(error => {
                            console.error('Error copying data:', error);
                            alert("Error copying data");
                        });
                }
                function goBack() {
                    window.history.back();
                }
            </script>
            <button class="copy-button" onclick="copyData()">Copy All Data</button>
            <br><br>
            <button onclick="goBack()" class="back-button">Back</button>
        </body>
        </html>
    `;

    // Send the HTML content as the response
    res.send(htmlContent);
});



// Endpoint to handle client search by address
app.post('/searchClientAddress', (req, res) => {
    const { keyword } = req.body; // Extract keyword from request body

    const userDbConfig = req.session.userDbConfig;

    if (!userDbConfig) {
        res.status(401).json({ error: 'User not authenticated or database configuration missing' });
        return;
    }

    const userDbConnection = establishUserDbConnection(userDbConfig);

    // Construct SQL query to search for clients by address containing the keyword
    const sql = "SELECT * FROM clientInfo WHERE address LIKE ?";

    // Construct search pattern by adding % around the keyword
    const searchKeyword = `%${keyword}%`;

    // Connect to the user database using userDbConfig
    userDbConnection.connect((err) => {
        if (err) {
            console.error('Error connecting to user database:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // Execute the query with prepared statement
        userDbConnection.query(sql, [searchKeyword], (err, results) => {
            if (err) {
                console.error('Error searching for clients:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            } else {
                // Construct HTML content based on search results
                let htmlContent = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Search Results</title>
                        <style>
                            
                        </style>
                    </head>
                    <body>
                        <h1>Search Results</h1>
                        <div class="search-results">`;

                if (results.length > 0) {
                    results.forEach(client => {
                        htmlContent += `
                            <div class="client-details">
                                <label>ID:</label> ${client.ID}<br>
                                <label>First Name:</label> ${client.firstName}<br>
                                <label>Last Name:</label> ${client.lastName}<br>
                                <label>Email:</label> ${client.email}<br>
                                <label>Phone:</label> ${client.phone}<br>
                                <label>Address:</label> ${client.address}<br>
                                <br>
                            </div>`;
                    });
                } else {
                    htmlContent += `<p>No clients found with the specified keyword.</p>`;
                }

                htmlContent += `
                        </div>
                    </body>
                    </html>`;

                res.send(htmlContent); // Send the dynamically generated HTML as the response
            }

            
        });
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server ready on port ${port}.`));
