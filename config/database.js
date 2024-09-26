const mysql = require('mysql2');
const AWS = require('aws-sdk');
require('dotenv').config();
AWS.config.update({
  accessKeyId: 'ASIA5DYSEEJ4YYUILWYJ', // Use your AWS access key here
    secretAccessKey: 'BLa3C+nKX/4A0tuJqv1PvePHzkMliq0bIft7Dkwb', // Use your AWS secret key here
    region: 'ap-southeast-2', // The region where your bucket is located
    sessionToken  : 'IQoJb3JpZ2luX2VjEMv//////////wEaDmFwLXNvdXRoZWFzdC0yIkcwRQIgF856wq3jcq6c+/ZFEHyK0yP5MgoyHBN+0qA2+4s/7ogCIQDCN/x3M+UAoaMGzRpR4aNoOU9DqNet+da2bnkD4NTltSqlAwgUEAMaDDkwMTQ0NDI4MDk1MyIMuKCsXMBHU1Kze+RuKoIDxX5d427H9f4f5mJvkA5ZyUAbcvL+DNX/9V9+gzZ3euHEc13rwUTT0wZi348+38N1+KBQM1lWTdIs1FYpk29vRmwylJAN4ubfyh1xiiUltPhuPYwOxgdy28F5LjqvyijBO3NAY0ND0QV7Q+y1USH9BAkNYcvEBlNKqERqARj/2+3HHan5gdkw+S/tAnzkCyHLaNxUgTXZw/woKwYZ7D7HSWaNH/zpBe67f8Buf30DCrwGIJdXtcltnM9tXw6l4nnQM7RiUe/kNEco4GoR2NaBQVpaTU17rKgUNtmIBSKvQgfMx+85eJoavJ/Gf71uTZI2m+AGzjRetjQRPhlUvtnSggkx9Z7+K28d3he9Fu2Pqra0uD9rluzBgao6hYIpzNvUhRGGbJtNeUnb5JQgHukc/NazfX0tcAxru2hDZz+3FfAtHdw0I1KIyDAPBlagwFc6T498YLwWhfsV1vxrqJf00qE7UHTvEdZAfBDCtnKT99Ui/1zE1pfzMn0G+iMWMlYAE04wpffUtwY6pgEDaUpx6m5d/dI4GOjpFQlhawAjcB0c0dcF1fkevjYXcuTulkexXu8WS/6+tjBXXZO321J3p5sG5lMrYSl5e6Qwd7nlksVALHgT/z2ojElwFa/gsyxUPdN7Eq+pV+u+ywYeYkH5XH9hloBDYWrT2tRQ7xJg/VZNaxVjae3muF4D+HrMQ+q3KrKVvdhwaD+cvt8LiDeYG/j3B2AwHicxUoGAT8I8CVkO'
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