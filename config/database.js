const mysql = require('mysql2');
const AWS = require('aws-sdk');
require('dotenv').config();
AWS.config.update({
    accessKeyId: 'ASIA5DYSEEJ45XQNPEI4', // Use your AWS access key here
    secretAccessKey: 'vlqiaLPOLeMVScFQGn98mIDSu7ZnJNph1hnDdBbf', // Use your AWS secret key here
    region: 'ap-southeast-2', // The region where your bucket is located
    aws_session_token : 'IQoJb3JpZ2luX2VjELb//////////wEaDmFwLXNvdXRoZWFzdC0yIkcwRQIgbVIxQ5FOO5o5cEIzTVye998ecVFCKIIImAKayfZQEHECIQDJhQy4sz2QekTMteHOidcAahfoDU1eZKdc8mXxP5RVZyquAwjv//////////8BEAMaDDkwMTQ0NDI4MDk1MyIM8P6S8ORSELqxf0fYKoIDqtFLPf6rmeUXHpwhcV8matCIB987gTTYOAyipHtklNlzbYImgzEIJyss5DiYGf5PiMAmeSxg7fCbpI/mdMPyoWcpYSpp+slDcxtTZW7rD35MFmVjE68V3LfvjG9kYMkv4BcJCA9jm73bhbf1Qh3/GWrInkwn+PtBAbNg5U50tUaZc0OOTfvixmRUZ6m0hFFIdamDLUW7/lFouSED3qcY2Ta4eGzFWvHupoIQK+5pn80dAmUsYfAskzdpe/CJONkdIjDq5kBHHVeWCqk0XHL+vaYiFr1hVAxDH93YHkqcIzVsXE1eHaNqR6l/PUyb6g6qR90gDDuF8pX2fyzBs/vFfCBUGevWCHCgjE5vg8TkFzSg74qB0qa+FP2gNwvI/YQSqkcTQACTkgHTtBTtYOeJ9wVNB5BIEy1dtQQjYWQBvo1QMMvl3+hgarTHAWXntalepAILl/3pKFlU6X81LQhZVssxSCHNJB8CzU3dJ9h8iXmamPzWl29n2WR8bDxeb6RYHcQwnJ/QtwY6pgHJth7FfrwA1a77CelEl+eNQra7lblMv4pqa2xLk5rjYh5fEphPHTC74JWjlip0B76RdPDgl9awZWjjSQzTm9zvQPcSTg8jyNpvz95BtCN/0KNJkF5WJXG7Vg6Udc+M6X0MQ+Qt5Sw6MTZeHbKVMsPzKepNY1uUzJ0gUaPcU/udQ1LL8YN+V5QIHF1RuyChGXUhKYUUEld7tYQEmjAP+Zvnq1gxpk/g'
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