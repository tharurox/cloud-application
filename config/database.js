const mysql = require('mysql2');
const AWS = require('aws-sdk');
require('dotenv').config();
AWS.config.update({
    accessKeyId: 'ASIA5DYSEEJ47L6A6CQI', // Use your AWS access key here
    secretAccessKey: '+kOBrR9VuucBIkr0XG4yH0NFyPrxrmK4MgkC0chH', // Use your AWS secret key here
    region: 'ap-southeast-2', // The region where your bucket is located
    sessionToken  : 'IQoJb3JpZ2luX2VjEML//////////wEaDmFwLXNvdXRoZWFzdC0yIkcwRQIhAPCgmwFoDswUkbWpn2htBtiLTTB1PLzNWH3fTVLkJ6bbAiAfXAgehZUCzJuB9BkfJNjvvBmowHud9cxNUpc8j8wNriquAwj7//////////8BEAMaDDkwMTQ0NDI4MDk1MyIM1kLCSSXc1dqQT+kYKoID3bRoiEyp05phpNTjeURQD0v6YtCy+Im+CF9G3k9PggiK0v7at6SQSQ8+MtsyvjWJht+SOdq/DIxsl6QXmHdVUbxavGbauO9OYCOijw/HosHsGl7qXKlXaFhU5ch84zZADZRWAtJuI/dmhOlw0qQvt/nXqweW8jzBf5BmSeW/Ebjz2cr30xCrToriQkh4Z62t3xVbn/taFeygOMsPQAhRRnvnXz1H3WqwMeBKxzEYOTqBYQwqQcJ1rl7qvRPjEDoerZ2xLxFDG7BuLlILFEWsPe7VDjPlZmT981h5F53fbacq9mcLSfnAb/sx0WwPrn0PS60OB11Kay/ROzPXonzWWuI1o1DejCbLTqKRgsY6Di83TRxQ/W5EnWo2pIyOKq/yl9MyqiWRVPms+/cCKo+YnOr79eOC8N4M7V+Mp96OAvZgvq195wyriV/tggPNmHY1PqFhZrrfzNJVZTE2I5eBRQNtViMtsjCy5k95JliRGuNgpJLLhfKNNJa0vX2HoLBau9Mw8YXTtwY6pgEkq/aLn0IpMKz64HTDZDCCu4uZPC+zZ+0RXvSCzp+dSmB92qwV5zgdmNx+DAfTYT1kpCVhau86ZkDKwSDgMsHK//vthTBD2mIQhUc8gGsJHJ+8ZowyE89U4hHnddJoJ3EpsBNaHfGZpPV0jGHQEBTCG/Uw4KofO3vYfKFfP0dFiEy3b/4IbHQNmFHmEfbyVgwCZh/QPA/z/MflR+TtRx+1I3kAABSa'
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