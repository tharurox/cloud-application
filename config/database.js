const mysql = require('mysql2');
const AWS = require('aws-sdk');
require('dotenv').config();
AWS.config.update({
  accessKeyId: 'ASIA5DYSEEJ4ULBKWDWH', // Use your AWS access key here
  secretAccessKey: 'WpjD/C86FScRorAvP0tKf8DaaHpd4mowQYSiNpRR', // Use your AWS secret key here
  region: 'ap-southeast-2', // The region where your bucket is located
  sessionToken  : 'IQoJb3JpZ2luX2VjEGkaDmFwLXNvdXRoZWFzdC0yIkgwRgIhAPg6b/aU6mZtSy527TB1bzQ5jn7ySzMUJI0TPSWBjxxGAiEA2PQTcCxxWWpKMulyc1wHGMSifBtbYktwi6e1ubeu4bEqrgMIsv//////////ARADGgw5MDE0NDQyODA5NTMiDAlSD4PpR5BzvzdCyyqCA3OTp5j/9S5I22R7exCP67wEJ5aSR70WDBFVmLiPhBAAJHULDrn6dDpw+WSCYM4HHVgv9+OPr6tIlj2qu1B+2i5fjnnrzRVuHfOJn6PTGjRJFyvBwC3zmdqTsnFBQdSqun3F98m39qG+ZLMBx6pwn586FkyqNaRShq/f4xDOifhJJlcYs9wVrr5A6drtlcVwuaGX9H5O353R2EqHT456hxefQtCKJLMb7Uj0c7X58yokwOiO7ppMmX6NV6sLYIi3aM9cbIabL228anVJiQbG4TbvD12XsIyRg+MHD8r4nKq9xDz4h2LjclndqHA13++bhiBJRPfWHjQLo2r69urbpweRvhaxE33uT7XNU4ky0wAJGfYjVP18nbFP3Rtpwv0F4nEk61Wy6x1ZD9joLDAGAq2U34Hzp6xHHX91RVeMeeK/Wt0yeGLxwyleuqazkydFMgAHMLogmeEsdza6Huissw+9Ka3XpWmTIsz28Aff6l3pVsLjeky/gcJNELqj071w+B8KMJvN97cGOqUBAV2QY/Hq0B0QX1XZbL2kh/3Y09cs31Zaeq1pIG1CFKsAubunumwvuDFni215dFCFtUayvInxCJamkF87U2vV4ZxQFVt22jSKBQmQ43dLodwevgRzGqlV9W7wCKAI8ayHXvI8s1Jf+0yww7EeY/hjFGmS5lDxw7NldPb9T1hbReNheNePXg0kbfons5pXmSYsBqidnHiVDjPqxtqv3AoBbHiVPt/2'
});
// Initialize AWS SSM (Parameter Store) and Secrets Manager clients
const ssm = new AWS.SSM();
const secretsManager = new AWS.SecretsManager();

// Function to retrieve a parameter from Parameter Store
async function getParameter(parameterName) {
  const params = {
    Name: parameterName,
    WithDecryption: true, // Decrypt sensitive information
  };
  const result = await ssm.getParameter(params).promise();
  return result.Parameter.Value;
}

// Function to retrieve a secret from Secrets Manager
async function getSecret(secretName) {
  const params = {
    SecretId: secretName,
  };
  const result = await secretsManager.getSecretValue(params).promise();
  return JSON.parse(result.SecretString); // Assuming secret is stored in JSON format
}

// Function to initialize MySQL connection
async function initializeDbConnection() {
  try {
    // Retrieve the DB credentials from Parameter Store and Secrets Manager
    const [dbHost, dbUsername, dbPassword] = await Promise.all([
      getParameter('/n11849622/db_host_name'),  // Fetch DB hostname from Parameter Store
      getParameter('/n11849622/db_username'),   // Fetch DB username from Parameter Store
      getSecret('/n11849622/db_password')       // Fetch DB password from Secrets Manager
    ]);

    // Create the MySQL connection pool
    const pool = mysql.createPool({
      host: dbHost,
      user: dbUsername,
      password: dbPassword.password, // Fetch the password from the secret JSON object
      database: process.env.DB_NAME || 'videotranscorder',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error connecting to MySQL:', err);
      } else {
        console.log('Connected to MySQL');
        connection.release();
      }
    });

    // Drop and recreate tables
    dropAndCreateTables(pool);

    return pool;
  } catch (error) {
    console.error('Error initializing database connection:', error);
    throw error;
  }
}

// Function to drop and recreate tables
function dropAndCreateTables(pool) {
  // Drop downloads table if it exists
  pool.query(`DROP TABLE IF EXISTS downloads`, (err) => {
    if (err) {
      console.error('Error dropping downloads table:', err);
    } else {
      console.log('downloads table dropped.');

      // Drop users table if it exists
      pool.query(`DROP TABLE IF EXISTS users`, (err) => {
        if (err) {
          console.error('Error dropping users table:', err);
        } else {
          console.log('users table dropped.');

          // Create the users table
          pool.query(`
            CREATE TABLE users (
              id VARCHAR(36) PRIMARY KEY,  -- Store Cognito userSub (UUID)
              username VARCHAR(255) UNIQUE NOT NULL,
              password VARCHAR(255) NOT NULL
            )
          `, (err) => {
            if (err) {
              console.error('Error creating users table:', err);
            } else {
              console.log('users table created.');

              // Create the downloads table after users table is created
              pool.query(`
                CREATE TABLE IF NOT EXISTS downloads (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  user_id VARCHAR(36),  -- Match user_id datatype with users.id (UUID from Cognito)
                  file_name VARCHAR(255),
                  file_path VARCHAR(255),
                  source_url VARCHAR(255),
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
                )
              `, (err) => {
                if (err) {
                  console.error('Error creating downloads table:', err);
                } else {
                  console.log('downloads table created.');
                }
              });
            }
          });
        }
      });
    }
  });
}

// Export the initialized DB connection pool
module.exports = initializeDbConnection();