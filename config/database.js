const mysql = require('mysql2');
const AWS = require('aws-sdk');
require('dotenv').config();

// Define SSM Parameter Names
const AWS_ACCESS_KEY_ID_PARAM = '/n11849622/app/aws_access_key_id';     
const AWS_SECRET_ACCESS_KEY_PARAM = '/n11849622/app/aws_secret_access_key';
const AWS_REGION_PARAM = 'ap-southeast-2';                     
const AWS_SESSION_TOKEN_PARAM = '/n11849622/app/aws_session_token';       

// Initialize SSM client
const ssmClient = new SSMClient({ region: 'ap-southeast-2' }); 

// Function to fetch a parameter value from SSM Parameter Store
async function getSSMParameterValue(parameterName) {
  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: true, // Required if the parameter is stored as a SecureString
  });
  const response = await ssmClient.send(command);
  return response.Parameter.Value;
}

// Fetch AWS credentials and update the configuration
(async () => {
  try {
    // Fetch values from SSM Parameter Store
    const accessKeyId = await getSSMParameterValue(AWS_ACCESS_KEY_ID_PARAM);
    const secretAccessKey = await getSSMParameterValue(AWS_SECRET_ACCESS_KEY_PARAM);
    const region = await getSSMParameterValue(AWS_REGION_PARAM);
    const sessionToken = await getSSMParameterValue(AWS_SESSION_TOKEN_PARAM);

    // Update AWS configuration with retrieved values
    AWS.config.update({
      accessKeyId,
      secretAccessKey,
      region,
      sessionToken,
    });

    console.log('AWS configuration updated successfully from SSM Parameter Store');
    
    // Your other code that depends on AWS configuration can go here.
  } catch (error) {
    console.error('Failed to retrieve SSM parameters:', error);
  }
})();
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