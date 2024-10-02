const mysql = require('mysql2');
const AWS = require('aws-sdk');
require('dotenv').config();
AWS.config.update({
  accessKeyId: 'ASIA5DYSEEJ4WT2J5PHM', // Use your AWS access key here
    secretAccessKey: 'OGAjfUDjcQ1awpkkYNB+vRA38RpZI9RZ9dIiNKZf', // Use your AWS secret key here
    region: 'ap-southeast-2', // The region where your bucket is located
    sessionToken  : 'IQoJb3JpZ2luX2VjEFYaDmFwLXNvdXRoZWFzdC0yIkcwRQIgEvuMejNGLNOpuvoCtxwsx8I2y0yDskPm5oUiDWAmnHsCIQCaOL/DDCe/mCeRc9NuNSBlJHoK+f/NIEv5Xmj2ysIpuSquAwif//////////8BEAMaDDkwMTQ0NDI4MDk1MyIMJd0TzO9yPAS+aEHQKoIDYuReFgMTignFK8lOpnLMnwkUjJh7XoEV6CfaduLpm4NNCDil1fz+ezxOqIhw12Djgf6N/Zr0yyys3EGr95t6/FxvRQSZ0caTB9dkexVmvBnK7BXWlYhHyhpXcsY3lTast1J4pALIHaTZGiZeQ+C/pyA3bswbg9mLMaOK6ka0Kl4VMuhjdRQLsGmkG6dtjNW38Jf2x8qF2rWcbiB6Ewk++F3ilI+IKt7JBy296qfvLTpAntbygIb28m7QV9xnOVeN12+NOG4moVg8Td16FVYsablCXKKiu4T/PAPbFRGgCRKSQBqgwjrzxASsOmufn6o0xoN2xN5UuAmNdtvCpDF39hXJ8+Ke9fYX64imxQI7fCQin758hziCJS1CVgnYN9DO5Wj1aLO3H70rRDbe7n208sPWIg4EcIzMXeKznf/RAu9GyQn+9jExGoeAkbsENVvcGI2kKYp0jh6FTFXe4W/XUNtd+tcDqz95iXPZECu0Rl+qN2G0T7daXYk0ObYiT/vfhtEwmMvztwY6pgGd6ZuOOerB1X2Vr3+BYTrjVPaEJTZprKHH/ZPqTAFhiTY2SGfuQ+pjM0yGsWLEWDtMWrUhVNflYsT0TG17QEYiML5jn6CsdyDH+Rw462dZCUn0HJQCHvwbsM1FEaKv8c5rEGgUZhyjON9qdnazIGuYNZ3KAnfawHF6vtjgWvaSgvLCyTJJtOZ7Bk8p2z29WRj0rDZOYaMHVF1E/Ud4G6pfkE4RLlhH'
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