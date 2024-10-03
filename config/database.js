const mysql = require('mysql2');
const AWS = require('aws-sdk');
// Create a Secrets Manager client
const secretsManager = new AWS.SecretsManager({ region: 'ap-southeast-2' }); // Replace with your region
AWS.config.update({
  region: 'ap-southeast-2'
});

// Function to get AWS credentials from Secrets Manager
const getAwsSecrets = async (secretName) => {
  try {
    const secretValue = await secretsManager.getSecretValue({ SecretId: secretName }).promise();

    if ('SecretString' in secretValue) {
      return JSON.parse(secretValue.SecretString);
    }
    throw new Error(`Secret ${secretName} does not contain a valid SecretString.`);
  } catch (err) {
    console.error('Failed to retrieve secret from Secrets Manager:', err);
    throw err;
  }
};

// Define the secret name (use the same name you set in Secrets Manager)
const secretName = '/n11849622/app';

getAwsSecrets(secretName)
  .then((secrets) => {
    // Use secrets to configure the AWS SDK
    AWS.config.update({
      accessKeyId: secrets.accessKeyId,
      secretAccessKey: secrets.secretAccessKey,
      region: 'ap-southeast-2', // Ensure the region is always set
      sessionToken: secrets.sessionToken // Include only if the session token exists
    });

    console.log('AWS SDK configured successfully with secrets from AWS Secrets Manager.');
  })
  .catch((err) => {
    console.error('Error configuring AWS SDK:', err);
  });
// Initialize AWS SSM (Parameter Store) and Secrets Manager clients
const ssm = new AWS.SSM();

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