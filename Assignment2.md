Assignment 1 - Web Server - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** Tharaka Ravishan
- **Student number:** n11849622
- **Partner name (if applicable):**
- **Application name:** Video Transcorder
- **Two line description:**  Can convert Video into text via an uploaded file or by specifiying 
an external URL to the video. Users can download the converted text as a text file.
- **EC2 instance name or ID:** i-000013ca160b17fb8

Core criteria
------------------------------------------------

### Core - First data persistence service

- **AWS service name:** S3
- **What data is being stored?:** Uploaded Video Files / Transcripted Output text files
- **Why is this service suited to this data?:** Large files can be stored for less cost in AWS S3.   Highly available and fault tolerant
- **Why is are the other services used not suitable for this data?:** Services like EBS / EFS Cost is higher. If the files are no longer needed, we can move them to S3 IA or Glacier to be more cost efficient. Video files can be quickly downloaded and cached if required. 
- **Bucket/instance/table name:** n11849622-assignment-2
- **Video timestamp:**
- **Relevant files:** app.js [line no 504]
    -

### Core - Second data persistence service

- **AWS service name:**  RDS
- **What data is being stored?:** 2 Tables maintained to keep records of User details and File path and names to be referenced.
- **Why is this service suited to this data?:** A relational MySQL database is maitained in cloud to store User data and file assests belong to user. It's rquired to make foreign key constraints to map / update releavnt data associated to user. 
- **Why is are the other services used not suitable for this data?:**  Other data storage options not allow cross table referencing and it's easy to develop and maintain a mysql database. 
- **Bucket/instance/table name:** n11849622-assignment2
- **Video timestamp:**
- **Relevant files:** config/database.js
    -

### Third data service

- **AWS service name:**  EFS
- **What data is being stored?:** Application data
- **Why is this service suited to this data?:** EFS can be mounted to multiple EC2's and can access data in the store parellely. If a EC2 fails, then another replaced EC2 instance can access and start the application data from EFS.
- **Why is are the other services used not suitable for this data?:** EFS can be mounted to multiple EC2 instances at same time. It's cheap when compared to EBS. Data can be accessed parellely. Highly avaibale and fault tolerant. 
- **Bucket/instance/table name:** n11849622-A2
- **Video timestamp:**
- **Relevant files:**  cf_template.yml
    -

### S3 Pre-signed URLs

- **S3 Bucket names:** n11849622-assignment-2
- **Video timestamp:** 
- **Relevant files:** app.js [Line no   ]
    -

### In-memory cache

- **ElastiCache instance name:**
- **What data is being cached?:** []
- **Why is this data likely to be accessed frequently?:** []
- **Video timestamp:**
- **Relevant files:**
    -

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** [eg. intermediate video files that have been transcoded but not stabilised]
- **Why is this data not considered persistent state?:** [eg. intermediate files can be recreated from source if they are lost]
- **How does your application ensure data consistency if the app suddenly stops?:** [eg. journal used to record data transactions before they are done.  A separate task scans the journal and corrects problems on startup and once every 5 minutes afterwards. ]
- **Relevant files:**
    -

### Graceful handling of persistent connections

- **Type of persistent connection and use:** [eg. server-side-events for progress reporting]
- **Method for handling lost connections:** [eg. client responds to lost connection by reconnecting and indicating loss of connection to user until connection is re-established ]
- **Relevant files:**
    -


### Core - Authentication with Cognito

- **User pool name:** n11849622-cognito-assignment2
- **How are authentication tokens handled by the client?:**  Sets a cookie on client side of the session. 
- **Video timestamp:**
- **Relevant files:** app.js [Line no 211]
    -

### Cognito multi-factor authentication

- **What factors are used for authentication:** password , email
- **Video timestamp:**
- **Relevant files:** 
    -

### Cognito federated identities

- **Identity providers used:** google
- **Video timestamp:**
- **Relevant files:**
    -

### Cognito groups

- **How are groups used to set permissions?:** [eg. 'admin' users can delete and ban other users]
- **Video timestamp:**
- **Relevant files:**
    -

### Core - DNS with Route53

- **Subdomain**: http://n11849622.cab432.com/
- **Video timestamp:**


### Custom security groups

- **Security group names:**
- **Services/instances using security groups:**
- **Video timestamp:**
- **Relevant files:**
    -

### Parameter store

- **Parameter names:** /n11849622/Google_ID,/n11849622/Google_callback_url,/n11849622/Google_secret,/n11849622/access_key,/n11849622/db_host_name,/n11849622/db_username
- **Video timestamp:**
- **Relevant files:** app.js / database.js
    -

### Secrets manager

- **Secrets names:** /n11849622/db_password, /n11849622/app
- **Video timestamp:**
- **Relevant files:**
    -

### Infrastructure as code

- **Technology used:** AWS Cloud Formation
- **Services deployed:** EC2 Instance / Route 53 DNS / S3 Bucket
- **Video timestamp:**
- **Relevant files:** cf_template.yml
    -

### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -